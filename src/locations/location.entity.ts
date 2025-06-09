import { Field, ObjectType, Float } from '@nestjs/graphql';
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
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
@Entity('locations')
export class Location {
  @Field()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ name: 'locationName', type: 'text' })
  locationName: string;

  @Field(() => GraphQLJSON, {
    description:
      'Leaflet coordinates: [X,Y] for a single marker or [[X,Y],[X1,Y1],...] for multiple markers with the same properties',
  })
  @Column({ type: 'jsonb', nullable: true })
  coordinates: number[] | number[][];

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field(() => Category, { nullable: true })
  @ManyToOne(() => Category, { eager: true, nullable: true })
  @JoinColumn({ name: 'category' })
  category?: Category;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  icon?: string;

  @Field(() => String, { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  data?: object;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true })
  iconSize?: number;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  mediaUrl?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  iconColor?: string;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true })
  radius?: number;

  @Field()
  @Column({ type: 'boolean', default: true })
  cluster: boolean;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  createdBy?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  lastUpdateBy?: string;

  @Field()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
