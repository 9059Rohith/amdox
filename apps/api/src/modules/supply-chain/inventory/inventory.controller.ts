import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Supply Chain - Inventory')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'supply-chain/inventory', version: '1' })
export class InventoryController {
  constructor(private inventoryService: InventoryService) {}

  @Get() getAll(@Request() req: any, @Query() params: any) { return this.inventoryService.findAll(req.user.tenantId, params); }
  @Get(':id') getOne(@Request() req: any, @Param('id') id: string) { return this.inventoryService.findOne(req.user.tenantId, id); }
  @Post() create(@Request() req: any, @Body() dto: any) { return this.inventoryService.create(req.user.tenantId, dto); }
  @Put(':id/stock') updateStock(@Request() req: any, @Param('id') id: string, @Body('quantity') qty: number) {
    return this.inventoryService.updateStock(req.user.tenantId, id, qty);
  }
}
