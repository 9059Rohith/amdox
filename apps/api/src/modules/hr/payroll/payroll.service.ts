import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaClient, PayrollRunStatus } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    @InjectQueue('payroll') private payrollQueue: Queue,
    private events: EventEmitter2,
  ) {}

  async createPayrollRun(tenantId: string, userId: string, dto: any) {
    const count = await this.prisma.payrollRun.count({ where: { tenantId } });
    const runNumber = `PAY-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const run = await this.prisma.payrollRun.create({
      data: {
        tenantId,
        runNumber,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        paymentDate: new Date(dto.paymentDate),
        status: PayrollRunStatus.DRAFT,
      },
    });

    return run;
  }

  async processPayrollRun(tenantId: string, runId: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id: runId, tenantId } });
    if (!run) throw new Error('Payroll run not found');

    await this.prisma.payrollRun.update({
      where: { id: runId },
      data: { status: PayrollRunStatus.PROCESSING },
    });

    // Queue batch processing via BullMQ
    await this.payrollQueue.add(
      'process-payroll-run',
      { tenantId, runId, userId },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    return { message: 'Payroll run queued for processing', runId };
  }

  async calculateGrossToNet(employee: any, periodStart: Date, periodEnd: Date) {
    const months = (periodEnd.getFullYear() - periodStart.getFullYear()) * 12
      + periodEnd.getMonth() - periodStart.getMonth() + 1;
    const basicSalary = (Number(employee.salary) / 12) * months;

    // Tax slabs (configurable — simplified example)
    const taxSlabs = [
      { min: 0, max: 500000, rate: 0 },
      { min: 500000, max: 1000000, rate: 0.20 },
      { min: 1000000, max: Infinity, rate: 0.30 },
    ];

    const annualSalary = Number(employee.salary);
    let tax = 0;
    for (const slab of taxSlabs) {
      if (annualSalary > slab.min) {
        const taxable = Math.min(annualSalary, slab.max) - slab.min;
        tax += taxable * slab.rate;
      }
    }
    const monthlyTax = (tax / 12) * months;

    // Statutory deductions
    const pf = basicSalary * 0.12; // PF: 12% of basic
    const esi = basicSalary <= 21000 ? basicSalary * 0.0075 : 0;

    const totalDeductions = monthlyTax + pf + esi;
    const grossPay = basicSalary;
    const netPay = grossPay - totalDeductions;

    return {
      basicSalary,
      grossPay,
      taxDeductions: [{ name: 'Income Tax', amount: monthlyTax }],
      statutoryDeductions: [
        { name: 'Provident Fund', amount: pf },
        { name: 'ESI', amount: esi },
      ],
      otherDeductions: [],
      totalDeductions,
      netPay,
    };
  }

  async getPayrollRuns(tenantId: string) {
    return this.prisma.payrollRun.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayslips(tenantId: string, runId: string) {
    return this.prisma.payslip.findMany({
      where: { tenantId, payrollRunId: runId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }
}
