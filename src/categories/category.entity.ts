import { Field, ObjectType } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@ObjectType()
@Entity('categories')
export class Category {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ name: 'categoryName', type: 'text', unique: true })
  categoryName: string;

  @Field()
  @Column({ type: 'boolean', default: false })
  hiddenByDefault: boolean;
}
