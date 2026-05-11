import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { Inject } from '@nestjs/common';
import { PRISMA_SERVICE } from '../database/database.module';
import { PrismaClient } from '@amdox/db';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
  ) {}

  @Public()
  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe - is the process up?' })
  liveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }

  @Public()
  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe - can we serve traffic?' })
  async readiness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch {
          return { database: { status: 'down' } };
        }
      },
    ]);
  }

  @Public()
  @Get('db')
  @HealthCheck()
  @ApiOperation({ summary: 'Database connectivity check' })
  async database() {
    return this.health.check([
      async () => {
        const start = Date.now();
        await this.prisma.$queryRaw`SELECT 1`;
        const latency = Date.now() - start;
        return { database: { status: 'up', latencyMs: latency } };
      },
    ]);
  }
}
