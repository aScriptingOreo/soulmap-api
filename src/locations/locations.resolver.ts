import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { Location } from './location.entity';
import { CreateLocationInput } from './dto/create-location.input';
import { UpdateLocationInput } from './dto/update-location.input';
import { NearbyLocationInput } from './dto/nearby-location.input';
import { ApiKeyGuard } from '../auth/api-key.guard';

@Resolver(() => Location)
export class LocationsResolver {
  constructor(private locationsService: LocationsService) {}

  @Query(() => [Location])
  async locations(): Promise<Location[]> {
    return this.locationsService.findAll();
  }

  @Query(() => Location)
  async location(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Location> {
    return this.locationsService.findOne(id);
  }

  @Query(() => [Location])
  async nearbyLocations(
    @Args('nearbyInput') nearbyInput: NearbyLocationInput,
  ): Promise<Location[]> {
    const { longitude, latitude, radius } = nearbyInput;
    return this.locationsService.findNearby(longitude, latitude, radius);
  }

  @Mutation(() => Location, {
    description: `
      Create a new location. Examples for coordinates:
      - Single marker: [37.7749, -122.4194]
      - Multiple markers: [[37.7749, -122.4194], [40.7128, -74.0060], [34.0522, -118.2437]]
      Requires API key in x-api-key header.
    `,
  })
  @UseGuards(ApiKeyGuard)
  async createLocation(
    @Args('createLocationInput') createLocationInput: CreateLocationInput,
  ): Promise<Location> {
    return this.locationsService.create(createLocationInput);
  }

  @Mutation(() => Location)
  @UseGuards(ApiKeyGuard)
  async updateLocation(
    @Args('updateLocationInput') updateLocationInput: UpdateLocationInput,
  ): Promise<Location> {
    return this.locationsService.update(
      updateLocationInput.id,
      updateLocationInput,
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(ApiKeyGuard)
  async removeLocation(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.locationsService.remove(id);
  }
}
