import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@amdox/db';

export const PRISMA_SERVICE = 'PRISMA_SERVICE';

@Global()
@Module({
  providers: [
    {
      provide: PRISMA_SERVICE,
      useFactory: (config: ConfigService) => {
        const client = new PrismaClient({
          datasources: { db: { url: config.get<string>('DATABASE_URL') } },
          log:
            config.get('NODE_ENV') === 'development'
              ? ['query', 'info', 'warn', 'error']
              : ['warn', 'error'],
        });
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [PRISMA_SERVICE],
})
export class DatabaseModule {}
