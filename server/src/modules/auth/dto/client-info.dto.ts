import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 클라이언트가 인증 흐름(로그인/리프레시/소셜/회원가입)에서 함께 보내는
 * 환경 정보. backstage 유저 상세 페이지에서 "최근 접속 시점"과 함께
 * OS/앱 버전/디바이스 모델을 노출하는 데 사용됨.
 *
 * 모든 필드 optional — 구버전 클라이언트와 호환되어야 하기 때문에
 * 값이 없어도 인증 자체는 정상 진행. MaxLength는 악의적 페이로드 방지.
 */
export class ClientInfoDto {
  @IsOptional()
  @IsString()
  @IsIn(['ios', 'android', 'web', 'macos', 'windows', 'linux', 'unknown'])
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  osVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  appBuild?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceModel?: string;
}
