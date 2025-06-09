import { InputType, Field } from '@nestjs/graphql';
import { IsNotEmpty, IsIn } from 'class-validator';

@InputType()
export class CreateChangelogInput {
  @Field()
  @IsNotEmpty()
  @IsIn(['Location', 'Category'])
  changeType: string;

  @Field()
  @IsNotEmpty()
  modifiedBy: string;
}
