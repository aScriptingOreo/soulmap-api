import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Entity('categories')
@ObjectType()
export class Category {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column({ unique: true })
  @Field()
  categoryName: string;

  @Column({ default: false })
  @Field()
  hiddenByDefault: boolean;

  @Column({ nullable: true })
  @Field({ nullable: true })
  path?: string; // New: Category path for organization

  @CreateDateColumn()
  @Field()
  createdAt: Date;

  @UpdateDateColumn()
  @Field()
  updatedAt: Date;
}
