import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaClient, InvoiceStatus } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AccountsReceivableService {
  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    private events: EventEmitter2,
  ) {}

  async getInvoices(tenantId: string, params: any) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = { tenantId, type: 'RECEIVABLE', deletedAt: null };
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { invoiceDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async recordPayment(tenantId: string, invoiceId: string, amount: number, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const newPaidAmount = Number(invoice.paidAmount) + amount;
    const status = newPaidAmount >= Number(invoice.totalAmount)
      ? InvoiceStatus.PAID
      : InvoiceStatus.PARTIALLY_PAID;

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paidAmount: newPaidAmount,
        status,
        paidAt: status === InvoiceStatus.PAID ? new Date() : invoice.paidAt,
      },
    });

    this.events.emit('ar.payment.received', { tenantId, invoiceId, amount, userId });
    return updated;
  }

  async getAgingReport(tenantId: string) {
    const now = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        type: 'RECEIVABLE',
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'OVERDUE'] },
        deletedAt: null,
      },
    });

    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    const detail = invoices.map((inv) => {
      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      const outstanding = Number(inv.totalAmount) - Number(inv.paidAmount);
      if (daysOverdue <= 0) buckets.current += outstanding;
      else if (daysOverdue <= 30) buckets.days30 += outstanding;
      else if (daysOverdue <= 60) buckets.days60 += outstanding;
      else if (daysOverdue <= 90) buckets.days90 += outstanding;
      else buckets.over90 += outstanding;
      return { ...inv, daysOverdue, outstanding };
    });

    return { buckets, invoices: detail };
  }
}
