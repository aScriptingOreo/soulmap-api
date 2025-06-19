import { Field, ObjectType, Int } from '@nestjs/graphql';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import GraphQLJSON from 'graphql-type-json';

@ObjectType()
@Entity('changelog')
export class Changelog {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id: number;

  @Field()
  @Column({ name: 'changeType', type: 'varchar', length: 100 })
  changeType: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Column({ name: 'changeData', type: 'json', nullable: true })
  changeData: any;

  @Field()
  @Column({ name: 'modifiedBy', type: 'text' })
  modifiedBy: string;

  @Field()
  @CreateDateColumn({ type: 'timestamp' })
  timestamp: Date;
}
