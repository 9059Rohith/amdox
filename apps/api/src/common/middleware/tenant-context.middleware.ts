import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request & { tenantId?: string }, _res: Response, next: NextFunction) {
    // Tenant can come from header, JWT (set by auth guard), or subdomain
    const tenantId =
      req.headers['x-tenant-id'] as string ||
      (req as any).user?.tenantId;

    if (!tenantId && !this.isPublicRoute(req.path)) {
      throw new BadRequestException('X-Tenant-ID header is required');
    }

    req.tenantId = tenantId;
    next();
  }

  private isPublicRoute(path: string): boolean {
    const publicRoutes = [
      '/api/v1/health',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/callback',
      '/api-docs',
      '/admin/queues',
    ];
    return publicRoutes.some((route) => path.startsWith(route));
  }
}
