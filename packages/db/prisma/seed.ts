import { PrismaClient, UserRole, AccountType, EmploymentStatus, LeaveType, LeaveStatus, ProjectStatus, TaskStatus, InvoiceType, InvoiceStatus, PurchaseOrderStatus } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.$transaction([
    prisma.forecastPrediction.deleteMany(),
    prisma.forecastModel.deleteMany(),
    prisma.outboxEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.scheduledReport.deleteMany(),
    prisma.dashboardWidget.deleteMany(),
    prisma.budget.deleteMany(),
    prisma.resourceAllocation.deleteMany(),
    prisma.taskDependency.deleteMany(),
    prisma.task.deleteMany(),
    prisma.milestone.deleteMany(),
    prisma.project.deleteMany(),
    prisma.reorderRule.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.goodsReceipt.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.paymentRun.deleteMany(),
    prisma.vendor.deleteMany(),
    prisma.payslip.deleteMany(),
    prisma.payrollRun.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.leaveRequest.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.department.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.journalEntry.deleteMany(),
    prisma.account.deleteMany(),
    prisma.tenantUser.deleteMany(),
    prisma.user.deleteMany(),
    prisma.tenant.deleteMany(),
  ]);

  // Create Users
  console.log('👤 Creating users...');
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@amdox.dev',
      name: 'Demo User',
      keycloakId: 'demo-keycloak-id',
      isActive: true,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@amdox.dev',
      name: 'Admin User',
      keycloakId: 'admin-keycloak-id',
      isActive: true,
    },
  });

  const users = [demoUser, adminUser];

  // Create 10 more users
  for (let i = 0; i < 10; i++) {
    const user = await prisma.user.create({
      data: {
        email: faker.internet.email().toLowerCase(),
        name: faker.person.fullName(),
        keycloakId: `keycloak-${faker.string.uuid()}`,
        isActive: true,
      },
    });
    users.push(user);
  }

  // Create Tenants
  console.log('🏢 Creating tenants...');
  const acmeTenant = await prisma.tenant.create({
    data: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      domain: 'acme.example.com',
      settings: JSON.stringify({
        currency: 'USD',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
      }),
      isActive: true,
      subscriptionTier: 'ENTERPRISE',
      maxUsers: 100,
      mfaEnforced: true,
      sessionTimeout: 28800,
    },
  });

  const globalTenant = await prisma.tenant.create({
    data: {
      name: 'Global Industries Ltd',
      slug: 'global-industries',
      domain: 'global.example.com',
      settings: JSON.stringify({
        currency: 'EUR',
        timezone: 'Europe/London',
        dateFormat: 'DD/MM/YYYY',
      }),
      isActive: true,
      subscriptionTier: 'PREMIUM',
      maxUsers: 50,
      mfaEnforced: false,
      sessionTimeout: 14400,
    },
  });

  // Link users to tenants
  console.log('🔗 Linking users to tenants...');
  await prisma.tenantUser.create({
    data: {
      tenantId: acmeTenant.id,
      userId: demoUser.id,
      role: UserRole.TENANT_ADMIN,
      isActive: true,
    },
  });

  await prisma.tenantUser.create({
    data: {
      tenantId: acmeTenant.id,
      userId: adminUser.id,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
  });

  // Add remaining users to Acme
  for (let i = 2; i < 7; i++) {
    await prisma.tenantUser.create({
      data: {
        tenantId: acmeTenant.id,
        userId: users[i].id,
        role: i < 4 ? UserRole.MANAGER : UserRole.VIEWER,
        isActive: true,
      },
    });
  }

  // Add some users to Global
  for (let i = 7; i < users.length; i++) {
    await prisma.tenantUser.create({
      data: {
        tenantId: globalTenant.id,
        userId: users[i].id,
        role: UserRole.MANAGER,
        isActive: true,
      },
    });
  }

  // Create Chart of Accounts for Acme
  console.log('💰 Creating chart of accounts...');
  const accounts = await createChartOfAccounts(acmeTenant.id);

  // Create Departments for Acme
  console.log('🏛️ Creating departments...');
  const executiveDept = await prisma.department.create({
    data: {
      tenantId: acmeTenant.id,
      name: 'Executive',
      code: 'EXEC',
      isActive: true,
    },
  });

  const financeDept = await prisma.department.create({
    data: {
      tenantId: acmeTenant.id,
      name: 'Finance',
      code: 'FIN',
      parentId: executiveDept.id,
      isActive: true,
    },
  });

  const hrDept = await prisma.department.create({
    data: {
      tenantId: acmeTenant.id,
      name: 'Human Resources',
      code: 'HR',
      parentId: executiveDept.id,
      isActive: true,
    },
  });

  const salesDept = await prisma.department.create({
    data: {
      tenantId: acmeTenant.id,
      name: 'Sales',
      code: 'SALES',
      isActive: true,
    },
  });

  const itDept = await prisma.department.create({
    data: {
      tenantId: acmeTenant.id,
      name: 'Information Technology',
      code: 'IT',
      isActive: true,
    },
  });

  const opsDept = await prisma.department.create({
    data: {
      tenantId: acmeTenant.id,
      name: 'Operations',
      code: 'OPS',
      isActive: true,
    },
  });

  const departments = [executiveDept, financeDept, hrDept, salesDept, itDept, opsDept];

  // Create Employees for Acme
  console.log('👥 Creating employees...');
  const employees: any[] = [];

  // CEO
  const ceo = await prisma.employee.create({
    data: {
      tenantId: acmeTenant.id,
      employeeNumber: 'EMP-001',
      firstName: 'John',
      lastName: 'Anderson',
      email: 'john.anderson@acme.example.com',
      phone: '+1-555-0101',
      dateOfBirth: new Date('1975-03-15'),
      hireDate: new Date('2015-01-01'),
      departmentId: executiveDept.id,
      jobTitle: 'Chief Executive Officer',
      status: EmploymentStatus.ACTIVE,
      salary: 250000,
      currency: 'USD',
      taxId: 'SSN-123-45-6789',
    },
  });
  employees.push(ceo);

  // Create 49 more employees across departments
  for (let i = 2; i <= 50; i++) {
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const employee = await prisma.employee.create({
      data: {
        tenantId: acmeTenant.id,
        employeeNumber: `EMP-${i.toString().padStart(3, '0')}`,
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: `emp${i}@acme.example.com`,
        phone: faker.phone.number(),
        dateOfBirth: faker.date.birthdate({ min: 25, max: 60, mode: 'age' }),
        hireDate: faker.date.past({ years: 10 }),
        departmentId: dept.id,
        managerId: i > 6 ? employees[Math.floor(Math.random() * Math.min(5, employees.length))].id : ceo.id,
        jobTitle: faker.person.jobTitle(),
        status: EmploymentStatus.ACTIVE,
        salary: faker.number.int({ min: 40000, max: 150000 }),
        currency: 'USD',
        taxId: `SSN-${faker.number.int({ min: 100, max: 999 })}-${faker.number.int({ min: 10, max: 99 })}-${faker.number.int({ min: 1000, max: 9999 })}`,
      },
    });
    employees.push(employee);
  }

  // Create Leave Requests
  console.log('🏖️ Creating leave requests...');
  for (let i = 0; i < 30; i++) {
    const employee = employees[Math.floor(Math.random() * employees.length)];
    const startDate = faker.date.future({ years: 0.3 });
    const days = faker.number.int({ min: 1, max: 10 });
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);

    await prisma.leaveRequest.create({
      data: {
        tenantId: acmeTenant.id,
        employeeId: employee.id,
        leaveType: faker.helpers.arrayElement([LeaveType.ANNUAL, LeaveType.SICK, LeaveType.CASUAL]),
        startDate,
        endDate,
        days,
        reason: faker.lorem.sentence(),
        status: faker.helpers.arrayElement([LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.REJECTED]),
      },
    });
  }

  // Create Attendance records
  console.log('⏰ Creating attendance records...');
  const last30Days = 30;
  for (let day = 0; day < last30Days; day++) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (let i = 0; i < Math.min(20, employees.length); i++) {
      const employee = employees[i];
      const clockIn = new Date(date);
      clockIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0);
      
      const clockOut = new Date(clockIn);
      clockOut.setHours(clockIn.getHours() + 8 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60), 0);

      const regularHours = Math.min(8, (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60));
      const overtimeHours = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60) - 8);

      await prisma.attendance.create({
        data: {
          tenantId: acmeTenant.id,
          employeeId: employee.id,
          date,
          clockIn,
          clockOut,
          regularHours,
          overtimeHours,
          isAbsent: false,
        },
      });
    }
  }

  // Create Payroll Run
  console.log('💵 Creating payroll run...');
  const payrollRun = await prisma.payrollRun.create({
    data: {
      tenantId: acmeTenant.id,
      runNumber: 'PR-2026-04',
      periodStart: new Date('2026-04-01'),
      periodEnd: new Date('2026-04-30'),
      paymentDate: new Date('2026-05-05'),
      status: 'COMPLETED',
      employeeCount: employees.length,
      totalGross: employees.reduce((sum, e) => sum + parseFloat(e.salary.toString()), 0),
      totalDeductions: employees.reduce((sum, e) => sum + parseFloat(e.salary.toString()) * 0.25, 0),
      totalNet: employees.reduce((sum, e) => sum + parseFloat(e.salary.toString()) * 0.75, 0),
      processedBy: adminUser.id,
      processedAt: new Date(),
    },
  });

  // Create Payslips for first 10 employees
  console.log('📄 Creating payslips...');
  for (let i = 0; i < Math.min(10, employees.length); i++) {
    const employee = employees[i];
    const monthlySalary = parseFloat(employee.salary.toString()) / 12;
    const grossPay = monthlySalary;
    const pfDeduction = grossPay * 0.12;
    const esiDeduction = grossPay * 0.0075;
    const taxDeduction = grossPay * 0.15;
    const totalDeductions = pfDeduction + esiDeduction + taxDeduction;
    const netPay = grossPay - totalDeductions;

    await prisma.payslip.create({
      data: {
        tenantId: acmeTenant.id,
        payrollRunId: payrollRun.id,
        employeeId: employee.id,
        payslipNumber: `PS-2026-04-${(i + 1).toString().padStart(3, '0')}`,
        periodStart: new Date('2026-04-01'),
        periodEnd: new Date('2026-04-30'),
        paymentDate: new Date('2026-05-05'),
        basicSalary: monthlySalary,
        allowances: JSON.stringify([
          { name: 'House Rent Allowance', amount: monthlySalary * 0.4 },
          { name: 'Transport Allowance', amount: 1600 },
        ]),
        grossPay,
        taxDeductions: JSON.stringify([
          { name: 'Income Tax', amount: taxDeduction },
        ]),
        statutoryDeductions: JSON.stringify([
          { name: 'Provident Fund (12%)', amount: pfDeduction },
          { name: 'ESI (0.75%)', amount: esiDeduction },
        ]),
        otherDeductions: JSON.stringify([]),
        totalDeductions,
        netPay,
      },
    });
  }

  // Create Vendors
  console.log('🏪 Creating vendors...');
  const vendors: any[] = [];
  for (let i = 1; i <= 20; i++) {
    const vendor = await prisma.vendor.create({
      data: {
        tenantId: acmeTenant.id,
        vendorNumber: `VEN-${i.toString().padStart(4, '0')}`,
        name: faker.company.name(),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.number(),
        website: faker.internet.url(),
        taxId: `TAX-${faker.number.int({ min: 100000, max: 999999 })}`,
        paymentTerms: 'Net 30',
        creditLimit: faker.number.int({ min: 50000, max: 500000 }),
        contactPerson: faker.person.fullName(),
        isActive: true,
        portalAccessEnabled: i <= 10,
      },
    });
    vendors.push(vendor);
  }

  // Create Warehouses
  console.log('🏭 Creating warehouses...');
  const warehouse = await prisma.warehouse.create({
    data: {
      tenantId: acmeTenant.id,
      code: 'WH-MAIN',
      name: 'Main Warehouse',
      address: JSON.stringify({
        street: '123 Industrial Park',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA',
      }),
      isActive: true,
    },
  });

  // Create Inventory Items
  console.log('📦 Creating inventory items...');
  const inventoryItems: any[] = [];
  const categories = ['Electronics', 'Office Supplies', 'Furniture', 'Raw Materials', 'Finished Goods', 'Tools & Equipment'];
  
  for (let i = 1; i <= 200; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const costPrice = faker.number.int({ min: 10, max: 1000 });
    const currentStock = faker.number.int({ min: 0, max: 1000 });
    
    const item = await prisma.inventoryItem.create({
      data: {
        tenantId: acmeTenant.id,
        sku: `SKU-${i.toString().padStart(6, '0')}`,
        name: `${faker.commerce.productAdjective()} ${faker.commerce.product()}`,
        description: faker.commerce.productDescription(),
        category,
        unit: faker.helpers.arrayElement(['PCS', 'BOX', 'KG', 'LTR', 'MTR']),
        costPrice,
        sellingPrice: costPrice * 1.5,
        reorderPoint: 50,
        reorderQuantity: 200,
        currentStock,
        reservedStock: Math.floor(currentStock * 0.1),
        availableStock: Math.floor(currentStock * 0.9),
        warehouseId: warehouse.id,
        isActive: true,
      },
    });
    inventoryItems.push(item);
  }

  // Create Purchase Orders
  console.log('📋 Creating purchase orders...');
  for (let i = 1; i <= 30; i++) {
    const vendor = vendors[Math.floor(Math.random() * vendors.length)];
    const orderDate = faker.date.past({ years: 0.5 });
    const expectedDate = new Date(orderDate);
    expectedDate.setDate(expectedDate.getDate() + 14);

    const subtotal = faker.number.int({ min: 5000, max: 50000 });
    const taxAmount = subtotal * 0.1;

    await prisma.purchaseOrder.create({
      data: {
        tenantId: acmeTenant.id,
        poNumber: `PO-${new Date().getFullYear()}-${i.toString().padStart(4, '0')}`,
        vendorId: vendor.id,
        orderDate,
        expectedDate,
        status: faker.helpers.arrayElement([
          PurchaseOrderStatus.APPROVED,
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
          PurchaseOrderStatus.RECEIVED,
        ]),
        subtotal,
        taxAmount,
        totalAmount: subtotal + taxAmount,
        currency: 'USD',
        createdBy: adminUser.id,
        approvedBy: adminUser.id,
        approvedAt: orderDate,
      },
    });
  }

  // Create Invoices (AP and AR)
  console.log('🧾 Creating invoices...');
  for (let i = 1; i <= 100; i++) {
    const isPayable = i <= 60; // 60 AP, 40 AR
    const invoiceDate = faker.date.past({ years: 0.5 });
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const subtotal = faker.number.int({ min: 1000, max: 25000 });
    const taxAmount = subtotal * 0.1;
    const totalAmount = subtotal + taxAmount;
    
    const isPaid = Math.random() > 0.3;
    const paidAmount = isPaid ? totalAmount : (Math.random() > 0.5 ? totalAmount * 0.5 : 0);

    let status = InvoiceStatus.DRAFT;
    if (paidAmount === totalAmount) status = InvoiceStatus.PAID;
    else if (paidAmount > 0) status = InvoiceStatus.PARTIALLY_PAID;
    else if (new Date() > dueDate) status = InvoiceStatus.OVERDUE;
    else status = InvoiceStatus.APPROVED;

    await prisma.invoice.create({
      data: {
        tenantId: acmeTenant.id,
        invoiceNumber: `INV-${new Date().getFullYear()}-${i.toString().padStart(5, '0')}`,
        type: isPayable ? InvoiceType.PAYABLE : InvoiceType.RECEIVABLE,
        vendorId: isPayable ? vendors[Math.floor(Math.random() * vendors.length)].id : null,
        customerId: !isPayable ? `CUST-${faker.number.int({ min: 1000, max: 9999 })}` : null,
        invoiceDate,
        dueDate,
        status,
        subtotal,
        taxAmount,
        totalAmount,
        paidAmount,
        currency: 'USD',
        exchangeRate: 1,
        paymentTerms: 'Net 30',
        approvedBy: adminUser.id,
        approvedAt: invoiceDate,
        paidAt: isPaid ? new Date() : null,
      },
    });
  }

  // Create Projects
  console.log('🎯 Creating projects...');
  const projects: any[] = [];
  const projectNames = [
    'ERP System Implementation',
    'Digital Transformation Initiative',
    'Cloud Migration Project',
    'Customer Portal Development',
    'Mobile App Modernization',
  ];

  for (let i = 0; i < projectNames.length; i++) {
    const startDate = faker.date.past({ years: 0.3 });
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 6);

    const budget = faker.number.int({ min: 100000, max: 500000 });
    const actualCost = budget * faker.number.float({ min: 0.5, max: 1.2 });

    const project = await prisma.project.create({
      data: {
        tenantId: acmeTenant.id,
        projectNumber: `PROJ-${(i + 1).toString().padStart(4, '0')}`,
        name: projectNames[i],
        description: faker.lorem.paragraph(),
        status: faker.helpers.arrayElement([
          ProjectStatus.PLANNING,
          ProjectStatus.ACTIVE,
          ProjectStatus.ACTIVE,
          ProjectStatus.COMPLETED,
        ]),
        startDate,
        endDate,
        budget,
        actualCost,
        currency: 'USD',
        managerId: employees[Math.floor(Math.random() * 5)].id,
        clientName: faker.company.name(),
      },
    });
    projects.push(project);

    // Create Milestones
    const milestones: any[] = [];
    for (let m = 1; m <= 4; m++) {
      const milestone = await prisma.milestone.create({
        data: {
          projectId: project.id,
          name: `Phase ${m}`,
          description: faker.lorem.sentence(),
          dueDate: new Date(startDate.getTime() + (endDate.getTime() - startDate.getTime()) * (m / 4)),
          isCompleted: m <= 2,
          completedAt: m <= 2 ? new Date() : null,
        },
      });
      milestones.push(milestone);
    }

    // Create Tasks
    const tasks: any[] = [];
    for (let t = 1; t <= 12; t++) {
      const milestone = milestones[Math.floor((t - 1) / 3)];
      const task = await prisma.task.create({
        data: {
          projectId: project.id,
          milestoneId: milestone.id,
          title: `Task ${t}: ${faker.hacker.verb()} ${faker.hacker.noun()}`,
          description: faker.lorem.paragraph(),
          status: faker.helpers.arrayElement([
            TaskStatus.TODO,
            TaskStatus.IN_PROGRESS,
            TaskStatus.COMPLETED,
            TaskStatus.REVIEW,
          ]),
          priority: faker.number.int({ min: 1, max: 5 }),
          estimatedHours: faker.number.int({ min: 8, max: 80 }),
          actualHours: faker.number.int({ min: 0, max: 100 }),
        },
      });
      tasks.push(task);

      // Create Resource Allocations
      const assignedEmployees = faker.helpers.arrayElements(
        employees.slice(0, 20),
        faker.number.int({ min: 1, max: 3 })
      );

      for (const emp of assignedEmployees) {
        await prisma.resourceAllocation.create({
          data: {
            taskId: task.id,
            employeeId: emp.id,
            allocatedHours: faker.number.int({ min: 8, max: 40 }),
            startDate: startDate,
            endDate: endDate,
          },
        });
      }
    }

    // Create Task Dependencies (ensure no cycles)
    for (let t = 1; t < Math.min(5, tasks.length); t++) {
      await prisma.taskDependency.create({
        data: {
          taskId: tasks[t].id,
          dependsOnTaskId: tasks[t - 1].id,
        },
      });
    }

    // Create Budget categories
    const budgetCategories = ['Development', 'Infrastructure', 'Consulting', 'Training'];
    for (const category of budgetCategories) {
      await prisma.budget.create({
        data: {
          projectId: project.id,
          category,
          plannedAmount: budget / budgetCategories.length,
          actualAmount: actualCost / budgetCategories.length,
        },
      });
    }
  }

  // Create Journal Entries
  console.log('📒 Creating journal entries...');
  for (let i = 1; i <= 20; i++) {
    const entryDate = faker.date.past({ years: 0.3 });
    const debitAccount = accounts.find(a => a.type === AccountType.EXPENSE);
    const creditAccount = accounts.find(a => a.type === AccountType.ASSET && a.code === '1000');
    const amount = faker.number.int({ min: 1000, max: 10000 });

    if (debitAccount && creditAccount) {
      const journalEntry = await prisma.journalEntry.create({
        data: {
          tenantId: acmeTenant.id,
          entryNumber: `JE-${new Date().getFullYear()}-${i.toString().padStart(5, '0')}`,
          description: faker.finance.transactionDescription(),
          entryDate,
          postingDate: entryDate,
          status: 'POSTED',
          isBalanced: true,
          totalDebit: amount,
          totalCredit: amount,
          createdBy: adminUser.id,
          approvedBy: adminUser.id,
          approvedAt: entryDate,
        },
      });

      await prisma.transaction.createMany({
        data: [
          {
            tenantId: acmeTenant.id,
            journalEntryId: journalEntry.id,
            accountId: debitAccount.id,
            type: 'DEBIT',
            amount,
            currency: 'USD',
            exchangeRate: 1,
            baseCurrencyAmount: amount,
            description: 'Expense transaction',
          },
          {
            tenantId: acmeTenant.id,
            journalEntryId: journalEntry.id,
            accountId: creditAccount.id,
            type: 'CREDIT',
            amount,
            currency: 'USD',
            exchangeRate: 1,
            baseCurrencyAmount: amount,
            description: 'Cash payment',
          },
        ],
      });
    }
  }

  // Create Dashboard Widgets
  console.log('📊 Creating dashboard widgets...');
  await prisma.dashboardWidget.createMany({
    data: [
      {
        tenantId: acmeTenant.id,
        dashboardId: 'executive-dashboard',
        type: 'kpi',
        title: 'Total Revenue',
        config: JSON.stringify({ metric: 'revenue', period: 'monthly' }),
        position: JSON.stringify({ x: 0, y: 0, w: 3, h: 2 }),
      },
      {
        tenantId: acmeTenant.id,
        dashboardId: 'executive-dashboard',
        type: 'chart',
        title: 'Revenue Trend',
        config: JSON.stringify({ chartType: 'line', dataSource: 'revenue' }),
        position: JSON.stringify({ x: 3, y: 0, w: 6, h: 4 }),
      },
      {
        tenantId: acmeTenant.id,
        dashboardId: 'executive-dashboard',
        type: 'kpi',
        title: 'Active Projects',
        config: JSON.stringify({ metric: 'projects', status: 'active' }),
        position: JSON.stringify({ x: 0, y: 2, w: 3, h: 2 }),
      },
    ],
  });

  // Create Notifications
  console.log('🔔 Creating notifications...');
  await prisma.notification.createMany({
    data: [
      {
        tenantId: acmeTenant.id,
        userId: demoUser.id,
        channel: 'IN_APP',
        eventType: 'INVOICE_APPROVED',
        title: 'Invoice Approved',
        message: 'Your invoice INV-2026-00001 has been approved',
        status: 'SENT',
        sentAt: new Date(),
      },
      {
        tenantId: acmeTenant.id,
        userId: demoUser.id,
        channel: 'EMAIL',
        eventType: 'PAYROLL_COMPLETED',
        title: 'Payroll Processed',
        message: 'Payroll run PR-2026-04 has been completed successfully',
        status: 'SENT',
        sentAt: new Date(),
      },
    ],
  });

  console.log('✅ Seed completed successfully!');
  console.log(`
  📊 Summary:
  - Tenants: 2 (Acme Corporation, Global Industries)
  - Users: ${users.length}
  - Employees: ${employees.length}
  - Vendors: ${vendors.length}
  - Inventory Items: ${inventoryItems.length}
  - Projects: ${projects.length}
  - Invoices: 100
  - Leave Requests: 30
  - Journal Entries: 20
  
  🔐 Demo Credentials:
  - Email: demo@amdox.dev
  - Password: Demo@1234 (configure in Keycloak)
  `);
}

