import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService implements OnModuleInit {
  private redisClient: RedisClientType;

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initRedisClient();
  }

  private async initRedisClient(): Promise<void> {
    this.redisClient = createClient({
      url: `redis://${this.configService.get('REDIS_HOST', 'localhost')}:${this.configService.get('REDIS_PORT', 6379)}`,
      password: this.configService.get('REDIS_PASSWORD'),
    }) as RedisClientType;

    this.redisClient.on('error', (err) =>
      console.error('Redis Client Error', err),
    );
    await this.redisClient.connect();
  }

  // General cache methods using cache-manager
  async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  async set(key: string, value: unknown, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  // Geospatial methods using Redis native client
  async geoAdd(
    key: string,
    longitude: number,
    latitude: number,
    member: string,
  ): Promise<number> {
    return await this.redisClient.geoAdd(key, {
      longitude,
      latitude,
      member,
    });
  }

  async geoRadius(
    key: string,
    longitude: number,
    latitude: number,
    radius: number,
    unit: 'km' | 'm' | 'mi' | 'ft' = 'km',
  ): Promise<string[]> {
    const result = await this.redisClient.geoRadius(
      key,
      { longitude, latitude },
      radius,
      unit,
    );
    
    return result as string[];
  }

  // Pub/Sub functionality for real-time updates
  async publish(channel: string, message: string): Promise<number> {
    return await this.redisClient.publish(channel, message);
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void,
  ): Promise<void> {
    const subscriber = this.redisClient.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(channel, (message: string) => {
      callback(message);
    });
  }
}
