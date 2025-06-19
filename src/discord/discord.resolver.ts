import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DiscordBotService } from './discord-bot.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class DiscordUserInfo {
  @Field()
  id: string;

  @Field()
  username: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  avatar?: string;

  @Field({ nullable: true })
  avatarUrl?: string;
}

@Resolver()
export class DiscordResolver {
  constructor(private discordBotService: DiscordBotService) {}

  @Query(() => DiscordUserInfo, { nullable: true })
  @UseGuards(JwtAuthGuard)
  async discordUserInfo(
    @Args('userId') userId: string,
  ): Promise<DiscordUserInfo | null> {
    return this.discordBotService.getUserInfo(userId);
  }

  @Query(() => [DiscordUserInfo])
  @UseGuards(JwtAuthGuard)
  async discordUsersInfo(
    @Args('userIds', { type: () => [String] }) userIds: string[],
  ): Promise<DiscordUserInfo[]> {
    const usersInfo = await this.discordBotService.getBulkUserInfo(userIds);
    return Object.values(usersInfo);
  }
}
