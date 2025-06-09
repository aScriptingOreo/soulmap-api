import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsArray, IsNumber, IsBoolean, IsString } from 'class-validator';

@InputType()
export class CoordinateInput {
  @Field()
  @IsNumber()
  x: number;

  @Field()
  @IsNumber()
  y: number;
}

@InputType()
export class CreateLocationInput {
  @Field()
  @IsNotEmpty()
  locationName: string;

  @Field({ nullable: true })
  @IsOptional()
  description?: string;

  @Field(() => [CoordinateInput], { nullable: true })
  @IsOptional()
  @IsArray()
  coordinates?: CoordinateInput[];

  @Field()
  @IsNotEmpty()
  category: string; // Category ID

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
  versions?: string[]; // New: Array of version strings ['P10', 'P7', 'latest']
}
