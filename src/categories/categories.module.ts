import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { CategoriesResolver } from './categories.resolver';
import { Category } from './category.entity';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { ChangelogModule } from '../changelog/changelog.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Category]),
    RedisModule,
    AuthModule,
    forwardRef(() => ChangelogModule),
  ],
  providers: [CategoriesService, CategoriesResolver],
  exports: [CategoriesService],
})
export class CategoriesModule {}
