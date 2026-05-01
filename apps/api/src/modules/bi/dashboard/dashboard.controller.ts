import { Controller, Get, Post, Body, Query, Request, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('BI - Dashboard')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'bi/dashboard', version: '1' })
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Real-time KPI metrics (cached 60s, SSE refreshed)' })
  getMetrics(@Request() req: any) {
    return this.dashboardService.getMetrics(req.user.tenantId);
  }

  @Get('charts/revenue')
  @ApiOperation({ summary: 'Revenue vs expenses chart data (bar/line)' })
  getRevenueChart(@Request() req: any, @Query('period') period: string) {
    return this.dashboardService.getRevenueChart(req.user.tenantId, period);
  }

  @Get('drill-down')
  @ApiOperation({ summary: 'Drill-down: click chart segment → filtered table' })
  getDrillDown(@Request() req: any, @Query('chart') chart: string, @Query('segment') segment: string) {
    return this.dashboardService.getDrillDown(req.user.tenantId, chart, segment);
  }

  @Get('config')
  @ApiOperation({ summary: 'Get user dashboard widget config' })
  getConfig(@Request() req: any) {
    return this.dashboardService.getDashboardConfig(req.user.tenantId, req.user.id);
  }

  @Post('config')
  @ApiOperation({ summary: 'Save drag-and-drop widget config (JSON)' })
  saveConfig(@Request() req: any, @Body() config: any) {
    return this.dashboardService.saveDashboardConfig(req.user.tenantId, req.user.id, config);
  }
}
