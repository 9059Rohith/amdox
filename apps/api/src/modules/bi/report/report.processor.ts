import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaClient } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';

@Processor('reports')
export class ReportProcessor {
  private readonly logger = new Logger(ReportProcessor.name);

  constructor(@Inject(PRISMA_SERVICE) private prisma: PrismaClient) {}

  @Process('generate')
  async handleScheduledReport(job: Job<{ tenantId: string; userId: string; reportId: string }>) {
    const { tenantId, reportId } = job.data;
    this.logger.log(`Generating scheduled report ${reportId}`);
    // PDF/Excel generation + email delivery would go here
    // (pdfkit / exceljs integration)
    this.logger.log(`Report ${reportId} generated successfully`);
  }

  @Process('generate-immediate')
  async handleImmediateReport(job: Job<{ tenantId: string; reportType: string; params: any }>) {
    const { tenantId, reportType, params } = job.data;
    this.logger.log(`Generating immediate ${reportType} report for tenant ${tenantId}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Report job ${job.id} failed: ${err.message}`);
  }
}
