import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService } from './report.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('BI - Reports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'bi/reports', version: '1' })
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Get() getReports(@Request() req: any) { return this.reportService.getReports(req.user.tenantId); }
  @Post('schedule') scheduleReport(@Request() req: any, @Body() dto: any) { return this.reportService.scheduleReport(req.user.tenantId, req.user.id, dto); }
  @Post('generate') generateReport(@Request() req: any, @Body('reportType') type: string, @Body('params') params: any) { return this.reportService.generateReport(req.user.tenantId, type, params); }
}
