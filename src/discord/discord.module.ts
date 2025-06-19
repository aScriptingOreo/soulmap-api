import { Module, forwardRef } from '@nestjs/common';
import { DiscordBotService } from './discord-bot.service';
import { DiscordResolver } from './discord.resolver';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [DiscordBotService, DiscordResolver],
  exports: [DiscordBotService],
})
export class DiscordModule {}
