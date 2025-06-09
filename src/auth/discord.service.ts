import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscordBotService } from '../discord/discord-bot.service';
import * as jwt from 'jsonwebtoken';

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string;
}

@Injectable()
export class DiscordService {
  constructor(
    private configService: ConfigService,
    private discordBotService: DiscordBotService,
  ) {}

  getAuthUrl(): string {
    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');
    const redirectUri = this.configService.get<string>('DISCORD_REDIRECT_URI');
    
    if (!clientId || !redirectUri) {
      throw new Error('Discord client ID or redirect URI not configured');
    }
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify',
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    const clientId = this.configService.get<string>('DISCORD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('DISCORD_BOT_SECRET');
    const redirectUri = this.configService.get<string>('DISCORD_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Discord OAuth credentials not configured');
    }

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Token exchange failed:', errorData);
      throw new UnauthorizedException('Failed to exchange code for token');
    }

    const data = await response.json();
    return data.access_token;
  }

  async getUserInfo(accessToken: string): Promise<DiscordUser> {
    const response = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Failed to fetch user info');
    }

    return response.json();
  }

  async verifyGuildMembershipAndRoles(userId: string): Promise<{
    isInGuild: boolean;
    hasPermission: boolean;
    roles: string[];
  }> {
    if (!this.discordBotService.isReady()) {
      throw new Error('Discord bot is not ready');
    }

    const memberInfo = await this.discordBotService.getGuildMemberInfo(userId);
    
    if (!memberInfo.isInGuild) {
      throw new UnauthorizedException('User is not a member of the required Discord server');
    }

    if (!memberInfo.hasPermission) {
      throw new UnauthorizedException('User does not have the required roles');
    }

    return {
      isInGuild: memberInfo.isInGuild,
      hasPermission: memberInfo.hasPermission,
      roles: memberInfo.roles,
    };
  }

  generateJwtToken(user: DiscordUser, roles: string[]): string {
    const payload = {
      userId: user.id,
      username: user.username,
      roles: this.mapRolesToPermissions(roles),
    };

    const secret = this.configService.get<string>('JWT_SECRET') || 'fallback-secret-key';
    
    return jwt.sign(payload, secret, {
      expiresIn: '24h',
    });
  }

  private mapRolesToPermissions(roles: string[]): string[] {
    const adminRoleId = this.configService.get<string>('DISCORD_ADMIN_ROLE_ID');
    const managerRoleId = this.configService.get<string>('DISCORD_MANAGER_ROLE_ID');
    
    const permissions: string[] = [];
    
    if (adminRoleId && roles.includes(adminRoleId)) {
      permissions.push('admin');
    }
    
    if (managerRoleId && roles.includes(managerRoleId)) {
      permissions.push('manager');
    }
    
    return permissions;
  }

  verifyJwtToken(token: string): any {
    try {
      const secret = this.configService.get<string>('JWT_SECRET') || 'fallback-secret-key';
      return jwt.verify(token, secret);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
