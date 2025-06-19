import { Field, ObjectType, ID } from '@nestjs/graphql';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Location } from '../locations/location.entity';

@ObjectType()
@Entity('categories')
export class Category {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ unique: true })
  categoryName: string;

  @Field({ defaultValue: false })
  @Column({ default: false })
  hiddenByDefault: boolean;

  @Field({ defaultValue: false })
  @Column({ default: false })
  isDisabled: boolean; // New: Control whether category is disabled

  @Field({ nullable: true })
  @Column({ type: 'varchar', length: 500, nullable: true })
  path?: string;

  @Field(() => [Location], { nullable: true })
  @OneToMany(() => Location, location => location.category)
  locations?: Location[];

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
