import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { Category } from '../../categories/entities/category.entity';

@ObjectType()
export class Coordinate {
  @Field(() => Float)
  x: number;

  @Field(() => Float)
  y: number;
}

@Entity('locations')
@ObjectType()
export class Location {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id: string;

  @Column()
  @Field()
  locationName: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  @Field(() => [Coordinate], { nullable: true })
  coordinates?: Coordinate[];

  @Column({ name: 'categoryId', nullable: true })
  categoryId?: string;

  @ManyToOne(() => Category, { eager: true })
  @JoinColumn({ name: 'categoryId' })
  @Field(() => Category, { nullable: true })
  category?: Category;

  @Column({ nullable: true })
  @Field({ nullable: true })
  icon?: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0, nullable: true })
  @Field(() => Float, { nullable: true })
  iconSize?: number;

  @Column({ nullable: true })
  @Field({ nullable: true })
  mediaUrl?: string;

  @Column({ nullable: true, default: '#000000' })
  @Field({ nullable: true })
  iconColor?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, nullable: true })
  @Field(() => Float, { nullable: true })
  radius?: number;

  @Column({ default: false })
  @Field()
  noCluster: boolean;

  @Column({ type: 'jsonb', default: '[]' })
  @Field(() => [String])
  versions: string[]; // New: Array of version strings

  @Column({ nullable: true })
  @Field({ nullable: true })
  createdBy?: string;

  @Column({ nullable: true })
  @Field({ nullable: true })
  lastUpdateBy?: string;

  @CreateDateColumn()
  @Field()
  createdAt: Date;

  @UpdateDateColumn()
  @Field()
  updatedAt: Date;
}
