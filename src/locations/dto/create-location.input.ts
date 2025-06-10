import { InputType, Field, Float } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean, IsNumber, IsArray } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateLocationInput {
  @Field()
  @IsString()
  locationName: string;

  @Field({ nullable: true }) 
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  coordinates?: any; // Raw JSON: [2612,3625] or [[3402,

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

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  versions?: string[]; // New: Array of version strings ['P10', 'P7', 'latest']
}
