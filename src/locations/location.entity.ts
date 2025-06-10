import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
@Entity('locations')
export class Location {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column()
  locationName: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  coordinates?: any; // Raw JSON: [2612,3625] or [[3402,2356],[3589,2451]]

  @Field({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  categoryId?: string;

  @Field(() => Category, { nullable: true })
  @ManyToOne(() => Category, { nullable: true, eager: true })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @Field({ nullable: true })
  @Column({ nullable: true })
  icon?: string;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true, default: 1.0 })
  iconSize?: number;

  @Field({ nullable: true })
  @Column({ nullable: true })
  mediaUrl?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  iconColor?: string;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true, default: 0 })
  radius?: number;

  @Field({ defaultValue: false })
  @Column({ default: false })
  noCluster: boolean;

  @Field(() => [String], { nullable: true })
  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  versions?: string[];

  @Field({ nullable: true })
  @Column({ nullable: true })
  createdBy?: string;

  @Field({ nullable: true })
  @Column({ nullable: true })
  lastUpdateBy?: string;

  @Field()
  @CreateDateColumn()
  createdAt: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt: Date;
}
