import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Changelog } from './changelog.entity';
import { RedisService } from '../redis/redis.service';
import { 
  ChangeAction, 
  EntityType, 
  ChangelogData, 
  LocationChangeData, 
  CategoryChangeData 
} from './changelog.types';
import { CreateChangelogInput } from './dto/create-changelog.input';

@Injectable()
export class ChangelogService {
  constructor(
    @InjectRepository(Changelog)
    private changelogRepository: Repository<Changelog>,
    private redisService: RedisService,
  ) {}

  async findAll(): Promise<Changelog[]> {
    return this.changelogRepository.find({
      order: {
        timestamp: 'DESC',
      },
    });
  }

  async findRecent(limit: number): Promise<Changelog[]> {
    const cacheKey = `recent_changelog:${limit}`;
    const cachedChanges = await this.redisService.get<Changelog[]>(cacheKey);

    if (cachedChanges) {
      return cachedChanges;
    }

    const changes = await this.changelogRepository.find({
      order: {
        timestamp: 'DESC',
      },
      take: limit,
    });

    // Cache for a shorter period since changelog may update frequently
    await this.redisService.set(cacheKey, changes, 300); // 5 minutes

    return changes;
  }

  async create(
    changelogInput: CreateChangelogInput,
    userId: string,
  ): Promise<Changelog> {
    // Build the changeType string from the input
    const changeType = `${changelogInput.action}_${changelogInput.entityType}`;
    
    // Build the full changelog data
    const changelogData: ChangelogData = {
      action: changelogInput.action,
      entityType: changelogInput.entityType,
      entityId: changelogInput.entityId,
      entityName: changelogInput.entityName,
      ...changelogInput.changeData,
    };

    const newEntry = this.changelogRepository.create({
      changeType,
      changeData: changelogData,
      modifiedBy: userId,
    });
    
    const savedEntry = await this.changelogRepository.save(newEntry);

    // Invalidate recent changelog cache with different limits
    await this.redisService.del('recent_changelog:10');
    await this.redisService.del('recent_changelog:20');
    await this.redisService.del('recent_changelog:50');

    return savedEntry;
  }

