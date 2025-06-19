import { InputType, Field, ID } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsUUID, IsBoolean } from 'class-validator';

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
  @IsBoolean()
  hiddenByDefault?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean; // New: Allow updating disabled state

  @Field({ nullable: true })
  @IsOptional()
  path?: string; // Category path
}
