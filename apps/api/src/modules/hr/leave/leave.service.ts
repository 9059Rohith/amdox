import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, LeaveStatus } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class LeaveService {
  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    private events: EventEmitter2,
  ) {}

  async requestLeave(tenantId: string, employeeId: string, dto: any) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;

    // Check for overlapping approved leaves
    const overlap = await this.prisma.leaveRequest.findFirst({
      where: {
        tenantId,
        employeeId,
        status: LeaveStatus.APPROVED,
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
        deletedAt: null,
      },
    });
    if (overlap) throw new BadRequestException('Leave dates overlap with an approved request');

    return this.prisma.leaveRequest.create({
      data: { tenantId, employeeId, ...dto, days, status: LeaveStatus.PENDING },
    });
  }

  async approveLeave(tenantId: string, leaveId: string, approverId: string) {
    const leave = await this.prisma.leaveRequest.findFirst({ where: { id: leaveId, tenantId } });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== LeaveStatus.PENDING) throw new BadRequestException('Only PENDING leaves can be approved');

    const updated = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: LeaveStatus.APPROVED, approvedBy: approverId, approvedAt: new Date() },
    });
    this.events.emit('hr.leave.approved', { tenantId, leaveId, employeeId: leave.employeeId });
    return updated;
  }

  async rejectLeave(tenantId: string, leaveId: string, approverId: string, reason: string) {
    const leave = await this.prisma.leaveRequest.findFirst({ where: { id: leaveId, tenantId } });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== LeaveStatus.PENDING) throw new BadRequestException('Only PENDING leaves can be rejected');

    return this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: { status: LeaveStatus.REJECTED, rejectedBy: approverId, rejectedAt: new Date(), rejectionReason: reason },
    });
  }

  async getLeaveRequests(tenantId: string, params: any) {
    const where: any = { tenantId, deletedAt: null };
    if (params.status) where.status = params.status;
    if (params.employeeId) where.employeeId = params.employeeId;

    return this.prisma.leaveRequest.findMany({
      where,
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
