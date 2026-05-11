import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountsPayableService } from './ap.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Finance - Accounts Payable')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'finance/ap', version: '1' })
export class AccountsPayableController {
  constructor(private apService: AccountsPayableService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'List AP invoices' })
  getInvoices(@Request() req: any, @Query() params: any) {
    return this.apService.getInvoices(req.user.tenantId, params);
  }

  @Post('invoices/:id/match')
  @ApiOperation({ summary: '3-way match: invoice to PO+GR' })
  matchInvoice(@Request() req: any, @Param('id') id: string, @Body('poId') poId: string) {
    return this.apService.matchInvoice(req.user.tenantId, id, poId);
  }

  @Post('payment-runs')
  @ApiOperation({ summary: 'Create a payment run for approved invoices' })
  createPaymentRun(
    @Request() req: any,
    @Body('invoiceIds') invoiceIds: string[],
    @Body('paymentDate') paymentDate: string,
  ) {
    return this.apService.createPaymentRun(req.user.tenantId, req.user.id, invoiceIds, paymentDate);
  }

  @Get('aging-report')
  @ApiOperation({ summary: 'AP aging report (0-30, 31-60, 61-90, 90+)' })
  getAgingReport(@Request() req: any) {
    return this.apService.getAgingReport(req.user.tenantId);
  }
}
