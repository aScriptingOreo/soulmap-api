import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { CategoriesResolver } from './categories.resolver';
import { Category } from './category.entity';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Category]), RedisModule, AuthModule],
  providers: [CategoriesService, CategoriesResolver],
  exports: [CategoriesService],
})
export class CategoriesModule {}
