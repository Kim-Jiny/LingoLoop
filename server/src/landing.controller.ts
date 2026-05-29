import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from './common/decorators/public.decorator.js';

/**
 * lingo.jiny.shop 메인 랜딩 페이지.
 *
 * 단일 HTML로 인라인 — 외부 빌드 도구 없음. 스크린샷은 정적 파일로
 * `server/public/screenshots/`에 두면 `/screenshots/...`로 직접 서빙됨
 * (main.ts에서 useStaticAssets 등록).
 *
 * 운영자 작업: screenshot 1~4번을 `public/screenshots/` 폴더에 PNG로
 * 두면 자동으로 슬라이드에 표시. 파일이 없으면 placeholder.
 */
@Controller()
export class LandingController {
  @Public()
  @Get()
  index(@Res() res: Response) {
    res.type('html').send(LANDING_HTML);
  }
}

const APP_STORE_URL =
  'https://apps.apple.com/kr/app/%EB%A7%81%EA%B3%A0%EB%A3%A8%ED%94%84/id6770874750';

const LANDING_HTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>LingoLoop · 하루 한 문장으로 익히는 영어</title>
  <meta name="description" content="하루 한 문장이면 1년에 350문장과 1,000개 단어가 자연스럽게. 알림과 망각곡선으로 잊지 않게, 단어장으로 오래 기억하는 LingoLoop." />
  <meta property="og:title" content="LingoLoop · 하루 한 문장 영어" />
  <meta property="og:description" content="하루 한 문장이면 1년에 350문장과 1,000개 단어가 자연스럽게." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://lingo.jiny.shop" />
  <meta name="theme-color" content="#fbf5ec" />
  <style>
    :root {
      --bg: #fbf5ec;
      --bg-2: #f3e8dc;
      --ink: #2d2218;
      --ink-2: #77685b;
      --brand: #f26b3a;
      --brand-2: #ffa86e;
      --line: #eadccd;
      --card: #ffffff;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
        "IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif;
      background: linear-gradient(180deg, #fff6ea 0%, var(--bg) 30%, var(--bg-2) 100%);
      color: var(--ink);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
    }
    a { color: var(--brand); text-decoration: none; font-weight: 700; }
    a:hover { text-decoration: underline; }

    .wrap { width: min(1080px, calc(100% - 32px)); margin: 0 auto; }

    header.top {
      padding: 20px 0;
      display: flex; align-items: center; gap: 12px;
    }
    .logo {
      font-size: 20px; font-weight: 900; letter-spacing: 1.5px;
      color: var(--ink);
      display: flex; align-items: center; gap: 8px;
    }
    .logo-dot {
      width: 24px; height: 24px; border-radius: 8px;
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
    }
    nav.top-nav { margin-left: auto; display: flex; gap: 18px; font-size: 14px; }
    nav.top-nav a { color: var(--ink-2); font-weight: 600; }
    nav.top-nav a:hover { color: var(--ink); }

    .hero {
      padding: 60px 0 40px;
      display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 48px;
      align-items: center;
    }
    @media (max-width: 760px) {
      .hero { grid-template-columns: 1fr; padding: 32px 0; gap: 32px; }
    }
    .hero h1 {
      font-size: clamp(34px, 5vw, 52px);
      line-height: 1.18; margin: 0 0 18px;
      letter-spacing: -0.5px;
    }
    .hero h1 em {
      font-style: normal;
      background: linear-gradient(135deg, var(--brand), var(--brand-2));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .hero p.lead {
      font-size: clamp(15px, 1.6vw, 18px);
      color: var(--ink-2); margin: 0 0 28px;
    }
    .stat-row {
      display: flex; gap: 24px; flex-wrap: wrap;
      padding: 16px 0; margin: 0 0 28px;
      border-top: 1px solid var(--line); border-bottom: 1px solid var(--line);
    }
    .stat .num {
      font-size: clamp(22px, 3vw, 32px);
      font-weight: 900; color: var(--brand);
      line-height: 1;
    }
    .stat .lbl { font-size: 12px; color: var(--ink-2); margin-top: 4px; }

    .cta-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .btn {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 14px 22px; border-radius: 14px;
      font-size: 15px; font-weight: 800;
      text-decoration: none;
      transition: transform .15s ease, box-shadow .15s ease;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn.primary {
      background: var(--ink); color: #fff;
      box-shadow: 0 14px 28px -10px rgba(45,34,24,0.45);
    }
    .btn.primary:hover { box-shadow: 0 18px 32px -10px rgba(45,34,24,0.55); }
    .btn.ghost {
      background: rgba(255,255,255,0.7);
      color: var(--ink-2);
      border: 1px solid var(--line);
    }
    .btn small { display: block; font-size: 10px; font-weight: 600; opacity: 0.75; }
    .btn b { font-size: 16px; letter-spacing: 0.3px; }

    /* Phone frame on right side */
    .hero-phone {
      display: flex; justify-content: center; align-items: center;
    }
    .phone {
      width: 100%; max-width: 280px; aspect-ratio: 9 / 19.5;
      background: #1f1611;
      border-radius: 38px; padding: 12px;
      box-shadow: 0 40px 80px -30px rgba(45,34,24,0.55),
                  0 0 0 1px rgba(0,0,0,0.08);
      position: relative;
    }
    .phone::before {
      content: ''; position: absolute; top: 16px; left: 50%;
      transform: translateX(-50%);
      width: 100px; height: 24px; background: #1f1611;
      border-radius: 12px; z-index: 2;
    }
    .phone-screen {
      width: 100%; height: 100%; border-radius: 28px; overflow: hidden;
      background: linear-gradient(180deg, #fff6ea, #fbf5ec);
      display: flex; align-items: center; justify-content: center;
      position: relative;
    }
    .phone-screen img {
      width: 100%; height: 100%; object-fit: cover;
      display: block;
    }
    .phone-screen .placeholder {
      color: var(--ink-2); font-size: 13px; text-align: center;
      padding: 24px; line-height: 1.5;
    }

    section { padding: 60px 0; }
    section h2 {
      font-size: clamp(26px, 3vw, 36px); margin: 0 0 12px;
      letter-spacing: -0.3px;
    }
    section h2 + p.section-lead {
      color: var(--ink-2); font-size: 16px;
      max-width: 720px; margin: 0 0 36px;
    }

    /* Features */
    .features {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
    }
    @media (max-width: 760px) { .features { grid-template-columns: 1fr; } }
    .feature {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 22px; padding: 24px;
    }
    .feature .icon {
      width: 48px; height: 48px; border-radius: 14px;
      background: linear-gradient(135deg, #fff1e0, #ffd9b9);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; margin-bottom: 14px;
    }
    .feature h3 { margin: 0 0 6px; font-size: 17px; }
    .feature p { margin: 0; font-size: 14px; color: var(--ink-2); }

    /* Screenshots */
    .shots {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
    }
    @media (max-width: 760px) { .shots { grid-template-columns: repeat(2, 1fr); } }
    .shot {
      aspect-ratio: 9 / 19.5;
      border-radius: 24px; overflow: hidden;
      background: #fff;
      border: 1px solid var(--line);
      box-shadow: 0 20px 40px -20px rgba(45,34,24,0.18);
      position: relative;
    }
    .shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .shot .placeholder {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 8px;
      color: #ad9a82; font-size: 11px; text-align: center; padding: 16px;
      background: repeating-linear-gradient(45deg, #fbf5ec, #fbf5ec 10px, #f3e8dc 10px, #f3e8dc 20px);
    }

    /* CTA bottom */
    .cta-block {
      background: linear-gradient(135deg, #2d2218 0%, #3a2a1c 100%);
      color: #fff;
      border-radius: 32px;
      padding: 56px 40px;
      text-align: center;
      margin: 60px 0 80px;
    }
    @media (max-width: 760px) {
      .cta-block { padding: 36px 24px; border-radius: 24px; }
    }
    .cta-block h2 { color: #fff; margin: 0 0 14px; }
    .cta-block p { color: rgba(255,255,255,0.7); margin: 0 0 28px; }
    .cta-block .btn.primary {
      background: var(--brand); color: #fff;
    }
    .cta-block .btn.ghost {
      background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7);
      border-color: rgba(255,255,255,0.18);
    }

    footer {
      padding: 30px 0 50px;
      color: var(--ink-2); font-size: 13px;
      border-top: 1px solid var(--line);
    }
    footer .links { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 8px; }
    footer .links a { color: var(--ink-2); font-weight: 600; }
  </style>
</head>
<body>
  <header class="top wrap">
    <div class="logo">
      <span class="logo-dot"></span>
      <span>LingoLoop</span>
    </div>
    <nav class="top-nav">
      <a href="#features">기능</a>
      <a href="#shots">화면</a>
      <a href="/privacy">개인정보</a>
      <a href="/terms">약관</a>
    </nav>
  </header>

  <section class="hero wrap" style="padding-top: 20px">
    <div>
      <h1>하루 한 문장,<br/><em>1년이면 영어 한 권.</em></h1>
      <p class="lead">매일 딱 한 문장이면 1년에 350문장, 핵심 단어 1,000개가 자연스럽게 쌓여요. 외우려 애쓰지 않아도 알림이 살짝 떠올려주고, 단어장이 오래 기억해 주는 학습 루프.</p>

      <div class="stat-row">
        <div class="stat"><div class="num">1문장</div><div class="lbl">하루</div></div>
        <div class="stat"><div class="num">350+</div><div class="lbl">1년 누적 문장</div></div>
        <div class="stat"><div class="num">1,000+</div><div class="lbl">1년 누적 단어</div></div>
      </div>

      <div class="cta-row">
        <a class="btn primary" href="${APP_STORE_URL}" target="_blank" rel="noopener">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 12.04a4.96 4.96 0 0 1 2.36-4.17 5.08 5.08 0 0 0-4-2.16c-1.7-.18-3.32 1-4.18 1-.88 0-2.2-.98-3.62-.95A5.33 5.33 0 0 0 3.13 8.5c-1.93 3.34-.49 8.25 1.38 10.95.93 1.32 2.03 2.8 3.47 2.75 1.4-.06 1.93-.9 3.62-.9 1.68 0 2.16.9 3.62.87 1.5-.02 2.45-1.34 3.37-2.67a11.4 11.4 0 0 0 1.55-3.13 4.79 4.79 0 0 1-2.91-4.33ZM14.32 4.21a4.85 4.85 0 0 0 1.1-3.46 4.94 4.94 0 0 0-3.2 1.66 4.6 4.6 0 0 0-1.13 3.34 4.08 4.08 0 0 0 3.23-1.54Z"/></svg>
          <span><small>App Store에서</small><b>iOS 받기</b></span>
        </a>
        <span class="btn ghost" title="출시 준비 중">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5V3.5c0-.7.7-1.1 1.3-.8l14 8.5c.5.3.5 1 0 1.4l-14 8.7c-.6.4-1.3 0-1.3-.8Z"/></svg>
          <span><small>Google Play</small><b>출시 준비 중</b></span>
        </span>
      </div>
    </div>

    <div class="hero-phone">
      <div class="phone">
        <div class="phone-screen">
          <!-- 운영자: screenshots/hero.png를 두면 자동 표시. 없으면 안내 -->
          <img src="/screenshots/hero.png" alt="LingoLoop 메인 화면" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
          <div class="placeholder" style="display:none;flex-direction:column;gap:8px">
            <strong style="color:#2d2218;font-size:14px">메인 스크린샷</strong>
            <span>server/public/screenshots/hero.png<br/>(예: 1080×2340)</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="wrap" id="features">
    <h2>그냥 어플이 아니라, 학습 루프.</h2>
    <p class="section-lead">처음부터 끝까지 사용자의 시간을 존중하면서 자연스럽게 반복하도록 설계했어요.</p>
    <div class="features">
      <div class="feature">
        <div class="icon">📖</div>
        <h3>하루 한 문장</h3>
        <p>매일 딱 한 문장. 부담 없이 시작하지만, 1년이면 350문장과 핵심 단어 1,000개가 머릿속에 쌓여요.</p>
      </div>
      <div class="feature">
        <div class="icon">🔔</div>
        <h3>알림 루프</h3>
        <p>설정한 주기로 오늘 문장이 다시 도착. 잊을 만하면 살짝 떠오르는 자연스러운 반복.</p>
      </div>
      <div class="feature">
        <div class="icon">🔖</div>
        <h3>단어장 + 활용형 사전</h3>
        <p>문장 옆 책갈피를 누르면 단어장에 저장. 활용형(과거형/복수형 등)과 한영 예문까지 한 화면에서.</p>
      </div>
      <div class="feature">
        <div class="icon">🧠</div>
        <h3>망각곡선 복습</h3>
        <p>잊혀질 만한 시점에 자동으로 복습 큐 등장. 새 학습을 막지 않으면서 기억을 다집니다.</p>
      </div>
      <div class="feature">
        <div class="icon">🧩</div>
        <h3>퀴즈 4종</h3>
        <p>오늘 문장 / 단어 / 문장 입력 / 단어 배열. 음성 입력으로 답할 수도 있어요.</p>
      </div>
      <div class="feature">
        <div class="icon">📱</div>
        <h3>홈 위젯</h3>
        <p>홈 화면 위젯으로 오늘 문장과 단어장이 늘 보여요. 무심코 한 번 더 마주칩니다.</p>
      </div>
    </div>
  </section>

  <section class="wrap" id="shots">
    <h2>실제 화면 미리보기</h2>
    <p class="section-lead">아래 네 칸은 운영자가 스크린샷을 채우면 자동으로 보여요. 위치는 페이지 하단 안내 참고.</p>
    <div class="shots">
      <div class="shot">
        <img src="/screenshots/01.png" alt="오늘 문장" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
        <div class="placeholder" style="display:none">
          <strong>screenshots/01.png</strong>
          <span>오늘 화면 (예: 하루 한 문장)</span>
        </div>
      </div>
      <div class="shot">
        <img src="/screenshots/02.png" alt="단어장" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
        <div class="placeholder" style="display:none">
          <strong>screenshots/02.png</strong>
          <span>단어장 / 활용형 사전</span>
        </div>
      </div>
      <div class="shot">
        <img src="/screenshots/03.png" alt="복습" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
        <div class="placeholder" style="display:none">
          <strong>screenshots/03.png</strong>
          <span>복습 / 퀴즈</span>
        </div>
      </div>
      <div class="shot">
        <img src="/screenshots/04.png" alt="홈 위젯" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
        <div class="placeholder" style="display:none">
          <strong>screenshots/04.png</strong>
          <span>알림 / 학습 통계 등</span>
        </div>
      </div>
    </div>
  </section>

  <section class="wrap">
    <div class="cta-block">
      <h2>오늘부터 한 문장씩.</h2>
      <p>설치는 30초, 학습은 하루 1분.</p>
      <div class="cta-row" style="justify-content:center">
        <a class="btn primary" href="${APP_STORE_URL}" target="_blank" rel="noopener">App Store에서 받기</a>
        <span class="btn ghost">Android · 출시 준비 중</span>
      </div>
    </div>
  </section>

  <footer>
    <div class="wrap">
      <div>© LingoLoop · 김미진 · kjinyz@naver.com</div>
      <div class="links">
        <a href="/privacy">개인정보처리방침</a>
        <a href="/terms">이용약관</a>
        <a href="${APP_STORE_URL}" target="_blank" rel="noopener">App Store</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
