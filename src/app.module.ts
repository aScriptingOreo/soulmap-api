import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { LocationsModule } from './locations/locations.module';
import { CategoriesModule } from './categories/categories.module';
import { ChangelogModule } from './changelog/changelog.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    AuthModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true, // Enable GraphQL playground
      context: ({ req }) => ({ req }), // Pass request to context for guards
    }),
    LocationsModule,
    CategoriesModule,
    ChangelogModule,
  ],
})
export class AppModule {}
