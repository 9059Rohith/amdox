import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, JournalEntryStatus } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class GeneralLedgerService {
  constructor(
    @Inject(PRISMA_SERVICE) private prisma: PrismaClient,
    private events: EventEmitter2,
  ) {}

  async getChartOfAccounts(tenantId: string) {
    return this.prisma.account.findMany({
      where: { tenantId, deletedAt: null },
      include: { children: { where: { deletedAt: null } } },
      orderBy: [{ code: 'asc' }],
    });
  }

  async createJournalEntry(tenantId: string, userId: string, dto: CreateJournalEntryDto) {
    // Validate double-entry: debits must equal credits
    const totalDebit = dto.lines
      .filter((l) => l.type === 'DEBIT')
      .reduce((sum, l) => sum + Number(l.amount), 0);
    const totalCredit = dto.lines
      .filter((l) => l.type === 'CREDIT')
      .reduce((sum, l) => sum + Number(l.amount), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      throw new BadRequestException(
        `Journal entry is unbalanced: debits=${totalDebit} credits=${totalCredit}`,
      );
    }

    const entryNumber = await this.generateEntryNumber(tenantId);

    const entry = await this.prisma.journalEntry.create({
      data: {
        tenantId,
        entryNumber,
        description: dto.description,
        entryDate: new Date(dto.entryDate),
        status: JournalEntryStatus.DRAFT,
        isBalanced: true,
        totalDebit,
        totalCredit,
        createdBy: userId,
        transactions: {
          create: dto.lines.map((line) => ({
            tenantId,
            accountId: line.accountId,
            type: line.type,
            amount: line.amount,
            currency: line.currency || 'USD',
            exchangeRate: line.exchangeRate || 1,
            baseCurrencyAmount: Number(line.amount) * (line.exchangeRate || 1),
            description: line.description,
          })),
        },
      },
      include: { transactions: true },
    });

    this.events.emit('gl.journal_entry.created', { tenantId, entryId: entry.id, userId });
    return entry;
  }

  async postJournalEntry(tenantId: string, entryId: string, userId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: entryId, tenantId, deletedAt: null },
    });
    if (!entry) throw new NotFoundException('Journal entry not found');
    if (entry.status !== JournalEntryStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT entries can be posted');
    }

    const posted = await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        status: JournalEntryStatus.POSTED,
        postingDate: new Date(),
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    this.events.emit('gl.journal_entry.posted', { tenantId, entryId, userId });
    return posted;
  }

  async getJournalEntries(tenantId: string, params: { page?: number; limit?: number; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, deletedAt: null };
    if (params.status) where.status = params.status;

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: { transactions: { include: { account: true } } },
        orderBy: { entryDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { data: entries, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getTrialBalance(tenantId: string, asOf?: string) {
    const date = asOf ? new Date(asOf) : new Date();
    const accounts = await this.prisma.$queryRaw<any[]>`
      SELECT
        a.id, a.code, a.name, a.type,
        COALESCE(SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE 0 END), 0) as total_debit,
        COALESCE(SUM(CASE WHEN t.type = 'CREDIT' THEN t.amount ELSE 0 END), 0) as total_credit,
        COALESCE(SUM(CASE WHEN t.type = 'DEBIT' THEN t.amount ELSE -t.amount END), 0) as balance
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = t.journal_entry_id
        AND je.status = 'POSTED'
        AND je.entry_date <= ${date}
      WHERE a.tenant_id = ${tenantId}
        AND a.deleted_at IS NULL
      GROUP BY a.id, a.code, a.name, a.type
      ORDER BY a.code
    `;
    return accounts;
  }

  private async generateEntryNumber(tenantId: string): Promise<string> {
    const count = await this.prisma.journalEntry.count({ where: { tenantId } });
    const year = new Date().getFullYear();
    return `JE-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}
