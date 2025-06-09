import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Context,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { Location } from './location.entity';
import { CreateLocationInput } from './dto/create-location.input';
import { UpdateLocationInput } from './dto/update-location.input';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Resolver(() => Location)
export class LocationsResolver {
  constructor(private locationsService: LocationsService) {}

  @Query(() => [Location])
  async locations(): Promise<Location[]> {
    return this.locationsService.findAll();
  }

  @Query(() => [Location], { name: 'locationsByVersion' })
  findByVersion(@Args('version') version: string) {
    return this.locationsService.findByVersion(version);
  }

  @Query(() => [Location], { name: 'locationsByCategory' })
  findByCategory(@Args('categoryId') categoryId: string) {
    return this.locationsService.findByCategory(categoryId);
  }

  @Query(() => [Location], { name: 'locationsByCategoryAndVersion' })
  findByCategoryAndVersion(
    @Args('categoryId') categoryId: string,
    @Args('version') version: string
  ) {
    return this.locationsService.findByCategoryAndVersion(categoryId, version);
  }

  @Query(() => [String], { name: 'usedMapVersions' })
  getUsedVersions() {
    return this.locationsService.getUsedVersions();
  }

  @Query(() => Location)
  async location(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Location> {
    return this.locationsService.findOne(id);
  }

  @Mutation(() => Location, {
    description: `
      Create a new location. Examples for coordinates:
      - Single marker: [37.7749, -122.4194]
      - Multiple markers: [[37.7749, -122.4194], [40.7128, -74.0060], [34.0522, -118.2437]]
      Requires API key in x-api-key header.
    `,
  })
  @UseGuards(JwtAuthGuard)
  async createLocation(
    @Args('createLocationInput') createLocationInput: CreateLocationInput,
    @Context() context: any,
  ): Promise<Location> {
    const userId = context.req.user.userId; // Get from JWT payload
    console.log('Creating location with input:', createLocationInput);
    console.log('User ID:', userId);
    return this.locationsService.create(createLocationInput, userId);
  }

  @Mutation(() => Location)
  @UseGuards(JwtAuthGuard)
  async updateLocation(
    @Args('updateLocationInput') updateLocationInput: UpdateLocationInput,
    @Context() context: any,
  ): Promise<Location> {
    const userId = context.req.user.userId; // Get from JWT payload
    return this.locationsService.update(updateLocationInput.id, updateLocationInput, userId);
  }

  @Mutation(() => Boolean)
  @UseGuards(JwtAuthGuard)
  async removeLocation(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.locationsService.remove(id);
  }
}
