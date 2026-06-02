import { NestFactory } from '@nestjs/core';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
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

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
  });

  // 정적 파일 서빙 — 랜딩 페이지의 스크린샷 등 운영자가 public/에 두는
  // 자산. cwd → ./public, 컨테이너에선 dist 옆이라 ../public 까지 시도.
  // dotfiles: 'allow' — /.well-known/assetlinks.json(Android App Links 검증)
  // 같이 dot-prefixed 경로를 정상 응답해야 함. 기본값 'ignore'는 404.
  for (const candidate of [
    join(process.cwd(), 'public'),
    join(process.cwd(), '..', 'public'),
  ]) {
    if (existsSync(candidate)) {
      app.useStaticAssets(candidate, { prefix: '/', dotfiles: 'allow' });
      break;
    }
  }

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
