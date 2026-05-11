# AMX-ERP-2026-04 IMPLEMENTATION GUIDE
**Complete Implementation Roadmap to 95/100 Score**

## 🎯 EXECUTIVE SUMMARY

This document provides step-by-step implementation instructions for all missing features identified in the audit. Follow this sequentially for maximum efficiency.

---

## ✅ COMPLETED (Phase 0)

### Foundation Setup
- [x] Turborepo + pnpm workspaces
- [x] Comprehensive Prisma schema (all models)
- [x] Docker Compose with 17 services
- [x] Basic module structure (API, Web, ML)
- [x] ADRs (5 documents)
- [x] Husky hooks (.husky/pre-commit, .husky/commit-msg)
- [x] packages/eslint-config
- [x] AUDIT_REPORT.md created

**Estimated Current Score: 45/100**

---

## 🔴 PHASE 1: CRITICAL FOUNDATION (Priority 1)

### 1.1 Prisma Migrations & Database Setup

**File: `packages/db/prisma/migrations/`**

```bash
# Generate initial migration
cd packages/db
npx prisma migrate dev --name init

# This will create:
# packages/db/prisma/migrations/20260510_init/migration.sql
```

**File: `packages/db/src/middleware.ts`** (Tenant Isolation RLS)

```typescript
import { Prisma } from '@prisma/client';

export function createTenantMiddleware(tenantId: string): Prisma.Middleware {
  return async (params, next) => {
    // Skip for Tenant and User models
    if (['Tenant', 'User', 'TenantUser'].includes(params.model || '')) {
      return next(params);
    }

    // Inject tenantId filter for all queries
    if (params.action === 'findMany' || params.action === 'findFirst' || 
        params.action === 'findUnique' || params.action === 'count' ||
        params.action === 'aggregate') {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      params.args.where.tenantId = tenantId;
    }

    // Inject tenantId for create operations
    if (params.action === 'create') {
      params.args = params.args || {};
      params.args.data = params.args.data || {};
      if (!params.args.data.tenantId) {
        params.args.data.tenantId = tenantId;
      }
    }

    // Inject tenantId for update/delete operations
    if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      params.args.where.tenantId = tenantId;
    }

    return next(params);
  };
}
```

Update `packages/db/src/index.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { createTenantMiddleware } from './middleware';

export * from '@prisma/client';
export { createTenantMiddleware };

// Global Prisma client for system-level operations
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

// Factory function to create tenant-scoped Prisma client
export function createTenantPrismaClient(tenantId: string) {
  const client = new PrismaClient();
  client.$use(createTenantMiddleware(tenantId));
  return client;
}
```

### 1.2 Complete Seed Script

**File: `packages/db/prisma/seed.ts`**

