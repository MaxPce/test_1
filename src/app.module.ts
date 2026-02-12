import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { SportsModule } from './sports/sports.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { EventsModule } from './events/events.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { ResultsModule } from './results/results.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { SismasterModule } from '../src/sismaster/sismaster.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT')),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
        charset: 'utf8mb4',
      }),
    }),
    TypeOrmModule.forRootAsync({
      name: 'sismaster',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('SISMASTER_DB_HOST'),
        port: Number(config.get<string>('SISMASTER_DB_PORT')),
        username: config.get<string>('SISMASTER_DB_USER'),
        password: config.get<string>('SISMASTER_DB_PASS'),
        database: config.get<string>('SISMASTER_DB_NAME'),
        entities: [__dirname + '/sismaster/entities/*.entity{.ts,.js}'],
        synchronize: false,
        logging: false,
        charset: 'utf8mb4',
      }),
    }),

    AuthModule,
    SportsModule,
    InstitutionsModule,
    EventsModule,
    CompetitionsModule,
    ResultsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
