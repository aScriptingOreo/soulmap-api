import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Location } from '../locations/location.entity';
import { Category } from '../categories/category.entity';
import { Changelog } from '../changelog/changelog.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        type: 'postgres',
        host: process.env.PG_HOST || 'localhost',
        port: parseInt(process.env.PG_PORT || '5432', 10),
        username: process.env.PG_U || "soulmapus",
        password: process.env.PG_P || "012h8989023891k2021nnz12sk0",
        database: process.env.PG_DB || "soulmap" ,
        entities: [Location, Category, Changelog],
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