```typescript
import { PrismaClient, UserRole, AccountType, JournalEntryStatus, EmploymentStatus, LeaveType, LeaveStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Tenants
  const tenant1 = await prisma.tenant.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      id: 'tenant_acme',
      name: 'Acme Corporation',
      slug: 'acme-corp',
      domain: 'acme.example.com',
      isActive: true,
      subscriptionTier: 'ENTERPRISE',
      maxUsers: 500,
      mfaEnforced: true,
    },
  });

  const tenant2 = await prisma.tenant.upsert({
    where: { slug: 'beta-industries' },
    update: {},
    create: {
      id: 'tenant_beta',
      name: 'Beta Industries',
      slug: 'beta-industries',
      domain: 'beta.example.com',
      isActive: true,
      subscriptionTier: 'STANDARD',
      maxUsers: 100,
      mfaEnforced: false,
    },
  });

  console.log('✅ Tenants created');

  // Create Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@acme.example.com' },
    update: {},
    create: {
      email: 'admin@acme.example.com',
      name: 'Admin User',
      keycloakId: 'kc_admin_001',
      isActive: true,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@acme.example.com' },
    update: {},
    create: {
      email: 'manager@acme.example.com',
      name: 'Manager User',
      keycloakId: 'kc_manager_001',
      isActive: true,
    },
  });

  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@acme.example.com' },
    update: {},
    create: {
      email: 'viewer@acme.example.com',
      name: 'Viewer User',
      keycloakId: 'kc_viewer_001',
      isActive: true,
    },
  });

  console.log('✅ Users created');

  // Link Users to Tenants
  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant1.id, userId: adminUser.id } },
    update: {},
    create: {
      tenantId: tenant1.id,
      userId: adminUser.id,
      role: UserRole.TENANT_ADMIN,
    },
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant1.id, userId: managerUser.id } },
    update: {},
    create: {
      tenantId: tenant1.id,
      userId: managerUser.id,
      role: UserRole.MANAGER,
    },
  });

  await prisma.tenantUser.upsert({
    where: { tenantId_userId: { tenantId: tenant1.id, userId: viewerUser.id } },
    update: {},
    create: {
      tenantId: tenant1.id,
      userId: viewerUser.id,
      role: UserRole.VIEWER,
    },
  });

  console.log('✅ Tenant-User relationships created');

  // Create Chart of Accounts for Tenant 1
  const accounts = [
    { code: '1000', name: 'Cash', type: AccountType.ASSET },
    { code: '1100', name: 'Accounts Receivable', type: AccountType.ASSET },
    { code: '1500', name: 'Inventory', type: AccountType.ASSET },
    { code: '2000', name: 'Accounts Payable', type: AccountType.LIABILITY },
    { code: '3000', name: 'Retained Earnings', type: AccountType.EQUITY },
    { code: '4000', name: 'Sales Revenue', type: AccountType.REVENUE },
    { code: '5000', name: 'Cost of Goods Sold', type: AccountType.EXPENSE },
    { code: '6000', name: 'Operating Expenses', type: AccountType.EXPENSE },
  ];

  for (const acc of accounts) {
    await prisma.account.upsert({
      where: { tenantId_code: { tenantId: tenant1.id, code: acc.code } },
      update: {},
      create: {
        tenantId: tenant1.id,
        ...acc,
        currency: 'USD',
        isActive: true,
      },
    });
  }

  console.log('✅ Chart of Accounts created');

  // Create Departments
  const itDept = await prisma.department.create({
    data: {
      tenantId: tenant1.id,
      code: 'IT',
      name: 'Information Technology',
      isActive: true,
    },
  });

  const salesDept = await prisma.department.create({
    data: {
      tenantId: tenant1.id,
      code: 'SALES',
      name: 'Sales',
      isActive: true,
    },
  });

  console.log('✅ Departments created');

  // Create Employees
  for (let i = 1; i <= 20; i++) {
    await prisma.employee.create({
      data: {
        tenantId: tenant1.id,
        employeeNumber: `EMP${i.toString().padStart(4, '0')}`,
        firstName: `Employee${i}`,
        lastName: `Lastname${i}`,
        email: `employee${i}@acme.example.com`,
        phone: `+1-555-${i.toString().padStart(4, '0')}`,
        hireDate: new Date('2024-01-01'),
        departmentId: i % 2 === 0 ? itDept.id : salesDept.id,
        jobTitle: i % 2 === 0 ? 'Software Engineer' : 'Sales Representative',
        status: EmploymentStatus.ACTIVE,
        salary: 50000 + (i * 1000),
        currency: 'USD',
      },
    });
  }

  console.log('✅ 20 Employees created');

  // Create Vendors
  const vendors = [
    { name: 'Office Supplies Co', email: 'orders@officesupplies.com' },
    { name: 'Tech Hardware Inc', email: 'sales@techhardware.com' },
    { name: 'Furniture World', email: 'info@furnitureworld.com' },
  ];

  for (let i = 0; i < vendors.length; i++) {
    await prisma.vendor.create({
      data: {
        tenantId: tenant1.id,
        vendorNumber: `VEN${(i + 1).toString().padStart(4, '0')}`,
        ...vendors[i],
        isActive: true,
      },
    });
  }

  console.log('✅ Vendors created');

  // Create Warehouses
  await prisma.warehouse.create({
    data: {
      tenantId: tenant1.id,
      code: 'WH01',
      name: 'Main Warehouse',
      isActive: true,
    },
  });

  console.log('✅ Warehouse created');

  // Create Inventory Items
  for (let i = 1; i <= 10; i++) {
    await prisma.inventoryItem.create({
      data: {
        tenantId: tenant1.id,
        sku: `SKU${i.toString().padStart(6, '0')}`,
        name: `Product ${i}`,
        description: `Description for Product ${i}`,
        category: i % 2 === 0 ? 'Electronics' : 'Office Supplies',
        unit: 'PCS',
        costPrice: 10 + (i * 5),
        sellingPrice: 20 + (i * 10),
        reorderPoint: 10,
        reorderQuantity: 50,
        currentStock: 100,
        availableStock: 100,
        isActive: true,
      },
    });
  }

  console.log('✅ 10 Inventory Items created');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 1.3 Enhanced Health Endpoints

**File: `apps/api/src/modules/health/health.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe - checks if service is running' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  getLive() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe - checks if service is ready to accept traffic' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  getReady() {
    return this.health.check([
      () => this.db.pingCheck('database', this.prisma),
    ]);
  }

  @Get('db')
  @Public()
  @ApiOperation({ summary: 'Database health check' })
  @ApiResponse({ status: 200, description: 'Database is healthy' })
  async getDatabase() {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
```

**File: `apps/api/src/modules/database/prisma.service.ts`** (if missing)

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'error', 'warn'] 
        : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 1.4 OpenAPI/Swagger Setup

**File: `apps/api/src/main.ts`** - Add Swagger configuration:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Global filters & interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API Versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // OpenAPI/Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Amdox ERP API')
    .setDescription('AI-Powered Cloud ERP Suite - REST API Documentation')
    .setVersion('1.0.0')
    .setContact('Amdox Technologies', 'https://amdox.tech', 'api@amdox.tech')
    .setLicense('PROPRIETARY', 'https://amdox.tech/license')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer('http://localhost:3001', 'Development')
    .addServer('https://api.amdox.tech', 'Production')
    .addTag('Auth', 'Authentication & Authorization')
    .addTag('Health', 'Health Check Endpoints')
    .addTag('Finance', 'Financial Management (GL, AP, AR)')
    .addTag('HR', 'Human Resources & Payroll')
    .addTag('Supply Chain', 'Purchase Orders & Inventory')
    .addTag('Projects', 'Project Management')
    .addTag('BI', 'Business Intelligence & Dashboards')
    .addTag('Notifications', 'Notification Engine')
    .addTag('Audit', 'Audit Logs & Compliance')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Amdox ERP API Documentation',
    customfavIcon: 'https://amdox.tech/favicon.ico',
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 API Server running on http://localhost:${port}`);
  console.log(`📚 API Documentation available at http://localhost:${port}/api-docs`);
  console.log(`🔍 Health check: http://localhost:${port}/health/live`);
}

