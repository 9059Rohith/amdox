import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Logger, Inject } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaClient, PayrollRunStatus } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { PayrollService } from './payroll.service';

@Processor('payroll')
export class PayrollProcessor {
  private readonly logger = new Logger(PayrollProcessor.name);

  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    private payrollService: PayrollService,
  ) {}

  @Process('process-payroll-run')
  async handlePayrollRun(job: Job<{ tenantId: string; runId: string; userId: string }>) {
    const { tenantId, runId } = job.data;
    this.logger.log(`Processing payroll run ${runId}`);

    const run = await this.prisma.payrollRun.findFirst({
      where: { id: runId, tenantId },
    });
    if (!run) throw new Error(`Payroll run ${runId} not found`);

    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: 'ACTIVE', deletedAt: null },
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    const payslips = [];

    for (const emp of employees) {
      const calc = await this.payrollService.calculateGrossToNet(emp, run.periodStart, run.periodEnd);
      const payslipCount = await this.prisma.payslip.count({ where: { tenantId } });
      const payslip = await this.prisma.payslip.create({
        data: {
          tenantId,
          payrollRunId: runId,
          employeeId: emp.id,
          payslipNumber: `PS-${run.runNumber}-${String(payslipCount + 1).padStart(4, '0')}`,
          periodStart: run.periodStart,
          periodEnd: run.periodEnd,
          paymentDate: run.paymentDate,
          basicSalary: calc.basicSalary,
          grossPay: calc.grossPay,
          taxDeductions: calc.taxDeductions as any,
          statutoryDeductions: calc.statutoryDeductions as any,
          otherDeductions: calc.otherDeductions as any,
          totalDeductions: calc.totalDeductions,
          netPay: calc.netPay,
        },
      });
      payslips.push(payslip);
      totalGross += calc.grossPay;
      totalDeductions += calc.totalDeductions;
      totalNet += calc.netPay;
      await job.progress(Math.round((payslips.length / employees.length) * 100));
    }

    await this.prisma.payrollRun.update({
      where: { id: runId },
      data: {
        status: PayrollRunStatus.COMPLETED,
        employeeCount: employees.length,
        totalGross,
        totalDeductions,
        totalNet,
        processedAt: new Date(),
      },
    });

    this.logger.log(`Payroll run ${runId} completed: ${employees.length} employees processed`);
    return { processed: employees.length, totalGross, totalNet };
  }

  @OnQueueFailed()
  async onFailed(job: Job, err: Error) {
    this.logger.error(`Payroll job ${job.id} failed: ${err.message}`);
    if (job.data?.runId) {
      await this.prisma.payrollRun.update({
        where: { id: job.data.runId },
        data: { status: PayrollRunStatus.FAILED },
      });
    }
  }
}
