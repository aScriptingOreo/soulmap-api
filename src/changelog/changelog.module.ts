import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangelogService } from './changelog.service';
import { ChangelogResolver } from './changelog.resolver';
import { Changelog } from './changelog.entity';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Changelog]), RedisModule],
  providers: [ChangelogService, ChangelogResolver],
  exports: [ChangelogService],
})
export class ChangelogModule {}
