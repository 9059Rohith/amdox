import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { PRISMA_SERVICE } from '../database/database.module';
import * as crypto from 'crypto';

@Injectable()
export class AuditService {
  private lastHash = '';

  constructor(@Inject(PRISMA_SERVICE) private prisma: PrismaClient) {}

  async log(params: {
    tenantId: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    payload: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const payloadStr = JSON.stringify(params.payload);
    const currentHash = crypto
      .createHash('sha256')
      .update(`${this.lastHash}${new Date().toISOString()}${params.action}${payloadStr}`)
      .digest('hex');
    this.lastHash = currentHash;

    return this.prisma.auditLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        previousHash: this.lastHash !== currentHash ? this.lastHash : undefined,
        currentHash,
        payload: params.payload,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  }

  async getAuditLogs(tenantId: string, params: any) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const where: any = { tenantId };
    if (params.entity) where.entity = params.entity;
    if (params.entityId) where.entityId = params.entityId;
    if (params.userId) where.userId = params.userId;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
