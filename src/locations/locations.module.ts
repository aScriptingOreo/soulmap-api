import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsService } from './locations.service';
import { LocationsResolver } from './locations.resolver';
import { Location } from './location.entity';
import { RedisModule } from '../redis/redis.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Location]),
    RedisModule,
    CategoriesModule,
  ],
  providers: [LocationsService, LocationsResolver],
  exports: [LocationsService],
})
export class LocationsModule {}
