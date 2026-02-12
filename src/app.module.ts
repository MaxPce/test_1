import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';

// Módulos
import { AuthModule } from './auth/auth.module';
import { SportsModule } from './sports/sports.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { EventsModule } from './events/events.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { ResultsModule } from './results/results.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

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
