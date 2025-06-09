import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './category.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private redisService: RedisService,
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

  async create(categoryData: Partial<Category>): Promise<Category> {
    const newCategory = this.categoriesRepository.create(categoryData);
    const savedCategory = await this.categoriesRepository.save(newCategory);

    // Invalidate cache
    await this.redisService.del('all_categories');

    return savedCategory;
  }

  async update(id: string, categoryData: Partial<Category>): Promise<Category> {
    const category = await this.findOne(id);

    // Update entity
    Object.assign(category, categoryData);
    const updatedCategory = await this.categoriesRepository.save(category);

    // Invalidate cache
    await this.redisService.del(`category:${id}`);
    await this.redisService.del('all_categories');

    return updatedCategory;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.categoriesRepository.delete(id);

    // Invalidate cache
    await this.redisService.del(`category:${id}`);
    await this.redisService.del('all_categories');

    return (result.affected ?? 0) > 0;
  }

  async findByName(categoryName: string): Promise<Category | null> {
    return await this.categoriesRepository.findOne({
      where: { categoryName },
    });
  }

  async findOrCreateByName(categoryName: string): Promise<Category> {
    // First try to find existing category
    let category = await this.findByName(categoryName);

    if (!category) {
      // Create new category if it doesn't exist
      category = await this.create({ categoryName });

      // Log category creation for audit purposes
      console.log(
        `Created new category: ${categoryName} with ID: ${category.id}`,
      );
    }

    return category;
  }

  async getDefaultCategory(): Promise<Category> {
    let defaultCategory = await this.findByName('!NOCAT');

    if (!defaultCategory) {
      // Create default category if it doesn't exist
      defaultCategory = await this.create({
        categoryName: '!NOCAT',
        hiddenByDefault: true,
      });
    }

    return defaultCategory;
  }
}
