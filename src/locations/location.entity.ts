import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Category } from '../categories/category.entity';

@ObjectType()
export class Coordinate {
  @Field(() => Float)
  x: number;

  @Field(() => Float)
  y: number;
}

@ObjectType()
@Entity('locations')
export class Location {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({ name: 'locationname' })
  locationName: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  description?: string;

  @Field(() => [Coordinate], { nullable: true })
  @Column({ type: 'jsonb', nullable: true })
  coordinates?: Coordinate[];

  @Field(() => Category)
  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category' })
  category: Category;

  @Column({ name: 'category' })
  categoryId: string;

  @Field({ nullable: true })
  @Column({ type: 'text', nullable: true })
  icon?: string;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', name: 'iconsize', nullable: true })
  iconSize?: number;

  @Field({ nullable: true })
  @Column({ type: 'text', name: 'mediaurl', nullable: true })
  mediaUrl?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', name: 'iconcolor', nullable: true })
  iconColor?: string;

  @Field(() => Float, { nullable: true })
  @Column({ type: 'float', nullable: true })
  radius?: number;

  @Field()
  @Column({ type: 'boolean', name: 'nocluster', default: false })
  noCluster: boolean;

  @Field({ nullable: true })
  @Column({ type: 'text', name: 'createdby', nullable: true })
  createdBy?: string;

  @Field({ nullable: true })
  @Column({ type: 'text', name: 'lastupdateby', nullable: true })
  lastUpdateBy?: string;

  @Field()
  @CreateDateColumn({ name: 'createdat' })
  createdAt: Date;

  @Field()
  @UpdateDateColumn({ name: 'updatedat' })
  updatedAt: Date;
}
