import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { CategoriesResolver } from './categories.resolver';
import { Category } from './category.entity'; // Use the root category.entity.ts
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category]),
    AuthModule,
    RedisModule
  ],
  providers: [CategoriesResolver, CategoriesService],
  exports: [CategoriesService, TypeOrmModule],
})
export class CategoriesModule {}
