import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('HR - Leave Management')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'hr/leaves', version: '1' })
export class LeaveController {
  constructor(private leaveService: LeaveService) {}

  @Get()
  @ApiOperation({ summary: 'List leave requests' })
  getLeaveRequests(@Request() req: any, @Query() params: any) {
    return this.leaveService.getLeaveRequests(req.user.tenantId, params);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a leave request (state: PENDING)' })
  requestLeave(@Request() req: any, @Body() dto: any) {
    return this.leaveService.requestLeave(req.user.tenantId, dto.employeeId || req.user.id, dto);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve leave request (PENDING → APPROVED)' })
  approveLeave(@Request() req: any, @Param('id') id: string) {
    return this.leaveService.approveLeave(req.user.tenantId, id, req.user.id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject leave request (PENDING → REJECTED)' })
  rejectLeave(@Request() req: any, @Param('id') id: string, @Body('reason') reason: string) {
    return this.leaveService.rejectLeave(req.user.tenantId, id, req.user.id, reason);
  }
}
