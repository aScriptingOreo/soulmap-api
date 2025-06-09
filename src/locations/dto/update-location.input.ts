import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { CreateLocationInput } from './create-location.input';

@InputType()
export class UpdateLocationInput extends PartialType(CreateLocationInput) {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  versions?: string[]; // New: Array of version strings

  // Inherits all fields from CreateLocationInput as optional
  // createdBy is not included, lastUpdateBy will be handled automatically
}
