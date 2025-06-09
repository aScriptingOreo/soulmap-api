import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean } from 'class-validator';

@InputType()
export class CreateCategoryInput {
  @Field()
  @IsString()
  categoryName: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hiddenByDefault?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  path?: string; // Path field for category organization
}
