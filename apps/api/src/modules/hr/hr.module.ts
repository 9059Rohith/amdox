import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmployeeController } from './employee/employee.controller';
import { EmployeeService } from './employee/employee.service';
import { LeaveController } from './leave/leave.controller';
import { LeaveService } from './leave/leave.service';
import { PayrollController } from './payroll/payroll.controller';
import { PayrollService } from './payroll/payroll.service';
import { PayrollProcessor } from './payroll/payroll.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'payroll' }),
    BullModule.registerQueue({ name: 'email' }),
  ],
  controllers: [EmployeeController, LeaveController, PayrollController],
  providers: [EmployeeService, LeaveService, PayrollService, PayrollProcessor],
  exports: [EmployeeService, PayrollService],
})
export class HrModule {}
