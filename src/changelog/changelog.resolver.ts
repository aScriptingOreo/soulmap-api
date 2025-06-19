/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
  Context,
  ID,
} from '@nestjs/graphql';
import { UseGuards, NotFoundException } from '@nestjs/common';
import { ChangelogService } from './changelog.service';
import { LocationsService } from '../locations/locations.service';
import { CategoriesService } from '../categories/categories.service';
import { Changelog } from './changelog.entity';
import { CreateChangelogInput } from './dto/create-changelog.input';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChangeAction, EntityType, ChangelogData } from './changelog.types';

@Resolver(() => Changelog)
export class ChangelogResolver {
  constructor(
    private changelogService: ChangelogService,
    private locationsService: LocationsService,
    private categoriesService: CategoriesService,
  ) {}

  @Query(() => [Changelog])
  async changelog(): Promise<Changelog[]> {
    return this.changelogService.findAll();
  }

  @Query(() => [Changelog])
  async recentChanges(
    @Args('limit', { type: () => Int }) limit: number,
  ): Promise<Changelog[]> {
    return this.changelogService.findRecent(limit);
  }

  @Mutation(() => Changelog)
  @UseGuards(JwtAuthGuard)
  async createChangelogEntry(
    @Args('createChangelogInput') createChangelogInput: CreateChangelogInput,
    @Context() context: any,
  ): Promise<Changelog> {
    const userId = context.req.user.userId; // Get from JWT payload
    const entry = await this.changelogService.create(
      createChangelogInput,
      userId,
    );
    return entry;
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async revertChange(
    @Args('changelogId', { type: () => ID }) changelogId: number,
    @Context() context: any,
  ): Promise<boolean> {
    const userId = context.req.user.userId; // Get from JWT payload

    try {
      // Get the changelog entry
      const originalEntry = await this.changelogService.findById(changelogId);

      if (!originalEntry || !originalEntry.changeData) {
        throw new NotFoundException('Changelog entry not found');
      }

      const changelogData = originalEntry.changeData as ChangelogData;
      const {
        action,
        entityType,
        entityId,
        entityName,
        fullDataBefore,
        fullDataAfter,
      } = changelogData;

      if (!changelogData.isRevertible || !entityId) {
        throw new Error('This change cannot be reverted');
      }

      let revertAction: ChangeAction;
      let revertData: any;

      switch (action) {
        case ChangeAction.CREATE:
          // For create operations, we would need to "delete" the entity
          throw new Error(
            'Cannot revert create operations - deletion not implemented',
          );

        case ChangeAction.DELETE:
          // For delete operations, recreate the entity with the original data
          revertAction = ChangeAction.CREATE;
          revertData = fullDataBefore;
          if (!revertData) {
            throw new Error(
              'Cannot revert delete operation - original data not available',
            );
          }
          break;

        case ChangeAction.UPDATE:
        case ChangeAction.TOGGLE:
          // For update/toggle operations, restore the previous state
          revertAction = ChangeAction.UPDATE;
          revertData = fullDataBefore;
          break;

        default:
          throw new Error(`Cannot revert ${action} operations`);
      }

      // Perform the revert operation
      if (revertAction === ChangeAction.CREATE) {
        // Recreate the deleted entity
        if (entityType === EntityType.LOCATION) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...createData } = revertData;
          await this.locationsService.create(
            {
              ...createData,
              category: createData.categoryId || createData.category,
            },
            userId,
          );
        } else if (entityType === EntityType.CATEGORY) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, ...createData } = revertData;
          await this.categoriesService.create(createData, userId);
        }
      } else if (revertAction === ChangeAction.UPDATE) {
        // Update the existing entity
        if (entityType === EntityType.LOCATION) {
          await this.locationsService.update(
            entityId,
            {
              ...revertData,
              category: revertData.categoryId || revertData.category,
            },
            userId,
          );
        } else if (entityType === EntityType.CATEGORY) {
          await this.categoriesService.update(entityId, revertData, userId);
        }
      }

      // Log the revert action
      await this.changelogService.logChange(
        revertAction,
        entityType,
        {
          entityId:
            revertAction === ChangeAction.CREATE ? 'recreated' : entityId,
          entityName,
          oldData: action === ChangeAction.DELETE ? null : fullDataAfter,
          newData: fullDataBefore,
          metadata: {
            isRevert: true,
            originalAction: action,
            revertReason: `Reverted ${action} operation`,
          },
          revertedFromId: changelogId,
        },
        userId,
      );

      console.log(
        `Successfully reverted ${action} on ${entityType} ${entityId}`,
      );
      return true;
    } catch (error) {
      console.error('Failed to revert change:', error);
      throw error;
    }
  }
}
