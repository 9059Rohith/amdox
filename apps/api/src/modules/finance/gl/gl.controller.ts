import { Controller, Get, Post, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GeneralLedgerService } from './gl.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('Finance - General Ledger')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'finance/gl', version: '1' })
export class GeneralLedgerController {
  constructor(private glService: GeneralLedgerService) {}

  @Get('chart-of-accounts')
  @ApiOperation({ summary: 'Get chart of accounts' })
  getChartOfAccounts(@Request() req: any) {
    return this.glService.getChartOfAccounts(req.user.tenantId);
  }

  @Get('trial-balance')
  @ApiOperation({ summary: 'Get trial balance as of a date' })
  getTrialBalance(@Request() req: any, @Query('asOf') asOf?: string) {
    return this.glService.getTrialBalance(req.user.tenantId, asOf);
  }

  @Get('journal-entries')
  @ApiOperation({ summary: 'List journal entries with pagination' })
  getJournalEntries(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.glService.getJournalEntries(req.user.tenantId, { page, limit, status });
  }

  @Post('journal-entries')
  @ApiOperation({ summary: 'Create a double-entry journal entry (validated)' })
  createJournalEntry(@Request() req: any, @Body() dto: CreateJournalEntryDto) {
    return this.glService.createJournalEntry(req.user.tenantId, req.user.id, dto);
  }

  @Patch('journal-entries/:id/post')
  @ApiOperation({ summary: 'Post a draft journal entry' })
  postJournalEntry(@Request() req: any, @Param('id') id: string) {
    return this.glService.postJournalEntry(req.user.tenantId, id, req.user.id);
  }
}
