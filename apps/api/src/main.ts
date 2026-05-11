import './instrumentation'; // OpenTelemetry must be first
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 3001);
  const corsOrigins = configService
    .get<string>('CORS_ORIGINS', 'http://localhost:3000')
    .split(',');

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      permittedCrossDomainPolicies: false,
      xFrameOptions: { action: 'deny' },
    }),
  );

  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Request-ID'],
  });

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  app.setGlobalPrefix('api');

  // Global pipes, filters, interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  // Swagger / OpenAPI 3.1
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Amdox ERP API')
    .setDescription(
      'AI-Powered Cloud ERP Suite — Multi-tenant REST API. Project Code: AMX-ERP-2026-04',
    )
    .setVersion('1.0.0')
    .setContact('Amdox Technologies', 'https://amdox.dev', 'api@amdox.dev')
    .setLicense('Proprietary', 'https://amdox.dev/license')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Tenant-ID' }, 'TenantID')
    .addServer('http://localhost:3001', 'Local Development')
    .addServer('https://api.staging.amdox.dev', 'Staging')
    .addServer('https://api.amdox.dev', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
    },
    customSiteTitle: 'Amdox ERP API Documentation',
  });

  // Bull Board UI
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');
  const queues = [
    'payroll',
    'notifications',
    'reorder',
    'fx-rates',
    'reports',
    'ml-training',
    'email',
    'webhook',
  ].map(
    (name) =>
      new BullMQAdapter(
        new Queue(name, {
          connection: {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD'),
          },
        }),
      ),
  );
  createBullBoard({ queues, serverAdapter });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(
    '/admin/queues',
    (req: any, _res: any, next: any) => {
      // Basic auth for Bull Board
      const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
      const [user, pass] = Buffer.from(b64auth, 'base64').toString().split(':');
      const adminUser = configService.get('BULL_BOARD_USERNAME', 'admin');
      const adminPass = configService.get('BULL_BOARD_PASSWORD', 'admin@123');
      if (user === adminUser && pass === adminPass) return next();
      _res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
      _res.status(401).send('Authentication required');
    },
    serverAdapter.getRouter(),
  );

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Amdox ERP API running on port ${port}`);
  console.log(`📚 Swagger UI: http://localhost:${port}/api-docs`);
  console.log(`🐂 Bull Board: http://localhost:${port}/admin/queues`);
}

bootstrap();
