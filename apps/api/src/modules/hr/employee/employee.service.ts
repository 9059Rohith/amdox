import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { PRISMA_SERVICE } from '../../database/database.module';

@Injectable()
export class EmployeeService {
  constructor(@Inject(PRISMA_SERVICE) private prisma: PrismaClient) {}

  async findAll(tenantId: string, params: any) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = { tenantId, deletedAt: null };
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: { department: true, manager: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { lastName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        department: true,
        manager: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
        directReports: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      },
    });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async create(tenantId: string, dto: any) {
    const count = await this.prisma.employee.count({ where: { tenantId } });
    const employeeNumber = `EMP-${String(count + 1).padStart(5, '0')}`;
    return this.prisma.employee.create({
      data: { ...dto, tenantId, employeeNumber },
      include: { department: true },
    });
  }

  async update(tenantId: string, id: string, dto: any) {
    await this.findOne(tenantId, id);
    return this.prisma.employee.update({
      where: { id },
      data: dto,
      include: { department: true },
    });
  }

  async softDelete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'TERMINATED' },
    });
  }

  // Recursive CTE org chart
  async getOrgChart(tenantId: string) {
    const result = await this.prisma.$queryRaw<any[]>`
      WITH RECURSIVE org AS (
        SELECT id, first_name, last_name, job_title, manager_id, department_id, 0 as depth
        FROM employees
        WHERE tenant_id = ${tenantId}
          AND manager_id IS NULL
          AND deleted_at IS NULL
        UNION ALL
        SELECT e.id, e.first_name, e.last_name, e.job_title, e.manager_id, e.department_id, o.depth + 1
        FROM employees e
        INNER JOIN org o ON o.id = e.manager_id
        WHERE e.deleted_at IS NULL
      )
      SELECT * FROM org ORDER BY depth, last_name
    `;
    return result;
  }
}
