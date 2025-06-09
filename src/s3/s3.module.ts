import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
