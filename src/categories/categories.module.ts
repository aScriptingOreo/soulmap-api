import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { CategoriesResolver } from './categories.resolver';
import { Category } from './category.entity';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category]), RedisModule],
  providers: [CategoriesService, CategoriesResolver],
  exports: [CategoriesService],
})
export class CategoriesModule {}
