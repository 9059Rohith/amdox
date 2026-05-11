import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('HR - Employees')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'hr/employees', version: '1' })
export class EmployeeController {
  constructor(private employeeService: EmployeeService) {}

  @Get()
  @ApiOperation({ summary: 'List all employees with filtering' })
  findAll(@Request() req: any, @Query() params: any) {
    return this.employeeService.findAll(req.user.tenantId, params);
  }

  @Get('org-chart')
  @ApiOperation({ summary: 'Get org chart (recursive CTE)' })
  getOrgChart(@Request() req: any) {
    return this.employeeService.getOrgChart(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee by ID' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.employeeService.findOne(req.user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create employee' })
  create(@Request() req: any, @Body() dto: any) {
    return this.employeeService.create(req.user.tenantId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update employee' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.employeeService.update(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete employee (sets terminationDate)' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.employeeService.softDelete(req.user.tenantId, id);
  }
}
