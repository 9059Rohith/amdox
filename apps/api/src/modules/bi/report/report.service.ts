import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    @InjectQueue('reports') private reportsQueue: Queue,
  ) {}

  async scheduleReport(tenantId: string, userId: string, dto: any) {
    const report = await this.prisma.scheduledReport.create({
      data: {
        tenantId,
        userId,
        name: dto.name,
        reportType: dto.reportType,
        format: dto.format || 'PDF',
        schedule: dto.schedule || 'weekly',
        recipients: dto.recipients || [],
        parameters: dto.parameters || {},
        isActive: true,
      },
    });

    await this.reportsQueue.add('generate', { tenantId, userId, reportId: report.id });
    return report;
  }

  async generateReport(tenantId: string, reportType: string, params: any) {
    // Queue immediate generation
    const job = await this.reportsQueue.add('generate-immediate', { tenantId, reportType, params });
    return { jobId: job.id, message: 'Report generation queued' };
  }

  async getReports(tenantId: string) {
    return this.prisma.scheduledReport.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
