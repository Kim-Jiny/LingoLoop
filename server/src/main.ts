import { NestFactory } from '@nestjs/core';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/http-exception.filter.js';

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

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Server running on port ${port}`);
}
bootstrap();
