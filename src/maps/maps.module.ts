import { Module } from '@nestjs/common';
import { MapsService } from './maps.service';
import { MapsResolver } from './maps.resolver';
import { MapsController } from './maps.controller';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [S3Module],
  controllers: [MapsController],
  providers: [MapsService, MapsResolver],
  exports: [MapsService],
})
export class MapsModule {}
