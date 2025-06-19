import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { RedisService } from '../redis/redis.service';
import { ChangelogService } from '../changelog/changelog.service';
import { CategoryChangeData } from '../changelog/changelog.types';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private redisService: RedisService,
    @Inject(forwardRef(() => ChangelogService))
    private changelogService: ChangelogService,
  ) {}

  async findAll(): Promise<Category[]> {
    // Try to get from cache first
    const cachedCategories =
      await this.redisService.get<Category[]>('all_categories');
    if (cachedCategories) {
      return cachedCategories;
    }

    // If not in cache, get from DB and store in cache
    const categories = await this.categoriesRepository.find();
    await this.redisService.set('all_categories', categories, 3600);
    return categories;
  }

  async findOne(id: string): Promise<Category> {
    const cacheKey = `category:${id}`;
    const cachedCategory = await this.redisService.get<Category>(cacheKey);
    if (cachedCategory) {
      return cachedCategory;
    }

    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    await this.redisService.set(cacheKey, category, 3600);
    return category;
  }

  async findOneWithLocations(id: string): Promise<Category> {
    const cacheKey = `category_with_locations:${id}`;
    const cachedCategory = await this.redisService.get<Category>(cacheKey);
    if (cachedCategory) {
      return cachedCategory;
    }

    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['locations'],
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    await this.redisService.set(cacheKey, category, 1800); // 30 minutes cache
    return category;
  }

  async create(categoryData: Partial<Category>, userId: string): Promise<Category> {
    const newCategory = this.categoriesRepository.create(categoryData);
    const savedCategory = await this.categoriesRepository.save(newCategory);

    // Log creation to changelog
    const changelogData: CategoryChangeData = {
      id: savedCategory.id,
      categoryName: savedCategory.categoryName,
      hiddenByDefault: savedCategory.hiddenByDefault,
      isDisabled: savedCategory.isDisabled,
      path: savedCategory.path,
    };
    await this.changelogService.logCategoryCreate(changelogData, userId);

    // Invalidate cache
    await this.redisService.del('all_categories');

    return savedCategory;
  }

  async update(
    id: string,
    categoryData: Partial<Category>,
    userId: string,
  ): Promise<Category> {
    const category = await this.findOne(id);

    // Store old data for changelog
    const oldData: CategoryChangeData = {
      id: category.id,
      categoryName: category.categoryName,
      hiddenByDefault: category.hiddenByDefault,
      isDisabled: category.isDisabled,
      path: category.path,
    };

    // Update entity
    Object.assign(category, categoryData);
    const updatedCategory = await this.categoriesRepository.save(category);

    // Store new data for changelog
    const newData: CategoryChangeData = {
      id: updatedCategory.id,
      categoryName: updatedCategory.categoryName,
      hiddenByDefault: updatedCategory.hiddenByDefault,
      isDisabled: updatedCategory.isDisabled,
      path: updatedCategory.path,
    };

    // Log update to changelog
    await this.changelogService.logCategoryUpdate(
      id,
      updatedCategory.categoryName,
      oldData,
      newData,
      userId,
    );

    // Invalidate cache
    await this.redisService.del(`category:${id}`);
    await this.redisService.del('all_categories');

    return updatedCategory;
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const category = await this.categoriesRepository.findOne({
      where: { id },
      relations: ['locations'],
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    const locationsCount = category.locations?.length || 0;

    if (locationsCount > 0) {
      throw new Error(
        `Cannot delete category "${category.categoryName}". It contains ${locationsCount} location${
          locationsCount !== 1 ? 's' : ''
        }. Please move or delete all locations in this category before deleting it.`,
      );
    }

    // Store data for changelog
    const categoryData: CategoryChangeData = {
      id: category.id,
      categoryName: category.categoryName,
      hiddenByDefault: category.hiddenByDefault,
      isDisabled: category.isDisabled,
      path: category.path,
    };

    const result = await this.categoriesRepository.delete(id);

    // Log deletion to changelog
    await this.changelogService.logCategoryDelete(categoryData, userId);

    // Invalidate cache
    await this.redisService.del(`category:${id}`);
    await this.redisService.del('all_categories');

    return (result.affected ?? 0) > 0;
  }

  async getLocationCount(categoryId: string): Promise<number> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
      relations: ['locations'],
    });

    return category?.locations?.length || 0;
  }

  async findByName(categoryName: string): Promise<Category | null> {
    return await this.categoriesRepository.findOne({
      where: { categoryName },
    });
  }

  async findOrCreate(categoryName: string): Promise<Category> {
    // Try to find existing category
    const category = await this.categoriesRepository.findOne({
      where: { categoryName },
    });

    if (category) {
      return category;
    }

    // Create new category if not found
    const newCategory = this.categoriesRepository.create({
      categoryName,
      hiddenByDefault: false,
      isDisabled: false, // New: Set default disabled state
    });

    return this.categoriesRepository.save(newCategory);
  }

  async getDefaultCategory(userId: string = 'system'): Promise<Category> {
    let defaultCategory = await this.findByName('!NOCAT');

    if (!defaultCategory) {
      // Create default category if it doesn't exist
      defaultCategory = await this.create(
        {
          categoryName: '!NOCAT',
          hiddenByDefault: true,
          isDisabled: false, // New: Default categories should not be disabled
        },
        userId,
      );
    }

    return defaultCategory;
  }
}
