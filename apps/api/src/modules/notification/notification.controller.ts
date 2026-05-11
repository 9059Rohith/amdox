import { Controller, Get, Sse, Query, Request, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for current user' })
  getNotifications(@Request() req: any, @Query() params: any) {
    return this.notificationService.getNotifications(req.user.tenantId, req.user.id, params);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream for real-time in-app notifications' })
  stream(@Request() req: any, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    this.notificationService.addSseClient(req.user.tenantId, req.user.id, res);
    return res;
  }
}
