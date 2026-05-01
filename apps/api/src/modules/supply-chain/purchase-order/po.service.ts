import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, PurchaseOrderStatus } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    private events: EventEmitter2,
  ) {}

  async findAll(tenantId: string, params: any) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = { tenantId, deletedAt: null };
    if (params.status) where.status = params.status;
    if (params.vendorId) where.vendorId = params.vendorId;

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { vendor: true },
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async create(tenantId: string, userId: string, dto: any) {
    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    const poNumber = `PO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    const po = await this.prisma.purchaseOrder.create({
      data: { ...dto, tenantId, poNumber, createdBy: userId, orderDate: new Date(dto.orderDate || Date.now()) },
      include: { vendor: true },
    });
    this.events.emit('supply-chain.po.created', { tenantId, poId: po.id, userId });
    return po;
  }

  async approve(tenantId: string, poId: string, userId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id: poId, tenantId } });
    if (!po) throw new NotFoundException('PO not found');
    if (po.status !== PurchaseOrderStatus.PENDING_APPROVAL) throw new BadRequestException('PO is not pending approval');
    const updated = await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: PurchaseOrderStatus.APPROVED, approvedBy: userId, approvedAt: new Date() },
    });
    this.events.emit('supply-chain.po.approved', { tenantId, poId, userId });
    return updated;
  }

  async createGoodsReceipt(tenantId: string, poId: string, userId: string, dto: any) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id: poId, tenantId } });
    if (!po) throw new NotFoundException('PO not found');

    const count = await this.prisma.goodsReceipt.count({ where: { tenantId } });
    const gr = await this.prisma.goodsReceipt.create({
      data: {
        tenantId,
        grNumber: `GR-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
        purchaseOrderId: poId,
        receiptDate: new Date(dto.receiptDate || Date.now()),
        items: dto.items,
        receivedBy: userId,
        status: 'CONFIRMED',
        confirmedBy: userId,
        confirmedAt: new Date(),
      },
    });

    await this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: { status: PurchaseOrderStatus.RECEIVED },
    });

    this.events.emit('supply-chain.gr.created', { tenantId, grId: gr.id, poId });
    return gr;
  }
}
