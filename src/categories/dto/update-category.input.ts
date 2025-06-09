import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

@InputType()
export class UpdateCategoryInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsUUID()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  categoryName?: string;

  @Field({ nullable: true })
  @IsOptional()
  hiddenByDefault?: boolean;
}