bootstrap();
```

### 1.5 Complete .env.example Files

**File: `apps/api/.env.example`**

```env
# Application
NODE_ENV=development
PORT=3001
API_URL=http://localhost:3001

# Database
DATABASE_URL=postgresql://amdox:password@localhost:5432/amdox_erp?schema=public

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redispassword

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_REFRESH_EXPIRATION=7d

# Keycloak
KEYCLOAK_URL=http://localhost:8080
KEYCLOAK_REALM=amdox-erp
KEYCLOAK_CLIENT_ID=amdox-api
KEYCLOAK_CLIENT_SECRET=your-keycloak-client-secret

# AWS (for production)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_S3_BUCKET=amdox-erp-uploads

# Email
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=noreply@amdox.tech

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200

# ML Service
ML_SERVICE_URL=http://localhost:8000

# Observability
JAEGER_ENDPOINT=http://localhost:14268/api/traces
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100
```

**File: `apps/web/.env.example`**

```env
# Application
NEXT_PUBLIC_APP_NAME=Amdox ERP
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Keycloak
NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080
NEXT_PUBLIC_KEYCLOAK_REALM=amdox-erp
NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=amdox-web

# Feature Flags
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_DARK_MODE=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true

# Analytics (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

**File: `apps/ml-service/.env.example`**

```env
# Application
APP_NAME=Amdox ML Service
HOST=0.0.0.0
PORT=8000

# Database (for model versioning)
DATABASE_URL=postgresql://amdox:password@localhost:5432/amdox_erp

# MLflow
MLFLOW_TRACKING_URI=http://localhost:5000

# Model Configuration
PROPHET_SEASONALITY_MODE=multiplicative
LSTM_EPOCHS=100
LSTM_BATCH_SIZE=32

# Redis (for caching predictions)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redispassword
```

---

## 🟡 PHASE 2: CORE FEATURES (Priority 2)

### 2.1 JWT RS256 Implementation

**Generate RSA key pair:**

```bash
# Generate private key
openssl genrsa -out private.pem 2048

# Generate public key
openssl rsa -in private.pem -outform PEM -pubout -out public.pem

# Convert to base64 for .env (one line)
cat private.pem | base64 -w 0
cat public.pem | base64 -w 0
```

Update JWT strategy to use RS256.

### 2.2 3-Way Matching Implementation

**File: `apps/api/src/modules/finance/matching/matching.service.ts`**

Implement PO ↔ GR ↔ Invoice matching logic with tolerances.

### 2.3 Payslip PDF Generation

**Dependencies:**
```bash
npm install pdfkit @types/pdfkit
```

Implement payslip generation service.

### 2.4 Invoice OCR

**Option 1: AWS Textract**
**Option 2: Tesseract.js (local)**

Implement OCR extraction endpoint.

---

## 🟢 PHASE 3: TESTING & QUALITY (Priority 3)

### 3.1 Integration Tests

**File: `apps/api/test/integration/finance.e2e-spec.ts`**

Test GL, AP, AR flows end-to-end.

### 3.2 Security Hardening

- Helmet.js (already in main.ts)
- CSRF protection
- Rate limiting with `@nestjs/throttler`
- Input sanitization

### 3.3 k6 Load Testing

Execute load tests and document results.

---

## 🚀 PHASE 4: DEPLOYMENT (Priority 4)

### 4.1 Production Docker Compose

**File: `docker-compose.prod.yml`**

### 4.2 Helm Chart Completion

Complete all Kubernetes templates.

### 4.3 Cloud Deployment

Deploy to Railway/Fly.io with live URL.

---

## 📄 PHASE 5: DOCUMENTATION (Priority 5)

### 5.1 Complete README

Add architecture diagrams, screenshots, setup instructions.

### 5.2 Demo Video

Record 5-7 minute walkthrough.

### 5.3 Project Report PDF

Complete all sections.

---

## 📊 SCORING PROJECTION

After completing all phases:
- Innovation: 14/15 (Prophet + LSTM + comprehensive features)
- Technical Depth: 24/25 (full-stack, microservices, security, testing)
- Functionality: 19/20 (all core modules working)
- Documentation: 19/20 (complete docs, video, diagrams)
- Deployment: 9/10 (live URL, monitoring, CI/CD)
- Polish: 10/10 (responsive, accessible, performant)

**TARGET: 95/100** ✅
