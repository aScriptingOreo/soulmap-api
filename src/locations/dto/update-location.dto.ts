import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsArray, IsNumber, IsBoolean } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class UpdateLocationInput {
  @Field(() => ID)
  @IsNotEmpty()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  locationName?: string;

  @Field({ nullable: true })
  @IsOptional()
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  coordinates?: any; // Accept any JSON format

  @Field({ nullable: true })
  @IsOptional()
  category?: string; // Category ID

  @Field({ nullable: true })
  @IsOptional()
  icon?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  iconSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  mediaUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  iconColor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  radius?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  noCluster?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  versions?: string[]; // New: Array of version strings
}
