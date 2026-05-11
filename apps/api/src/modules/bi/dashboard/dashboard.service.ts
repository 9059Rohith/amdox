import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    @InjectRedis() private redis: Redis,
  ) {}

  async getMetrics(tenantId: string) {
    const cacheKey = `dashboard:metrics:${tenantId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [
      totalRevenue,
      totalExpenses,
      employeeCount,
      openPOs,
      inventoryValue,
      pendingInvoices,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { tenantId, type: 'RECEIVABLE', status: 'PAID', deletedAt: null },
        _sum: { totalAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { tenantId, type: 'PAYABLE', status: 'PAID', deletedAt: null },
        _sum: { totalAmount: true },
      }),
      this.prisma.employee.count({ where: { tenantId, status: 'ACTIVE', deletedAt: null } }),
      this.prisma.purchaseOrder.count({
        where: { tenantId, status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] }, deletedAt: null },
      }),
      this.prisma.inventoryItem.aggregate({
        where: { tenantId, deletedAt: null },
        _sum: { totalValue: true },
      }),
      this.prisma.invoice.count({
        where: { tenantId, status: { in: ['PENDING_APPROVAL', 'OVERDUE'] }, deletedAt: null },
      }),
    ]);

    const metrics = {
      totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
      totalExpenses: Number(totalExpenses._sum.totalAmount || 0),
      netProfit:
        Number(totalRevenue._sum.totalAmount || 0) -
        Number(totalExpenses._sum.totalAmount || 0),
      employeeCount,
      openPOs,
      inventoryValue: Number(inventoryValue._sum.totalValue || 0),
      pendingInvoices,
      updatedAt: new Date().toISOString(),
    };

    await this.redis.set(cacheKey, JSON.stringify(metrics), 'EX', 60); // 60s TTL
    return metrics;
  }

  async getRevenueChart(tenantId: string, period: string = '12months') {
    const months = period === '3months' ? 3 : period === '6months' ? 6 : 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const data = await this.prisma.$queryRaw<any[]>`
      SELECT
        DATE_TRUNC('month', invoice_date) as month,
        SUM(CASE WHEN type = 'RECEIVABLE' THEN total_amount ELSE 0 END) as revenue,
        SUM(CASE WHEN type = 'PAYABLE' THEN total_amount ELSE 0 END) as expenses
      FROM invoices
      WHERE tenant_id = ${tenantId}
        AND invoice_date >= ${startDate}
        AND status IN ('APPROVED', 'PAID', 'PARTIALLY_PAID')
        AND deleted_at IS NULL
      GROUP BY DATE_TRUNC('month', invoice_date)
      ORDER BY month ASC
    `;
    return data;
  }

  async getDrillDown(tenantId: string, chart: string, segment: string) {
    if (chart === 'revenue' && segment) {
      return this.prisma.invoice.findMany({
        where: { tenantId, type: 'RECEIVABLE', deletedAt: null },
        orderBy: { totalAmount: 'desc' },
        take: 20,
      });
    }
    return [];
  }

  async saveDashboardConfig(tenantId: string, userId: string, config: any) {
    return this.prisma.dashboardConfig.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: { tenantId, userId, widgets: config.widgets, layout: config.layout },
      update: { widgets: config.widgets, layout: config.layout, updatedAt: new Date() },
    });
  }

  async getDashboardConfig(tenantId: string, userId: string) {
    return this.prisma.dashboardConfig.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
  }
}
