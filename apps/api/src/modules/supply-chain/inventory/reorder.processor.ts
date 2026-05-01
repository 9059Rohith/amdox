import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaClient, PurchaseOrderStatus } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';

@Processor('reorder')
export class ReorderProcessor {
  private readonly logger = new Logger(ReorderProcessor.name);

  constructor(@Inject(PRISMA_SERVICE) private prisma: PrismaClient) {}

  @Process('auto-reorder')
  async handleAutoReorder(job: Job<{ tenantId: string; itemId: string; sku: string }>) {
    const { tenantId, itemId, sku } = job.data;
    this.logger.log(`Auto-reorder triggered for SKU ${sku}`);

    const item = await this.prisma.inventoryItem.findFirst({ where: { id: itemId, tenantId } });
    if (!item) return;

    const reorderRule = await this.prisma.reorderRule.findFirst({
      where: { inventoryItemId: itemId, isActive: true },
    });

    const quantity = reorderRule ? reorderRule.reorderQuantity : item.reorderQuantity;

    // Find preferred vendor (first vendor with active POs)
    const existingPO = await this.prisma.purchaseOrder.findFirst({
      where: { tenantId, status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
      include: { vendor: true },
    });

    if (!existingPO) {
      this.logger.warn(`No active vendor found for auto-reorder of ${sku}`);
      return;
    }

    const count = await this.prisma.purchaseOrder.count({ where: { tenantId } });
    await this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        poNumber: `AUTO-PO-${Date.now()}`,
        vendorId: existingPO.vendorId,
        orderDate: new Date(),
        subtotal: Number(item.costPrice) * quantity,
        totalAmount: Number(item.costPrice) * quantity,
        status: PurchaseOrderStatus.DRAFT,
        createdBy: 'system',
        notes: `Auto-generated reorder for SKU ${sku}. Quantity: ${quantity}`,
      },
    });

    await this.prisma.reorderRule.updateMany({
      where: { inventoryItemId: itemId },
      data: { lastTriggered: new Date() },
    });

    this.logger.log(`Auto-reorder PO created for SKU ${sku}, qty=${quantity}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Reorder job ${job.id} failed: ${err.message}`);
  }
}
