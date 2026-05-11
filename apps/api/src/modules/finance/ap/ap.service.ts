import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, InvoiceStatus, PurchaseOrderStatus } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class AccountsPayableService {
  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    private events: EventEmitter2,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  async getInvoices(tenantId: string, params: any) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = { tenantId, type: 'PAYABLE', deletedAt: null };
    if (params.status) where.status = params.status;
    if (params.vendorId) where.vendorId = params.vendorId;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: { vendor: true, purchaseOrder: true },
        orderBy: { invoiceDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async matchInvoice(tenantId: string, invoiceId: string, poId: string) {
    const [invoice, po] = await Promise.all([
      this.prisma.invoice.findFirst({ where: { id: invoiceId, tenantId } }),
      this.prisma.purchaseOrder.findFirst({ where: { id: poId, tenantId } }),
    ]);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!po) throw new NotFoundException('Purchase order not found');

    // 3-way matching: PO + GR + Invoice
    const goodsReceipts = await this.prisma.goodsReceipt.findMany({
      where: { purchaseOrderId: poId, tenantId, status: 'CONFIRMED' },
    });
    if (goodsReceipts.length === 0) {
      throw new BadRequestException('No confirmed goods receipts for this PO — 3-way match failed');
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        purchaseOrderId: poId,
        matchedAt: new Date(),
        status: InvoiceStatus.APPROVED,
      },
    });

    this.events.emit('ap.invoice.matched', { tenantId, invoiceId, poId });
    return updated;
  }

  async createPaymentRun(tenantId: string, userId: string, invoiceIds: string[], paymentDate: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: invoiceIds }, tenantId, type: 'PAYABLE', status: InvoiceStatus.APPROVED },
    });
    if (invoices.length === 0) throw new BadRequestException('No approved invoices found');

    const totalAmount = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
    const count = await this.prisma.paymentRun.count({ where: { tenantId } });
    const runNumber = `PR-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const run = await this.prisma.paymentRun.create({
      data: {
        tenantId,
        runNumber,
        paymentDate: new Date(paymentDate),
        totalAmount,
        invoiceCount: invoices.length,
        createdBy: userId,
        invoices: { connect: invoiceIds.map((id) => ({ id })) },
      },
      include: { invoices: true },
    });

    // Queue payment processing
    await this.notificationsQueue.add('payment-run-created', { tenantId, runId: run.id }, { delay: 1000 });
    return run;
  }

  async getAgingReport(tenantId: string) {
    const now = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, type: 'PAYABLE', status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'OVERDUE'] }, deletedAt: null },
      include: { vendor: true },
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
