import { Controller, Get, Header } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator.js';

/**
 * Universal Links (iOS) + App Links (Android) 검증용 well-known endpoint.
 *
 * - Apple: `/.well-known/apple-app-site-association` — JSON, Content-Type
 *   는 `application/json` 이어야 함. Apple CDN(swcd)이 주기적으로 fetch.
 * - Android: `/.well-known/assetlinks.json` — `autoVerify=true` 단계에서
 *   Google Play Protect가 fetch해 cert fingerprint 검증.
 *
 * 파일을 정적으로 두지 않고 controller로 둔 이유: Bundle ID / Team ID /
 * SHA256 를 한 곳에서 관리하고, 추후 환경별(staging) 분기도 쉽게.
 */
@Controller('.well-known')
export class WellKnownController {
  /**
   * iOS Associated Domains 검증 파일.
   *
   * appID 포맷: <TeamID>.<BundleID>
   * paths '*' = 모든 경로를 앱이 처리 (앱 미설치면 Safari로 fallback).
   * 추후 경로별 분기가 필요하면 ['/share/*', '/word/*'] 등으로 좁힘.
   */
  @Public()
  @Get('apple-app-site-association')
  @Header('Content-Type', 'application/json')
  appleAppSiteAssociation() {
    return {
      applinks: {
        apps: [],
        details: [
          {
            appID: 'HW9XJ9J5M2.com.jiny.lingoloop',
            paths: ['*'],
          },
        ],
      },
    };
  }

  /**
   * Android App Links 검증 파일.
   *
   * sha256_cert_fingerprints 는 release APK/AAB를 서명한 키의 fingerprint.
   * 두 개를 함께 넣어둠:
   *   1. upload-keystore (개발자가 직접 서명, 현재 release 빌드용)
   *   2. (장차) Google Play App Signing이 발급한 키 — Play Console →
   *      Setup → App Integrity → App signing key 에서 SHA-256 복사 후
   *      여기에 추가. 그 전엔 1번만 있어도 직접 sideload 한 APK는 검증
   *      통과, Play Store 설치본은 verify 실패 → fallback 브라우저.
   */
  @Public()
  @Get('assetlinks.json')
  @Header('Content-Type', 'application/json')
  androidAssetLinks() {
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.jiny.lingoloop',
          sha256_cert_fingerprints: [
            // upload-keystore (lingoloop alias)
            'A1:A7:8C:A0:D3:04:BA:0F:1C:F5:87:93:73:15:34:EC:DB:6D:72:7F:84:7B:BA:79:A6:AB:B0:F8:68:01:91:3E',
            // Play App Signing key
            '90:5B:43:31:D6:BD:B4:CB:B4:86:BA:91:76:7C:D4:30:ED:0E:3D:20:FB:13:B0:3B:4E:F9:8A:6C:A9:B2:1D:25',
          ],
        },
      },
    ];
  }
}
