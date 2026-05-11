import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VendorService } from './vendor.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Supply Chain - Vendors')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'supply-chain/vendors', version: '1' })
export class VendorController {
  constructor(private vendorService: VendorService) {}

  @Get() getAll(@Request() req: any, @Query() params: any) { return this.vendorService.findAll(req.user.tenantId, params); }
  @Get(':id') getOne(@Request() req: any, @Param('id') id: string) { return this.vendorService.findOne(req.user.tenantId, id); }
  @Post() create(@Request() req: any, @Body() dto: any) { return this.vendorService.create(req.user.tenantId, dto); }
  @Put(':id') update(@Request() req: any, @Param('id') id: string, @Body() dto: any) { return this.vendorService.update(req.user.tenantId, id, dto); }
  @Delete(':id') remove(@Request() req: any, @Param('id') id: string) { return this.vendorService.softDelete(req.user.tenantId, id); }
}
