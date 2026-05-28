import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get('DB_USERNAME', 'lingoloop'),
  password: configService.get('DB_PASSWORD', 'lingoloop_dev_password'),
  database: configService.get('DB_DATABASE', 'lingoloop'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: configService.get('NODE_ENV') === 'development',
  // dev에서도 query/parameters 로깅은 끔 — 매분 cron + 매 요청마다
  // SELECT 폭주해서 실제 API 로그가 묻혔음. error/warn/schema/migration
  // 만 남겨 진짜 문제만 표면화. 필요하면 TYPEORM_LOGGING=all 로 override.
  logging:
    configService.get('TYPEORM_LOGGING') === 'all'
      ? 'all'
      : ['error', 'warn', 'schema', 'migration'],
});
