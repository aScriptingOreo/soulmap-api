import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangelogService } from './changelog.service';
import { ChangelogResolver } from './changelog.resolver';
import { Changelog } from './changelog.entity';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { LocationsModule } from '../locations/locations.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Changelog]),
    RedisModule,
    AuthModule,
    forwardRef(() => LocationsModule),
    forwardRef(() => CategoriesModule),
  ],
  providers: [ChangelogService, ChangelogResolver],
  exports: [ChangelogService],
})
export class ChangelogModule {}