  // Helper function to detect changes between objects
  private detectChanges(
    oldData: any,
    newData: any,
  ): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};

    // Get all unique keys from both objects
    const allKeys = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {}),
    ]);

    for (const key of allKeys) {
      const oldValue = oldData?.[key];
      const newValue = newData?.[key];

      // Skip if values are the same (including deep comparison for arrays/objects)
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = {
          from: oldValue,
          to: newValue,
        };
      }
    }

    return changes;
  }

  // Main logging function that will be called by other services
  async logChange(
    action: ChangeAction,
    entityType: EntityType,
    data: {
      entityId?: string;
      entityName?: string;
      oldData?: any;
      newData?: any;
      metadata?: Record<string, any>;
      revertedFromId?: number;
    },
    userId: string,
  ): Promise<Changelog> {
    try {
      // Detect changes if both old and new data are provided
      const changes =
        data.oldData && data.newData
          ? this.detectChanges(data.oldData, data.newData)
          : undefined;

      // Determine if this action is revertible
      const isRevertible =
        action !== ChangeAction.BATCH_UPDATE &&
        !!data.entityId &&
        ((action === ChangeAction.DELETE && !!data.oldData) || // Delete is revertible if we have the original data
          (action !== ChangeAction.DELETE && action !== ChangeAction.CREATE)); // Update and toggle are revertible

      // Create the changelog data object
      const changelogData: ChangelogData = {
        action,
        entityType,
        entityId: data.entityId,
        entityName: data.entityName,
        changes,
        metadata: data.metadata,
        fullDataBefore: data.oldData || null,
        fullDataAfter: data.newData || null,
        isRevertible,
        revertedFromId: data.revertedFromId,
      };

      const changelogInput: CreateChangelogInput = {
        action,
        entityType,
        entityId: data.entityId,
        entityName: data.entityName,
        changeData: changelogData,
      };

      return await this.create(changelogInput, userId);
    } catch (error) {
      console.error('Failed to create changelog entry:', error);
      throw error;
    }
  }

  // Convenience methods for specific operations
  async logLocationCreate(
    location: LocationChangeData,
    userId: string,
  ): Promise<Changelog> {
    return this.logChange(
      ChangeAction.CREATE,
      EntityType.LOCATION,
      {
        entityId: location.id,
        entityName: location.locationName,
        newData: location,
        metadata: {
          category: location.category || location.categoryId,
          coordinates: location.coordinates,
        },
      },
      userId,
    );
  }

  async logLocationUpdate(
    locationId: string,
    locationName: string,
    oldData: LocationChangeData,
    newData: LocationChangeData,
    userId: string,
  ): Promise<Changelog> {
    return this.logChange(
      ChangeAction.UPDATE,
      EntityType.LOCATION,
      {
        entityId: locationId,
        entityName: locationName,
        oldData,
        newData,
      },
      userId,
    );
  }

  async logLocationDelete(
    location: LocationChangeData,
    userId: string,
  ): Promise<Changelog> {
    return this.logChange(
      ChangeAction.DELETE,
      EntityType.LOCATION,
      {
        entityId: location.id,
        entityName: location.locationName,
        oldData: location,
        metadata: {
          category: location.category || location.categoryId,
          deletedData: location,
        },
      },
      userId,
    );
  }

  async logLocationBatchUpdate(
    locationIds: string[],
    changes: Record<string, any>,
    userId: string,
  ): Promise<Changelog> {
    return this.logChange(
      ChangeAction.BATCH_UPDATE,
      EntityType.LOCATION,
      {
        metadata: {
          locationIds,
          changes,
          count: locationIds.length,
        },
      },
      userId,
    );
  }

  async logCategoryCreate(
    category: CategoryChangeData,
    userId: string,
  ): Promise<Changelog> {
    return this.logChange(
      ChangeAction.CREATE,
      EntityType.CATEGORY,
      {
        entityId: category.id,
        entityName: category.categoryName,
        newData: category,
      },
      userId,
    );
  }

  async logCategoryUpdate(
    categoryId: string,
    categoryName: string,
    oldData: CategoryChangeData,
    newData: CategoryChangeData,
    userId: string,
  ): Promise<Changelog> {
    return this.logChange(
      ChangeAction.UPDATE,
      EntityType.CATEGORY,
      {
        entityId: categoryId,
        entityName: categoryName,
        oldData,
        newData,
      },
      userId,
    );
  }

  async logCategoryDelete(
    category: CategoryChangeData,
    userId: string,
  ): Promise<Changelog> {
    return this.logChange(
      ChangeAction.DELETE,
      EntityType.CATEGORY,
      {
        entityId: category.id,
        entityName: category.categoryName,
        oldData: category,
        metadata: {
          deletedData: category,
        },
      },
      userId,
    );
  }

  async logCategoryToggle(
    categoryId: string,
    categoryName: string,
    field: 'hiddenByDefault' | 'isDisabled',
    oldValue: boolean,
    newValue: boolean,
    userId: string,
  ): Promise<Changelog> {
    const oldData = { [field]: oldValue };
    const newData = { [field]: newValue };

    return this.logChange(
      ChangeAction.TOGGLE,
      EntityType.CATEGORY,
      {
        entityId: categoryId,
        entityName: categoryName,
        oldData,
        newData,
        metadata: {
          toggleField: field,
        },
      },
      userId,
    );
  }

  async findById(id: number): Promise<Changelog | null> {
    return this.changelogRepository.findOne({
      where: { id },
    });
  }

  // Revert functionality
  async revertChange(changelogId: number, userId: string): Promise<boolean> {
    try {
      const originalEntry = await this.changelogRepository.findOne({
        where: { id: changelogId },
      });

      if (!originalEntry || !originalEntry.changeData) {
        throw new NotFoundException('Changelog entry not found');
      }

      const changelogData = originalEntry.changeData as ChangelogData;
      const {
        action,
        entityType,
        entityId,
        entityName,
      } = changelogData;

      if (!changelogData.isRevertible || !entityId) {
        throw new Error('This change cannot be reverted');
      }

      // For now, we'll just log the revert request but not actually perform it
      // The actual revert logic should be implemented in the resolver level
      // where we can inject the appropriate services
      throw new Error('Revert functionality should be implemented in the resolver layer');

    } catch (error) {
      console.error('Failed to revert change:', error);
      throw error;
    }
  }

  // Helper function to check if a change can be reverted
  canRevertChange(changelogData: ChangelogData): boolean {
    return !!(
      changelogData.isRevertible &&
      changelogData.entityId &&
      changelogData.fullDataBefore &&
      !changelogData.revertedFromId && // Don't allow reverting reverts
      [ChangeAction.UPDATE, ChangeAction.TOGGLE, ChangeAction.DELETE].includes(
        changelogData.action,
      )
    );
  }
}
