import { InputType, Field, ID, PartialType, Float } from '@nestjs/graphql';
import { IsString, IsOptional, IsArray, IsNumber, IsBoolean } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class UpdateLocationInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  locationName?: string;

  @Field({ nullable: true }) 
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  coordinates?: any; // Raw JSON: [2612,3625] or [[3402,2356],[3589,2451]]

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  category?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  icon?: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  iconSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  iconColor?: string;

  @Field(() => Float, { nullable: true })
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
  versions?: string[];
}
