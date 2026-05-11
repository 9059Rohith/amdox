import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class VendorService {
  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async findAll(tenantId: string, params: any) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = { tenantId, deletedAt: null };
    if (params.isActive !== undefined) where.isActive = params.isActive === 'true';

    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.vendor.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, tenantId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(tenantId: string, dto: any) {
    const count = await this.prisma.vendor.count({ where: { tenantId } });
    const vendorNumber = `VEN-${String(count + 1).padStart(5, '0')}`;
    const vendor = await this.prisma.vendor.create({
      data: { ...dto, tenantId, vendorNumber },
    });

    // Notify vendor via BullMQ + SES
    if (vendor.email) {
      await this.emailQueue.add('vendor-welcome', {
        to: vendor.email,
        subject: 'Welcome to Amdox ERP Vendor Portal',
        body: `Dear ${vendor.name}, your vendor account has been created.`,
      });
    }
    return vendor;
  }

  async update(tenantId: string, id: string, dto: any) {
    await this.findOne(tenantId, id);
    return this.prisma.vendor.update({ where: { id }, data: dto });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
