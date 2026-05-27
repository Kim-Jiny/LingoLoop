import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Non-HTTP exceptions (DB down, unhandled throw 등)을 production
    // 콘솔에 stacktrace로 남겨 ops가 즉시 추적 가능하게. HTTP 4xx는
    // 기대된 흐름이라 로깅 제외. raw exception은 클라엔 안 노출
    // ('Internal server error'로 마스킹) — 노출 위험 없음.
    if (status >= 500) {
      const err = exception as any;
      this.logger.error(
        `${request?.method ?? '?'} ${request?.url ?? '?'} → ${status} ${err?.message ?? exception}`,
        err?.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      message: typeof message === 'string' ? message : (message as any).message,
      timestamp: new Date().toISOString(),
    });
  }
}
