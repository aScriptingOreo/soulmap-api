import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ChangelogService } from './changelog.service';
import { Changelog } from './changelog.entity';
import { CreateChangelogInput } from './dto/create-changelog.input';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Resolver(() => Changelog)
export class ChangelogResolver {
  constructor(private changelogService: ChangelogService) {}

  @Query(() => [Changelog])
  async changelog(): Promise<Changelog[]> {
    return this.changelogService.findAll();
  }

  @Query(() => [Changelog])
  async recentChanges(
    @Args('limit', { type: () => Int }) limit: number,
  ): Promise<Changelog[]> {
    return this.changelogService.findRecent(limit);
  }

  @Mutation(() => Changelog)
  @UseGuards(JwtAuthGuard)
  async createChangelogEntry(
    @Args('createChangelogInput') createChangelogInput: CreateChangelogInput,
  ): Promise<Changelog> {
    const entry = await this.changelogService.create(createChangelogInput);
    return entry;
  }
}
