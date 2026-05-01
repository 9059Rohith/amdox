import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('HR - Payroll')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'hr/payroll', version: '1' })
export class PayrollController {
  constructor(private payrollService: PayrollService) {}

  @Get('runs')
  @ApiOperation({ summary: 'List payroll runs' })
  getPayrollRuns(@Request() req: any) {
    return this.payrollService.getPayrollRuns(req.user.tenantId);
  }

  @Post('runs')
  @ApiOperation({ summary: 'Create a new payroll run (DRAFT)' })
  createPayrollRun(@Request() req: any, @Body() dto: any) {
    return this.payrollService.createPayrollRun(req.user.tenantId, req.user.id, dto);
  }

  @Post('runs/:id/process')
  @ApiOperation({ summary: 'Trigger BullMQ batch payroll processing' })
  processPayrollRun(@Request() req: any, @Param('id') id: string) {
    return this.payrollService.processPayrollRun(req.user.tenantId, id, req.user.id);
  }

  @Get('runs/:id/payslips')
  @ApiOperation({ summary: 'List payslips for a payroll run' })
  getPayslips(@Request() req: any, @Param('id') id: string) {
    return this.payrollService.getPayslips(req.user.tenantId, id);
  }
}
