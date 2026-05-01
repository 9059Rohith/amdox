import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const requestId = req.headers['x-request-id'] || uuidv4();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);

    const { method, url, ip } = req;
    const tenantId = req.headers['x-tenant-id'] || 'unknown';
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const statusCode = res.statusCode;
          this.logger.log(
            `${method} ${url} ${statusCode} ${ms}ms | tenant=${tenantId} ip=${ip} reqId=${requestId}`,
          );
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.error(
            `${method} ${url} ERROR ${ms}ms | tenant=${tenantId} ip=${ip} reqId=${requestId} | ${err.message}`,
          );
        },
      }),
    );
  }
}
