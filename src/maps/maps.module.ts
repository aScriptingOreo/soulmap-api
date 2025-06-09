import { Module } from '@nestjs/common';
import { MapsResolver } from './maps.resolver';
import { MapsController } from './maps.controller';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [S3Module],
  providers: [MapsResolver],
  controllers: [MapsController],
})
export class MapsModule {}
