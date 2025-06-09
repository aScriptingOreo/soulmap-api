import { InputType, Field, Float, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { GraphQLJSON } from 'graphql-type-json';

@InputType()
export class UpdateLocationInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  locationName?: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description:
      'Leaflet coordinates: [X,Y] for a single marker or [[X,Y],[X1,Y1],...] for multiple markers with the same properties',
  })
  @IsOptional()
  coordinates?: number[] | number[][];

  @Field({ nullable: true })
  @IsOptional()
  description?: string;

  @Field({ nullable: true, description: 'Category name - will be created if it does not exist' })
  @IsOptional()
  categoryName?: string;

  @Field({ nullable: true })
  @IsOptional()
  icon?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  data?: Record<string, any>;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  iconSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  mediaUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  iconColor?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  radius?: number;

  @Field({ nullable: true })
  @IsOptional()
  cluster?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  lastUpdateBy?: string;
}
