import { Module } from '@nestjs/common';
import { GeneralLedgerController } from './gl/gl.controller';
import { GeneralLedgerService } from './gl/gl.service';
import { AccountsPayableController } from './ap/ap.controller';
import { AccountsPayableService } from './ap/ap.service';
import { AccountsReceivableController } from './ar/ar.controller';
import { AccountsReceivableService } from './ar/ar.service';
import { FxRatesService } from './fx/fx-rates.service';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'fx-rates' }),
  ],
  controllers: [
    GeneralLedgerController,
    AccountsPayableController,
    AccountsReceivableController,
  ],
  providers: [
    GeneralLedgerService,
    AccountsPayableService,
    AccountsReceivableService,
    FxRatesService,
  ],
  exports: [GeneralLedgerService, FxRatesService],
})
export class FinanceModule {}
