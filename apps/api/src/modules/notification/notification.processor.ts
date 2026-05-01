import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaClient } from '@amdox/db';
import { PRISMA_SERVICE } from '../database/database.module';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Processor('email')
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    private configService: ConfigService,
  ) {}

  @Process('send')
  async handleEmail(job: Job<any>) {
    const { notificationId, to, subject, body } = job.data;
    this.logger.log(`Sending email to ${to}: ${subject}`);

    // In production, use AWS SES. For dev, log only.
    if (this.configService.get('NODE_ENV') !== 'production') {
      this.logger.debug(`[DEV EMAIL] to=${to} subject=${subject}`);
    } else {
      // SES send logic would go here
    }

    if (notificationId) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'SENT', sentAt: new Date() },
      });
    }
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Email job ${job.id} failed: ${err.message}`);
    if (job.data?.notificationId) {
      await this.prisma.notification.update({
        where: { id: job.data.notificationId },
        data: { status: 'FAILED', failedAt: new Date(), errorMessage: err.message },
      });
    }
  }
}

@Processor('webhook')
export class WebhookProcessor {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    private configService: ConfigService,
  ) {}

  @Process('send')
  async handleWebhook(job: Job<any>) {
    const { notificationId, tenantId, eventType, data } = job.data;
    const payload = JSON.stringify({ eventType, data, timestamp: new Date() });
    const secret = this.configService.get('WEBHOOK_SECRET', 'dev-secret');
    const signature = require('crypto').createHmac('sha256', secret).update(payload).digest('hex');

    // Fetch webhook subscriptions for tenant
    // In production, query webhook subscription table
    this.logger.debug(`[WEBHOOK] tenant=${tenantId} event=${eventType} sig=${signature.substring(0, 8)}...`);

    if (notificationId) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'SENT', sentAt: new Date() },
      });
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Webhook job ${job.id} failed: ${err.message}`);
  }
}
