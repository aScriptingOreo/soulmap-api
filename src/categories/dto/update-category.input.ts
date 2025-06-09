import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

@InputType()
export class UpdateCategoryInput {
  @Field(() => ID)
  @IsString()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hiddenByDefault?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  path?: string; // Path field for category organization
}
