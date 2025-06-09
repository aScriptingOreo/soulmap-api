import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { DiscordService } from './discord.service';
import { Request } from 'express';

// Extend Request type to include user property
interface AuthenticatedRequest extends Request {
  user?: any;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private discordService: DiscordService) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req as AuthenticatedRequest;
    
    const token = request.cookies?.auth_token;
    
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = this.discordService.verifyJwtToken(token);
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid authentication token');
    }
  }
}
