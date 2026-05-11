import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { VendorController } from './vendor/vendor.controller';
import { VendorService } from './vendor/vendor.service';
import { PurchaseOrderController } from './purchase-order/po.controller';
import { PurchaseOrderService } from './purchase-order/po.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { ReorderProcessor } from './inventory/reorder.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'reorder' }),
    BullModule.registerQueue({ name: 'email' }),
  ],
  controllers: [VendorController, PurchaseOrderController, InventoryController],
  providers: [VendorService, PurchaseOrderService, InventoryService, ReorderProcessor],
  exports: [InventoryService],
})
export class SupplyChainModule {}
