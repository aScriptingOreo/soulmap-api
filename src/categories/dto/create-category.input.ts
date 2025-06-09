import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional } from 'class-validator';

@InputType()
export class CreateCategoryInput {
  @Field()
  @IsNotEmpty()
  categoryName: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  hiddenByDefault?: boolean;
}
