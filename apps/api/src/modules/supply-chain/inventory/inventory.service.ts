import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from '@nestjs/common';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    @InjectQueue('reorder') private reorderQueue: Queue,
  ) {}

  async findAll(tenantId: string, params: any) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = { tenantId, deletedAt: null };
    if (params.category) where.category = params.category;
    if (params.warehouseId) where.warehouseId = params.warehouseId;

    const [data, total] = await Promise.all([
      this.prisma.inventoryItem.findMany({ where, skip: (page - 1) * limit, take: limit }),
      this.prisma.inventoryItem.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async create(tenantId: string, dto: any) {
    return this.prisma.inventoryItem.create({ data: { ...dto, tenantId } });
  }

  async updateStock(tenantId: string, id: string, quantity: number) {
    const item = await this.findOne(tenantId, id);
    const newStock = item.currentStock + quantity;
    const updated = await this.prisma.inventoryItem.update({
      where: { id },
      data: { currentStock: newStock, availableStock: newStock - item.reservedStock },
    });

    // Check reorder point
    if (updated.currentStock <= updated.reorderPoint) {
      await this.reorderQueue.add('check-reorder', { tenantId, itemId: id }, { delay: 500 });
    }
    return updated;
  }

  // FIFO costing stub
  async getFifoCost(tenantId: string, itemId: string, quantity: number): Promise<number> {
    const item = await this.findOne(tenantId, itemId);
    return Number(item.costPrice) * quantity;
  }

  // Scheduled reorder check
  @Cron(CronExpression.EVERY_HOUR)
  async checkReorderPoints() {
    const items = await this.prisma.inventoryItem.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, tenantId: true, currentStock: true, reorderPoint: true, sku: true },
    });

    for (const item of items) {
      if (item.currentStock <= item.reorderPoint) {
        await this.reorderQueue.add('auto-reorder', { tenantId: item.tenantId, itemId: item.id, sku: item.sku });
      }
    }
    this.logger.debug(`Checked reorder points for ${items.length} items`);
  }
}
