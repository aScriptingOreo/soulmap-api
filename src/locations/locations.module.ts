import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LocationsService } from './locations.service';
import { LocationsResolver } from './locations.resolver';
import { Location } from './location.entity';
import { Category } from '../categories/category.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { ChangelogModule } from '../changelog/changelog.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Location, Category]),
    AuthModule,
    RedisModule,
    forwardRef(() => ChangelogModule),
  ],
  providers: [LocationsResolver, LocationsService],
  exports: [LocationsService],
})
export class LocationsModule {}
