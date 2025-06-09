import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Changelog } from './changelog.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ChangelogService {
  constructor(
    @InjectRepository(Changelog)
    private changelogRepository: Repository<Changelog>,
    private redisService: RedisService,
  ) {}

  async findAll(): Promise<Changelog[]> {
    return this.changelogRepository.find({
      order: {
        timestamp: 'DESC',
      },
    });
  }

  async findRecent(limit: number): Promise<Changelog[]> {
    const cacheKey = `recent_changelog:${limit}`;
    const cachedChanges = await this.redisService.get<Changelog[]>(cacheKey);

    if (cachedChanges) {
      return cachedChanges;
    }

    const changes = await this.changelogRepository.find({
      order: {
        timestamp: 'DESC',
      },
      take: limit,
    });

    // Cache for a shorter period since changelog may update frequently
    await this.redisService.set(cacheKey, changes, 300); // 5 minutes

    return changes;
  }

  async create(changelogData: Partial<Changelog>, userId: string): Promise<Changelog> {
    const newEntry = this.changelogRepository.create({
      ...changelogData,
      modifiedBy: userId, // Set from authenticated user
    });
    const savedEntry = await this.changelogRepository.save(newEntry);

    // Invalidate recent changelog cache with different limits
    await this.redisService.del('recent_changelog:10');
    await this.redisService.del('recent_changelog:20');
    await this.redisService.del('recent_changelog:50');

    return savedEntry;
  }
}
