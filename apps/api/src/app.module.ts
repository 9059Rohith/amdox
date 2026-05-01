import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HrModule } from './modules/hr/hr.module';
import { SupplyChainModule } from './modules/supply-chain/supply-chain.module';
import { ProjectModule } from './modules/project/project.module';
import { ForecastModule } from './modules/forecast/forecast.module';
import { BiModule } from './modules/bi/bi.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AuditModule } from './modules/audit/audit.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { DatabaseModule } from './modules/database/database.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // Rate Limiting (Redis sliding window)
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('RATE_LIMIT_TTL', 900),
            limit: config.get<number>('RATE_LIMIT_MAX', 100),
          },
        ],
        storage: undefined, // Will use Redis via nest-throttler-storage-redis
      }),
    }),

    // Domain Events
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),

    // Cron Jobs
    ScheduleModule.forRoot(),

    // Health
    TerminusModule,

    // BullMQ
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 500,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        },
      }),
    }),

    // Feature Modules
    DatabaseModule,
    AuthModule,
    HealthModule,
    TenantModule,
    FinanceModule,
    HrModule,
    SupplyChainModule,
    ProjectModule,
    ForecastModule,
    BiModule,
    NotificationModule,
    AuditModule,
  ],
})
export class AppModule {}
