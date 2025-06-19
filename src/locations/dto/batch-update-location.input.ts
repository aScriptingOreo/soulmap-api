import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class BatchUpdateLocationInput {
  @Field(() => [ID])
  @IsArray()
  @IsNotEmpty()
  ids: string[];

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
  coordinates?: any; // JSON field

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  category?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  icon?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  iconColor?: string;

  @Field({ nullable: true })
  @IsOptional()
  iconSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @Field({ nullable: true })
  @IsOptional()
  radius?: number;

  @Field({ nullable: true })
  @IsOptional()
  noCluster?: boolean;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  versions?: string[];
}
