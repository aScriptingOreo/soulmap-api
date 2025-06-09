import { InputType, Field, ID, Float } from '@nestjs/graphql';
import { IsString, IsOptional, IsArray, IsBoolean, IsNumber } from 'class-validator';
import { CoordinateInput } from './create-location.input';

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

  @Field(() => [CoordinateInput], { nullable: true })
  @IsOptional()
  @IsArray()
  coordinates?: CoordinateInput[];

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

  @Field({ defaultValue: false })
  @IsOptional()
  @IsBoolean()
  noCluster?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  versions?: string[];
}
