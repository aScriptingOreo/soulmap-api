import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { CreateLocationInput } from './create-location.input';

@InputType()
export class UpdateLocationInput extends PartialType(CreateLocationInput) {
  @Field(() => ID)
  @IsString()
  id: string;

  // Inherits all fields from CreateLocationInput as optional
  // createdBy is not included, lastUpdateBy will be handled automatically
}
