import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisConfig = {
          store: redisStore as any,
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          ttl: 60 * 60, // default cache TTL: 1 hour
        };

        // Only add password if it exists
        const password = configService.get('REDIS_PASSWORD');
        if (password) {
          (redisConfig as any).password = password;
        }

        return redisConfig;
      },
      isGlobal: true,
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
