import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Icon {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  path: string;

  @Field()
  category: string;

  @Field()
  url: string;

  @Field({ nullable: true })
  size?: number;

  @Field()
  createdAt: Date;
}
