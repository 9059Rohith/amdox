import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PurchaseOrderService } from './po.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Supply Chain - Purchase Orders')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'supply-chain/purchase-orders', version: '1' })
export class PurchaseOrderController {
  constructor(private poService: PurchaseOrderService) {}

  @Get() getAll(@Request() req: any, @Query() params: any) { return this.poService.findAll(req.user.tenantId, params); }
  @Post() create(@Request() req: any, @Body() dto: any) { return this.poService.create(req.user.tenantId, req.user.id, dto); }
  @Post(':id/approve') approve(@Request() req: any, @Param('id') id: string) { return this.poService.approve(req.user.tenantId, id, req.user.id); }
  @Post(':id/goods-receipt') createGR(@Request() req: any, @Param('id') id: string, @Body() dto: any) { return this.poService.createGoodsReceipt(req.user.tenantId, id, req.user.id, dto); }
}
