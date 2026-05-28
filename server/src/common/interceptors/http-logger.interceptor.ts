import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';

/**
 * Per-request access log: method, path, status, duration, user-agent의
 * 간단 요약. TypeORM 쿼리 로깅을 끈 대신 실제 API 호출 흐름이 보이게
 * 하는 게 목적.
 *
 * 헬스체크/백스테이지 정적 페이지 노이즈는 제외.
 */
@Injectable()
export class HttpLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // 헬스체크처럼 시끄러운 path는 skip. backstage HTML 페이지도
    // (브라우저가 자산 줄줄이 요청) 노이즈라 제외.
    const url = req.originalUrl || req.url || '';
    if (
      url === '/health' ||
      url === '/healthz' ||
      url.startsWith('/backstage/assets')
    ) {
      return next.handle();
    }

    const start = Date.now();
    const method = req.method;
    const userId = (req as any).user?.id ?? (req as any).user?.userId;

    return next.handle().pipe(
      tap({
        next: () => this.log(method, url, res.statusCode, start, userId),
        error: (err) => {
          const status = err?.status ?? err?.statusCode ?? 500;
          this.log(method, url, status, start, userId, err?.message);
        },
      }),
    );
  }

  private log(
    method: string,
    url: string,
    status: number,
    start: number,
    userId?: string,
    errMsg?: string,
  ) {
    const ms = Date.now() - start;
    const who = userId ? ` user=${userId.slice(0, 8)}` : '';
    const tail = errMsg ? ` :: ${errMsg}` : '';
    const line = `${method} ${url} ${status} ${ms}ms${who}${tail}`;
    if (status >= 500) this.logger.error(line);
    else if (status >= 400) this.logger.warn(line);
    else this.logger.log(line);
  }
}
