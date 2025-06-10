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

  async findOrCreate(categoryName: string): Promise<Category> {
    // Try to find existing category
    let category = await this.categoriesRepository.findOne({
      where: { categoryName },
    });

    if (category) {
      return category;
    }

    // Create new category if not found
    const newCategory = this.categoriesRepository.create({
      categoryName,
      hiddenByDefault: false,
    });

    return this.categoriesRepository.save(newCategory);
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
