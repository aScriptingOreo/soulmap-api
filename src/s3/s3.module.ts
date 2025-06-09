import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { ConfigModule } from '../config/config.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