async function createChartOfAccounts(tenantId: string) {
  const accounts = [];

  // Assets (1000-1999)
  const cash = await prisma.account.create({
    data: {
      tenantId,
      code: '1000',
      name: 'Cash',
      type: AccountType.ASSET,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(cash);

  const accountsReceivable = await prisma.account.create({
    data: {
      tenantId,
      code: '1200',
      name: 'Accounts Receivable',
      type: AccountType.ASSET,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(accountsReceivable);

  const inventory = await prisma.account.create({
    data: {
      tenantId,
      code: '1300',
      name: 'Inventory',
      type: AccountType.ASSET,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(inventory);

  const fixedAssets = await prisma.account.create({
    data: {
      tenantId,
      code: '1500',
      name: 'Fixed Assets',
      type: AccountType.ASSET,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(fixedAssets);

  // Liabilities (2000-2999)
  const accountsPayable = await prisma.account.create({
    data: {
      tenantId,
      code: '2000',
      name: 'Accounts Payable',
      type: AccountType.LIABILITY,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(accountsPayable);

  const salariesPayable = await prisma.account.create({
    data: {
      tenantId,
      code: '2100',
      name: 'Salaries Payable',
      type: AccountType.LIABILITY,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(salariesPayable);

  const taxesPayable = await prisma.account.create({
    data: {
      tenantId,
      code: '2200',
      name: 'Taxes Payable',
      type: AccountType.LIABILITY,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(taxesPayable);

  // Equity (3000-3999)
  const ownersEquity = await prisma.account.create({
    data: {
      tenantId,
      code: '3000',
      name: 'Owner\'s Equity',
      type: AccountType.EQUITY,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(ownersEquity);

  const retainedEarnings = await prisma.account.create({
    data: {
      tenantId,
      code: '3100',
      name: 'Retained Earnings',
      type: AccountType.EQUITY,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(retainedEarnings);

  // Revenue (4000-4999)
  const salesRevenue = await prisma.account.create({
    data: {
      tenantId,
      code: '4000',
      name: 'Sales Revenue',
      type: AccountType.REVENUE,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(salesRevenue);

  const serviceRevenue = await prisma.account.create({
    data: {
      tenantId,
      code: '4100',
      name: 'Service Revenue',
      type: AccountType.REVENUE,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(serviceRevenue);

  // Expenses (5000-5999)
  const costOfGoodsSold = await prisma.account.create({
    data: {
      tenantId,
      code: '5000',
      name: 'Cost of Goods Sold',
      type: AccountType.EXPENSE,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(costOfGoodsSold);

  const salariesExpense = await prisma.account.create({
    data: {
      tenantId,
      code: '5100',
      name: 'Salaries Expense',
      type: AccountType.EXPENSE,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(salariesExpense);

  const rentExpense = await prisma.account.create({
    data: {
      tenantId,
      code: '5200',
      name: 'Rent Expense',
      type: AccountType.EXPENSE,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(rentExpense);

  const utilitiesExpense = await prisma.account.create({
    data: {
      tenantId,
      code: '5300',
      name: 'Utilities Expense',
      type: AccountType.EXPENSE,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(utilitiesExpense);

  const marketingExpense = await prisma.account.create({
    data: {
      tenantId,
      code: '5400',
      name: 'Marketing Expense',
      type: AccountType.EXPENSE,
      currency: 'USD',
      isActive: true,
    },
  });
  accounts.push(marketingExpense);

  return accounts;
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
