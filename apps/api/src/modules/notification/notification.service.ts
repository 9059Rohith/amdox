import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaClient, NotificationChannel } from '@amdox/db';
import { PRISMA_SERVICE } from '../database/database.module';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private sseClients = new Map<string, Response[]>();

  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    @InjectQueue('notifications') private notificationsQueue: Queue,
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('webhook') private webhookQueue: Queue,
  ) {}

  async send(tenantId: string, event: {
    userId?: string;
    channel: NotificationChannel;
    eventType: string;
    title: string;
    message: string;
    data?: any;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId,
        userId: event.userId,
        channel: event.channel,
        eventType: event.eventType,
        title: event.title,
        message: event.message,
        data: event.data,
        status: 'PENDING',
      },
    });

    if (event.channel === NotificationChannel.IN_APP) {
      this.pushSse(tenantId, event.userId, { id: notification.id, ...event });
    } else if (event.channel === NotificationChannel.EMAIL) {
      await this.emailQueue.add('send', { notificationId: notification.id, ...event });
    } else if (event.channel === NotificationChannel.WEBHOOK) {
      await this.webhookQueue.add('send', { notificationId: notification.id, tenantId, ...event });
    }

    return notification;
  }

  // SSE stream
  addSseClient(tenantId: string, userId: string, res: Response) {
    const key = `${tenantId}:${userId}`;
    const existing = this.sseClients.get(key) || [];
    existing.push(res);
    this.sseClients.set(key, existing);
    res.on('close', () => {
      const clients = this.sseClients.get(key)?.filter((r) => r !== res) || [];
      this.sseClients.set(key, clients);
    });
  }

  private pushSse(tenantId: string, userId: string | undefined, data: any) {
    if (!userId) return;
    const key = `${tenantId}:${userId}`;
    const clients = this.sseClients.get(key) || [];
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    clients.forEach((res) => {
      try { res.write(payload); } catch {}
    });
  }

  async getNotifications(tenantId: string, userId: string, params: any) {
    return this.prisma.notification.findMany({
      where: { tenantId, userId, ...params },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // HMAC-signed webhook payload
  signWebhookPayload(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }
}
