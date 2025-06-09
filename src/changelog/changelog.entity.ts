import { Field, ObjectType, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@ObjectType()
@Entity('changelog')
export class Changelog {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ name: 'changeType', type: 'text' })
  changeType: string;

  @Field()
  @Column({ name: 'modifiedBy', type: 'text' })
  modifiedBy: string;

  @Field()
  @CreateDateColumn({ type: 'timestamp' })
  timestamp: Date;
}
