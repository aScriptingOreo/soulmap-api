import { InputType, Field, Float } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

@InputType()
export class CoordinateInput {
  @Field(() => Float)
  @IsNumber()
  x: number;

  @Field(() => Float)
  @IsNumber()
  y: number;
}

@InputType()
export class CreateLocationInput {
  @Field()
  @IsString()
  locationName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => [CoordinateInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoordinateInput)
  coordinates?: CoordinateInput[];

  @Field()
  @IsString()
  category: string;

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
}
