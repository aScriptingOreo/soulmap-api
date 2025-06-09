import { Module } from '@nestjs/common';
import { IconsService } from './icons.service';
import { IconsController } from './icons.controller';
import { IconsResolver } from './icons.resolver';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RedisModule, AuthModule],
  controllers: [IconsController],
  providers: [IconsService, IconsResolver],
  exports: [IconsService],
})
export class IconsModule {}
