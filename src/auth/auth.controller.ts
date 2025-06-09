import { Controller, Get, Query, Res, Req, Post } from '@nestjs/common';
import { Response, Request } from 'express';
import { DiscordService } from './discord.service';

@Controller('auth')
export class AuthController {
  constructor(private discordService: DiscordService) {}

  @Get('discord')
  redirectToDiscord(@Res() res: Response) {
    const authUrl = this.discordService.getAuthUrl();
    res.redirect(authUrl);
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect('/admin/error?message=Discord authentication failed');
    }

    if (!code) {
      return res.redirect('/admin/error?message=No authorization code received');
    }

    try {
      // Exchange code for access token
      const accessToken = await this.discordService.exchangeCodeForToken(code);
      
      // Get user info from Discord OAuth
      const user = await this.discordService.getUserInfo(accessToken);
      
      // Use Discord bot to verify guild membership and roles
      const membershipInfo = await this.discordService.verifyGuildMembershipAndRoles(user.id);
      
      // Generate JWT token
      const jwtToken = this.discordService.generateJwtToken(user, membershipInfo.roles);
      
      // Set HTTP-only cookie
      res.cookie('auth_token', jwtToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Redirect to admin dashboard
      res.redirect('/admin/dashboard');
    } catch (error) {
      console.error('Discord auth error:', error);
      
      if (error.message.includes('not a member') || error.message.includes('required roles')) {
        return res.redirect('/admin/unauthorized');
      }
      
      res.redirect('/admin/error?message=Authentication failed');
    }
  }

  @Get('verify')
  verifyAuth(@Req() req: Request) {
    const token = req.cookies?.auth_token;
    
    if (!token) {
      return { valid: false };
    }

    try {
      const payload = this.discordService.verifyJwtToken(token);
      
      return {
        valid: true,
        user: {
          userId: payload.userId,
          username: payload.username,
          roles: payload.roles,
        },
      };
    } catch (error) {
      return { valid: false };
    }
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('auth_token');
    res.json({ success: true });
  }
}
