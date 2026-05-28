import { NestFactory } from '@nestjs/core';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';
import { HttpLoggerInterceptor } from './common/interceptors/http-logger.interceptor.js';

async function bootstrap() {
  // Drop `debug` and `verbose` outside of development so the per-minute
  // push cron, every-push FCM trace, and other hot-path probes don't
  // hammer stdout / docker log driver in production. Override with the
  // LOG_LEVELS env (comma-separated) when you need to re-enable debug
  // ad-hoc without rebuilding.
  const isProd = (process.env.NODE_ENV ?? 'development') !== 'development';
  const defaultLevels: LogLevel[] = isProd
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'debug', 'verbose'];
  const logger =
    (process.env.LOG_LEVELS?.split(',') as LogLevel[]) ?? defaultLevels;

  const app = await NestFactory.create(AppModule, { logger });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new HttpLoggerInterceptor());

  // CORS_ORIGINS 콤마 구분 허용 목록. 미설정 시 production은
  // 자기 자신 도메인만 (lingo.jiny.shop) — 비기재 origin은 차단.
  // 개발 환경은 * 유지 (로컬 IDE / 모바일 IP 동시 테스트 편의).
  const corsEnv = process.env.CORS_ORIGINS?.trim();
  const corsOrigin: string | string[] = corsEnv
    ? corsEnv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : isProd
      ? ['https://lingo.jiny.shop']
      : '*';
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server running on port ${port}`);
}
bootstrap();
