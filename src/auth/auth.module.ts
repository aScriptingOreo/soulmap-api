import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DiscordService } from './discord.service';
import { AuthController } from './auth.controller';
import { DiscordModule } from '../discord/discord.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => DiscordModule),
  ],
  controllers: [AuthController],
  providers: [JwtAuthGuard, DiscordService],
  exports: [JwtAuthGuard, DiscordService],
})
export class AuthModule {}
