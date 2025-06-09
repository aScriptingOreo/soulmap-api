import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req as Request;
    
    // Get client IP
    const clientIp = this.getClientIp(request);
    const allowedIps = this.configService.get<string>('API_ALLOWED_LOCAL_IPS', '127.0.0.1,::1,localhost').split(',');
    
    // If request is from localhost, allow without API key
    if (this.isLocalRequest(clientIp, allowedIps)) {
      return true;
    }
    
    // For non-local requests, require API key
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new UnauthorizedException('API key is required for this operation');
    }

    // Validate API key
    const testApiKey = this.configService.get<string>('API_KEY_TEST');
    
    if (apiKey === testApiKey) {
      return true;
    }
    
    // Add future API key validation logic here
    throw new UnauthorizedException('Invalid API key');
  }

  private getClientIp(request: Request): string {
    return (
      request.headers['x-forwarded-for'] as string ||
      request.headers['x-real-ip'] as string ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      '127.0.0.1'
    );
  }

  private isLocalRequest(clientIp: string, allowedIps: string[]): boolean {
    // Clean up the client IP (remove IPv6 prefix if present)
    const cleanIp = clientIp.replace(/^::ffff:/, '');
    
    return allowedIps.some(allowedIp => 
      allowedIp.trim() === cleanIp || 
      (allowedIp.trim() === 'localhost' && (cleanIp === '127.0.0.1' || cleanIp === '::1'))
    );
  }
}
