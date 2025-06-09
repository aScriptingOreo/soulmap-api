import { InputType, Field, Float } from '@nestjs/graphql';
import { IsNotEmpty, Min } from 'class-validator';

@InputType()
export class NearbyLocationInput {
  @Field(() => Float, { description: 'Longitude (X coordinate in Leaflet)' })
  @IsNotEmpty()
  longitude: number;

  @Field(() => Float, { description: 'Latitude (Y coordinate in Leaflet)' })
  @IsNotEmpty()
  latitude: number;

  @Field(() => Float, { description: 'Radius in kilometers' })
  @IsNotEmpty()
  @Min(0)
  radius: number;
}
