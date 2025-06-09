import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ObjectType, Field, ID } from '@nestjs/graphql';

@Entity('categories') // lowercase table name
@Index('idx_categories_path', ['path'])
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

  @Column({ nullable: true, length: 500 })
  @Field({ nullable: true })
  path?: string; // Path field for category organization

  @CreateDateColumn()
  @Field()
  createdAt: Date;

  @UpdateDateColumn()
  @Field()
  updatedAt: Date;
}
