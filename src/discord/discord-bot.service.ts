/* eslint-disable @typescript-eslint/no-misused-promises */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, GatewayIntentBits, Guild, GuildMember } from 'discord.js';

@Injectable()
export class DiscordBotService implements OnModuleInit {
  private readonly logger = new Logger(DiscordBotService.name);
  private client: Client;
  private guild: Guild;

  constructor(private configService: ConfigService) {
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    });
  }

  async onModuleInit() {
    await this.initializeBot();
  }

  private async initializeBot() {
    const token = this.configService.get<string>('DISCORD_BOT_TOKEN');
    const serverId = this.configService.get<string>('DISCORD_SERVER_ID');

    if (!token) {
      this.logger.error('DISCORD_BOT_TOKEN not configured');
      return;
    }

    if (!serverId) {
      this.logger.error('DISCORD_SERVER_ID not configured');
      return;
    }

    this.client.once('ready', async () => {
      this.logger.log(`Discord bot logged in as ${this.client.user?.tag}`);

      try {
        this.guild = await this.client.guilds.fetch(serverId);
        this.logger.log(`Successfully connected to guild: ${this.guild.name}`);
      } catch (error) {
        this.logger.error(`Failed to fetch guild ${serverId}:`, error);
      }
    });

    this.client.on('error', (error) => {
      this.logger.error('Discord client error:', error);
    });

    try {
      await this.client.login(token);
    } catch (error) {
      this.logger.error('Failed to login to Discord:', error);
    }
  }

  async checkGuildMembership(userId: string): Promise<GuildMember | null> {
    if (!this.guild) {
      throw new Error('Discord bot not connected to guild');
    }

    try {
      const member = await this.guild.members.fetch(userId);
      return member;
    } catch (error) {
      this.logger.debug(`User ${userId} not found in guild:`, error.message);
      return null;
    }
  }

  async getUserRoles(userId: string): Promise<string[]> {
    const member = await this.checkGuildMembership(userId);

    if (!member) {
      return [];
    }

    return member.roles.cache.map((role) => role.id);
  }

  async hasRequiredRole(userId: string): Promise<boolean> {
    const adminRoleId = this.configService.get<string>('DISCORD_ADMIN_ROLE_ID');
    const managerRoleId = this.configService.get<string>(
      'DISCORD_MANAGER_ROLE_ID',
    );

    if (!adminRoleId && !managerRoleId) {
      this.logger.warn('No admin or manager role IDs configured');
      return false;
    }

    const userRoles = await this.getUserRoles(userId);

    const hasAdminRole = adminRoleId ? userRoles.includes(adminRoleId) : false;
    const hasManagerRole = managerRoleId
      ? userRoles.includes(managerRoleId)
      : false;

    return hasAdminRole || hasManagerRole;
  }

  async getGuildMemberInfo(userId: string): Promise<{
    isInGuild: boolean;
    roles: string[];
    hasPermission: boolean;
    username?: string;
    displayName?: string;
  }> {
    try {
      const member = await this.checkGuildMembership(userId);

      if (!member) {
        return {
          isInGuild: false,
          roles: [],
          hasPermission: false,
        };
      }

      const roles = member.roles.cache.map((role) => role.id);
      const hasPermission = await this.hasRequiredRole(userId);

      return {
        isInGuild: true,
        roles,
        hasPermission,
        username: member.user.username,
        displayName: member.displayName,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching guild member info for ${userId}:`,
        error,
      );
      return {
        isInGuild: false,
        roles: [],
        hasPermission: false,
      };
    }
  }
  

  isReady(): boolean {
    return this.client.isReady() && !!this.guild;
  }

  getClient(): Client {
    return this.client;
  }

  getGuild(): Guild | null {
    return this.guild;
  }

  async getUserInfo(userId: string): Promise<{
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    avatarUrl?: string;
  } | null> {
    try {
      // First try to get user from guild (more info available)
      const member = await this.checkGuildMembership(userId);

      if (member) {
        return {
          id: member.user.id,
          username: member.user.username,
          displayName: member.displayName,
          avatar: member.user.avatar || undefined,
          avatarUrl: member.user.displayAvatarURL({ size: 64 }),
        };
      }

      // If not in guild, try to fetch user directly
      const user = await this.client.users.fetch(userId);

      return {
        id: user.id,
        username: user.username,
        avatar: user.avatar || undefined,
        avatarUrl: user.displayAvatarURL({ size: 64 }),
      };
    } catch (error) {
      this.logger.error(`Error fetching user info for ${userId}:`, error);
      return null;
    }
  }

  async getBulkUserInfo(userIds: string[]): Promise<
    Record<
      string,
      {
        id: string;
        username: string;
        displayName?: string;
        avatar?: string;
        avatarUrl?: string;
      }
    >
  > {
    const result: Record<string, any> = {};

    // Remove duplicates
    const uniqueUserIds = [...new Set(userIds)];

    // Fetch user info for each ID
    for (const userId of uniqueUserIds) {
      if (userId) {
        const userInfo = await this.getUserInfo(userId);
        if (userInfo) {
          result[userId] = userInfo;
        }
      }
    }

    return result;
  }
}
