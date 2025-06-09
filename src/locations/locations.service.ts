import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Location } from './location.entity';
import { RedisService } from '../redis/redis.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateLocationInput } from './dto/create-location.input';
import { UpdateLocationInput } from './dto/update-location.input';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private locationsRepository: Repository<Location>,
    private redisService: RedisService,
    private categoriesService: CategoriesService,
  ) {}

  async findAll(): Promise<Location[]> {
    // Try to get from cache first
    const cachedLocations =
      await this.redisService.get<Location[]>('all_locations');
    if (cachedLocations) {
      return cachedLocations;
    }

    // If not in cache, get from DB and store in cache
    const locations = await this.locationsRepository.find();
    await this.redisService.set('all_locations', locations, 3600); // Cache for 1 hour
    return locations;
  }

  async findOne(id: string): Promise<Location> {
    const cacheKey = `location:${id}`;
    const cachedLocation = await this.redisService.get<Location>(cacheKey);
    if (cachedLocation) {
      return cachedLocation;
    }

    const location = await this.locationsRepository.findOne({ where: { id } });
    if (!location) {
      throw new NotFoundException(`Location with ID ${id} not found`);
    }

    await this.redisService.set(cacheKey, location, 3600);
    return location;
  }

  async create(locationInput: CreateLocationInput): Promise<Location> {
    // Convert input to entity format, excluding categoryName initially
    const { categoryName, ...inputWithoutCategory } = locationInput;

    const locationData: Partial<Location> = {
      ...inputWithoutCategory,
    };

    // Handle category assignment
    if (categoryName) {
      const category = await this.categoriesService.findOrCreateByName(categoryName);
      locationData.category = category;
    } else {
      // Use default category if no category specified
      const defaultCategory = await this.categoriesService.getDefaultCategory();
      locationData.category = defaultCategory;
    }

    const newLocation = this.locationsRepository.create(locationData);
    const savedLocation = await this.locationsRepository.save(newLocation);

    // Invalidate cache
    await this.redisService.del('all_locations');

    // Add to geospatial index if coordinates are provided
    if (savedLocation.coordinates) {
      await this.addToGeoIndex(savedLocation.coordinates, savedLocation.id);
    }

    // Publish update notification
    await this.redisService.publish(
      'location_updates',
      JSON.stringify({
        action: 'create',
        data: savedLocation,
      }),
    );

    return savedLocation;
  }

  async update(id: string, locationInput: UpdateLocationInput): Promise<Location> {
    const location = await this.findOne(id);

    // Convert input to entity format, excluding categoryName and id initially
    const { categoryName, id: inputId, ...inputWithoutCategory } = locationInput;

    const updateData: Partial<Location> = {
      ...inputWithoutCategory,
    };

    // Handle category assignment if provided
    if (categoryName) {
      const category = await this.categoriesService.findOrCreateByName(categoryName);
      updateData.category = category;
    }

    // Update entity
    Object.assign(location, updateData);
    const updatedLocation = await this.locationsRepository.save(location);

    // Invalidate cache
    await this.redisService.del(`location:${id}`);
    await this.redisService.del('all_locations');

    // Update geospatial index if coordinates changed
    if (updateData.coordinates) {
      await this.addToGeoIndex(updateData.coordinates, id);
    }

    return updatedLocation;
  }

  // Helper method to add coordinates to geo index
  private async addToGeoIndex(
    coordinates: number[] | number[][],
    id: string,
  ): Promise<void> {
    // Handle single point [X, Y]
    if (
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      typeof coordinates[0] === 'number'
    ) {
      const [y, x] = coordinates as number[]; // [lat, lng] format
      await this.redisService.geoAdd('locations_geo', x, y, id);
    }
    // Handle multiple points [[X,Y], [X1,Y1], ...]
    else if (
      Array.isArray(coordinates) &&
      coordinates.length > 0 &&
      Array.isArray(coordinates[0])
    ) {
      // Add each point to geo index with a unique identifier
      const multiPoints = coordinates as number[][];

      for (let i = 0; i < multiPoints.length; i++) {
        const [y, x] = multiPoints[i];
        // For multiple points, we add an index suffix to the ID
        const pointId = `${id}:${i}`;
        await this.redisService.geoAdd('locations_geo', x, y, pointId);
      }
    }
  }

  async findNearby(
    longitude: number,
    latitude: number,
    radius: number,
  ): Promise<Location[]> {
    // Use Redis geospatial search to find locations within radius
    const nearbyIds = await this.redisService.geoRadius(
      'locations_geo',
      longitude,
      latitude,
      radius,
      'km',
    );

    if (nearbyIds.length === 0) {
      return [];
    }

    // Extract the base IDs (remove the index suffixes)
    const baseIds = nearbyIds.map((id) => id.split(':')[0]);
    // Remove duplicates
    const uniqueIds = [...new Set(baseIds)];

    // Get full location data for the IDs
    return await this.locationsRepository.findByIds(uniqueIds);
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.locationsRepository.delete(id);

    // Invalidate cache
    await this.redisService.del(`location:${id}`);
    await this.redisService.del('all_locations');

    return (result.affected ?? 0) > 0;
  }
}
