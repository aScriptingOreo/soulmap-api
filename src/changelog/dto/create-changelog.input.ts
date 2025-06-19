import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { ChangeAction, EntityType } from '../changelog.types';

@InputType()
export class CreateChangelogInput {
  @Field(() => ChangeAction)
  @IsNotEmpty()
  @IsEnum(ChangeAction)
  action: ChangeAction;

  @Field(() => EntityType)
  @IsNotEmpty()
  @IsEnum(EntityType)
  entityType: EntityType;

  @Field({ nullable: true })
  @IsOptional()
  entityId?: string;

  @Field({ nullable: true })
  @IsOptional()
  entityName?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  changeData?: any;
}
