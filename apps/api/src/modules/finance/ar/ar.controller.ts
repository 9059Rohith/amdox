import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsReceivableService } from './ar.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Finance - Accounts Receivable')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'finance/ar', version: '1' })
export class AccountsReceivableController {
  constructor(private arService: AccountsReceivableService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'List AR invoices' })
  getInvoices(@Request() req: any, @Query() params: any) {
    return this.arService.getInvoices(req.user.tenantId, params);
  }

  @Post('invoices/:id/payment')
  @ApiOperation({ summary: 'Record customer payment against an AR invoice' })
  recordPayment(@Request() req: any, @Param('id') id: string, @Body('amount') amount: number) {
    return this.arService.recordPayment(req.user.tenantId, id, amount, req.user.id);
  }

  @Get('aging-report')
  @ApiOperation({ summary: 'AR aging report (0-30, 31-60, 61-90, 90+)' })
  getAgingReport(@Request() req: any) {
    return this.arService.getAgingReport(req.user.tenantId);
  }
}
