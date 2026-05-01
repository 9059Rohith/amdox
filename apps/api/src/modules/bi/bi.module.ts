import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { ReportController } from './report/report.controller';
import { ReportService } from './report/report.service';
import { ReportProcessor } from './report/report.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'reports' })],
  controllers: [DashboardController, ReportController],
  providers: [DashboardService, ReportService, ReportProcessor],
  exports: [DashboardService],
})
export class BiModule {}
