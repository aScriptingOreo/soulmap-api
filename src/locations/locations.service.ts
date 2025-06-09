import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './location.entity';
import { CreateLocationInput } from './dto/create-location.input';
import { UpdateLocationInput } from './dto/update-location.input';
import { Category } from '../categories/category.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationsRepository: Repository<Location>,
    @InjectRepository(Category)
    private categoriesRepository: Repository<Category>,
    private redisService: RedisService,
  ) {}

  async ensureCategory(categoryIdOrName: string): Promise<string> {
    // First, try to find by ID
    let category = await this.categoriesRepository.findOne({ where: { id: categoryIdOrName } });
    
    if (category) {
      return category.id;
    }

    // If not found by ID, try to find by name
    category = await this.categoriesRepository.findOne({ where: { categoryName: categoryIdOrName } });
    
    if (category) {
      return category.id;
    }

    // If still not found, create new category
    const newCategory = this.categoriesRepository.create({
      categoryName: categoryIdOrName,
      hiddenByDefault: false,
    });

    const savedCategory = await this.categoriesRepository.save(newCategory);
    return savedCategory.id;
  }

  async getOrCreateUncategorized(): Promise<string> {
    let uncategorized = await this.categoriesRepository.findOne({ 
      where: { categoryName: 'Uncategorized' } 
    });

    if (!uncategorized) {
      uncategorized = this.categoriesRepository.create({
        categoryName: 'Uncategorized',
        hiddenByDefault: false,
      });
      uncategorized = await this.categoriesRepository.save(uncategorized);
    }

    return uncategorized.id;
  }

  async create(locationInput: CreateLocationInput, userId: string): Promise<Location> {
    console.log('LocationsService.create called with:', locationInput);
    
    // The category should already be a valid UUID at this point
    // since the frontend handles category creation
    let categoryId = locationInput.category;
    
    // Fallback: if no category provided, use uncategorized
    if (!categoryId) {
      categoryId = await this.getOrCreateUncategorized();
    }

    // Validate that the category exists
    const category = await this.categoriesRepository.findOne({ where: { id: categoryId } });
    if (!category) {
      throw new Error(`Category with ID ${categoryId} not found`);
    }

    // Handle versions - default to ['latest'] if not provided
    const versions = locationInput.versions && locationInput.versions.length > 0 
      ? locationInput.versions 
      : ['latest'];

    const locationData = {
      locationName: locationInput.locationName,
      description: locationInput.description,
      coordinates: locationInput.coordinates,
      categoryId,
      icon: locationInput.icon,
      iconSize: locationInput.iconSize,
      mediaUrl: locationInput.mediaUrl,
      iconColor: locationInput.iconColor,
      radius: locationInput.radius,
      noCluster: locationInput.noCluster || false,
      versions, // Add versions support
      createdBy: userId,
      lastUpdateBy: userId,
    };

    console.log('Creating location with data:', locationData);

    const newLocation = this.locationsRepository.create(locationData);
    const savedLocation = await this.locationsRepository.save(newLocation);

    // Invalidate cache
    await this.redisService.del('all_locations');
    await this.redisService.del('recent_locations:*');

    // Return with category relation loaded
    const result = await this.locationsRepository.findOne({
      where: { id: savedLocation.id },
      relations: ['category'],
    });

    if (!result) {
      throw new Error('Failed to retrieve created location');
    }

    return result;
  }

  async update(id: string, locationInput: UpdateLocationInput, userId: string): Promise<Location> {
    const location = await this.locationsRepository.findOne({ where: { id } });
    
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    // Handle category update if provided
    let categoryId = location.categoryId;
    if (locationInput.category) {
      categoryId = await this.ensureCategory(locationInput.category);
    }

    // Handle versions - keep existing if not provided
    const versions = locationInput.versions !== undefined 
      ? (locationInput.versions.length > 0 ? locationInput.versions : ['latest'])
      : location.versions || ['latest'];

    const updateData = {
      locationName: locationInput.locationName,
      description: locationInput.description,
      coordinates: locationInput.coordinates,
      categoryId,
      icon: locationInput.icon,
      iconSize: locationInput.iconSize,
      mediaUrl: locationInput.mediaUrl,
      iconColor: locationInput.iconColor,
      radius: locationInput.radius,
      noCluster: locationInput.noCluster,
      versions, // Add versions support
      lastUpdateBy: userId,
      // Preserve createdBy
      createdBy: location.createdBy,
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    await this.locationsRepository.update(id, updateData);

    // Invalidate cache
    await this.redisService.del('all_locations');
    await this.redisService.del('recent_locations:*');

    const result = await this.locationsRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!result) {
      throw new NotFoundException(`Location with ID ${id} not found after update`);
    }

    return result;
  }

  async findAll(): Promise<Location[]> {
    const cacheKey = 'all_locations';
    const cachedLocations = await this.redisService.get<Location[]>(cacheKey);

    if (cachedLocations) {
      return cachedLocations;
    }

    const locations = await this.locationsRepository.find({
      relations: ['category'],
      order: {
        createdAt: 'DESC',
      },
    });

    await this.redisService.set(cacheKey, locations, 300); // Cache for 5 minutes

    return locations;
  }

  async findOne(id: string): Promise<Location> {
    const location = await this.locationsRepository.findOne({
      where: { id },
      relations: ['category'],
    });

    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    return location;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.locationsRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    // Invalidate cache
    await this.redisService.del('all_locations');
    await this.redisService.del('recent_locations:*');

    return true;
  }

  // Add new version-aware query methods
  async findByVersion(version: string): Promise<Location[]> {
    return this.locationsRepository
      .createQueryBuilder('location')
      .leftJoinAndSelect('location.category', 'category')
      .where(
        version === 'latest' 
          ? 'location.versions @> :latestVersion OR location.versions @> :specificVersion'
          : 'location.versions @> :specificVersion',
        { 
          latestVersion: JSON.stringify(['latest']),
          specificVersion: JSON.stringify([version])
        }
      )
      .orderBy('location.createdAt', 'DESC')
      .getMany();
  }

  async findByCategory(categoryId: string): Promise<Location[]> {
    return this.locationsRepository.find({
      where: { categoryId },
      relations: ['category'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByCategoryAndVersion(categoryId: string, version: string): Promise<Location[]> {
    return this.locationsRepository
      .createQueryBuilder('location')
      .leftJoinAndSelect('location.category', 'category')
      .where('location.categoryId = :categoryId', { categoryId })
      .andWhere(
        version === 'latest' 
          ? 'location.versions @> :latestVersion OR location.versions @> :specificVersion'
          : 'location.versions @> :specificVersion',
        { 
          latestVersion: JSON.stringify(['latest']),
          specificVersion: JSON.stringify([version])
        }
      )
      .orderBy('location.createdAt', 'DESC')
      .getMany();
  }

  async getUsedVersions(): Promise<string[]> {
    const result = await this.locationsRepository
      .createQueryBuilder('location')
      .select('DISTINCT jsonb_array_elements_text(location.versions)', 'version')
      .getRawMany();

    return result.map(row => row.version).filter(v => v).sort();
  }
}
