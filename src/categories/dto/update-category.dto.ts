import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

@InputType()
export class UpdateCategoryInput {
  @Field(() => ID)
  @IsNotEmpty()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  categoryName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hiddenByDefault?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  path?: string; // New: Category path
}
