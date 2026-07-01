# 모바일콘텐츠 제공사업자 고지 조치 (한국가상융합디지털산업협회)

협회 모니터링 지적사항 개선 기록.

- **조치 기한: 2026-07-29(수) 18시까지**
- 지적 항목: ① 개발자 전화번호 미고지 ② 부가세 포함 여부 미고지 ③ 청약철회 미지원/방법 미고지

---

## ✅ 앱/약관에 반영 완료 (코드)

### ① 개발자 전화번호 고지

- `AppConstants`에 사업자 정보 상수 추가 (전화 `010-4676-2773` 포함)
- **앱 내 "사업자 정보" 화면 신설** (`/business-info`, 설정 → 사업자 정보)
  - 상호/대표자/사업자등록번호/통신판매업신고/주소/전화/이메일 노출
  - 전화·이메일 탭 시 전화걸기/메일, 길게 눌러 복사
- 약관 §14 문의 + §15 사업자 정보에 전화번호 추가

### ② 부가세 포함 여부 고지

- 구독 화면 구매 안내 카드에 "표시 가격은 부가가치세(VAT) 포함" 문구
- 사업자 정보 화면 하단 안내에도 명시
- 약관 §3에 "대한민국 App Store/Google Play 표시 가격은 부가가치세(VAT) 포함" 추가

### ③ 청약철회 7일 이내 지원 + 방법 고지

- 구독 안내 화면(`/subscription/help`)에 "청약철회 (구매 후 7일 이내)" 섹션 + 청약철회 문의하기 버튼
- 구독 화면 구매 안내 카드에 청약철회 요약 문구
- 약관 §6을 "청약철회 및 환불"로 개편 — 7일 이내 청약철회, 사용 시 제한, 신청 방법 명시

> 값(상호/연락처 등)은 `app/lib/core/constants/app_constants.dart`와
> `docs/terms-of-use-ko.md` 두 곳에서 관리. 변경 시 함께 수정.

---

## ✅ 직접 하셔야 하는 부분

### 1. 약관 페이지 재배포 (필수)

`docs/terms-of-use-ko.md`를 수정했으나, **호스팅 페이지(https://lingo.jiny.shop/terms)는 별도 배포가 필요**합니다.

- [ ] 해당 페이지를 수정된 `docs/terms-of-use-ko.md` 내용으로 재배포
- [ ] 배포 후 https://lingo.jiny.shop/terms 에서 부가세·청약철회·전화번호 반영 확인

### 2. 앱 마켓 리스팅에 전화번호 고지 (권장)

협회는 "앱 마켓 내 앱 소개/지원"에 개발사 전화번호 고지를 권고합니다. 앱 내 고지로도 대응되지만, 마켓에도 넣으면 가장 안전합니다.

- [ ] **App Store Connect**: 앱 정보 → 지원 URL / 고객 지원 연락처에 전화번호·이메일 반영
- [ ] **Google Play Console**: 스토어 등록정보 → 연락처 세부정보(전화번호/이메일) 입력

### 3. 새 앱 빌드 배포

- [ ] 위 변경(사업자 정보 화면·부가세·청약철회 문구)이 포함된 새 빌드를 스토어에 제출·배포

### 4. 협회에 조치결과 등록

- [ ] 기한(2026-07-29 18시) 내 [조치결과 등록하기]로 개선 사항 등록
- [ ] 등록 시 근거: 앱 내 사업자 정보 화면 캡처, 구독 안내(청약철회) 캡처, 약관 페이지 URL

---

## 변경 파일 요약

- `app/lib/core/constants/app_constants.dart` — 사업자 정보 상수
- `app/lib/features/settings/presentation/business_info_screen.dart` — 사업자 정보 화면(신규)
- `app/lib/features/settings/presentation/settings_screen.dart` — "사업자 정보" 메뉴
- `app/lib/core/router/app_router.dart` — `/business-info` 라우트
- `app/lib/features/subscription/presentation/subscription_screen.dart` — 부가세·청약철회 안내
- `app/lib/features/subscription/presentation/subscription_help_screen.dart` — 청약철회 섹션
- `docs/terms-of-use-ko.md` — 부가세(§3)·청약철회(§6)·전화번호(§14,§15)
