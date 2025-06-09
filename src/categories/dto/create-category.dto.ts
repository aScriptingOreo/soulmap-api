import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

@InputType()
export class CreateCategoryInput {
  @Field()
  @IsNotEmpty()
  categoryName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hiddenByDefault?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  path?: string; // New: Category path for organization
}
