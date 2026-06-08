/**
 * HTML renderers for the /backstage admin pages.
 *
 * Each page returns a complete <html> document so the controller can
 * just `.send(...)` it. Pages share the same `renderLayout` helper which
 * holds the sidebar, topbar, and global styling.
 *
 * Pages are HTML shells; live data is fetched from `/api/admin/*`
 * endpoints by inline JS using the session cookie, so a deep link still
 * loads with the right state. If the session has expired the JS
 * redirects to `/backstage/login`.
 */

export function escapeHtml(s: string | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderLogin(errorMessage: string | null): string {
  const errorBlock = errorMessage
    ? `<div class="err">${escapeHtml(errorMessage)}</div>`
    : '';
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LingoLoop Backstage 로그인</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, system-ui, BlinkMacSystemFont, sans-serif; background:#f7f2ea; color:#23180f; margin:0; padding:16px; min-height:100vh; display:flex; align-items:center; justify-content:center; -webkit-text-size-adjust:100%; }
    .card { background:#fff; padding:32px; border-radius:24px; box-shadow:0 12px 40px rgba(0,0,0,0.08); width:100%; max-width:360px; }
    .brand { background:linear-gradient(135deg,#f26b3a,#ffb88a); color:#fff; border-radius:18px; padding:18px 20px; margin-bottom:22px; }
    .brand h1 { margin:0; font-size:18px; }
    .brand small { opacity:.86; display:block; margin-top:4px; }
    label { display:block; font-weight:700; margin:0 0 6px; font-size:13px; }
    input { width:100%; padding:12px 14px; border-radius:14px; border:1px solid #e7d7c6; margin-bottom:14px; font-size:16px; }
    button { width:100%; background:#f26b3a; color:#fff; border:0; border-radius:14px; padding:13px; font-size:15px; font-weight:700; cursor:pointer; }
    .err { background:#fde6e6; color:#c54c4c; padding:10px 12px; border-radius:12px; font-size:13px; margin-bottom:14px; }
    @media (max-width: 480px) { .card { padding:24px 20px; border-radius:20px; } .brand { padding:14px 16px; margin-bottom:18px; } }
  </style>
</head>
<body>
  <form class="card" method="post" action="/backstage/login">
    <div class="brand"><h1>LingoLoop Backstage</h1><small>관리자만 접근할 수 있어요.</small></div>
    ${errorBlock}
    <label for="username">아이디</label>
    <input id="username" name="username" autocomplete="username" autofocus required />
    <label for="password">비밀번호</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />
    <button type="submit">로그인</button>
  </form>
</body>
</html>`;
}

export type ActiveNav =
  | 'overview'
  | 'stats'
  | 'users'
  | 'pushes'
  | 'content'
  | 'words'
  | 'subscriptions'
  | 'inquiries';

/** Renders the full page with sidebar/topbar around the page-specific content. */
export function renderLayout(opts: {
  adminUsername: string;
  activeNav: ActiveNav;
  title: string;
  content: string;
  scripts?: string;
}): string {
  const navItem = (key: string, label: string, href: string, icon: string) => `
    <a href="${href}" class="nav-item ${opts.activeNav === key ? 'active' : ''}">
      <span class="nav-icon">${icon}</span><span>${label}</span>
    </a>`;

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(opts.title)} · LingoLoop Backstage</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg:#f7f2ea; --card:#ffffff; --text:#23180f; --muted:#6b5b4b;
      --line:#eee2d6; --primary:#f26b3a; --primary-soft:#fff3ec;
      --ok:#2f8f5b; --warn:#d38a18; --fail:#c54c4c;
      --sidebar-bg:#1f150c; --sidebar-text:#f5ece0;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, "Inter", system-ui, BlinkMacSystemFont, sans-serif; background: var(--bg); color: var(--text); margin: 0; -webkit-text-size-adjust:100%; }
    a { color: inherit; text-decoration: none; }

    /* Shell */
    .shell { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }
    .sidebar { background: var(--sidebar-bg); color: var(--sidebar-text); display: flex; flex-direction: column; padding: 22px 18px; gap: 4px; position: sticky; top: 0; height: 100vh; }
    .brand { font-weight: 800; font-size: 15px; letter-spacing: 0.04em; color: #fff; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }
    .brand .dot { width: 10px; height: 10px; background: var(--primary); border-radius: 50%; }
    .brand small { color: rgba(255,255,255,0.55); font-weight: 600; font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; margin-left: 6px; }
    .nav-item { display:flex; align-items:center; gap:12px; padding:11px 14px; border-radius:12px; font-size:14px; font-weight:600; color: rgba(255,255,255,0.78); transition: background .15s, color .15s; }
    .nav-item:hover { background: rgba(255,255,255,0.06); color:#fff; }
    .nav-item.active { background: var(--primary); color:#fff; box-shadow: 0 6px 18px rgba(242,107,58,0.35); }
    .nav-icon { width: 18px; display: inline-flex; align-items: center; justify-content: center; }
    .sidebar-foot { margin-top: auto; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 10px; }
    .sidebar-foot .user { color: rgba(255,255,255,0.6); font-size: 12px; }
    .sidebar-foot .legal-links { display:flex; flex-wrap:wrap; gap:8px 10px; font-size:12px; color: rgba(255,255,255,0.58); }
    .sidebar-foot .legal-links a:hover { color:#fff; }
    .sidebar-foot button { background: transparent; border: 1px solid rgba(255,255,255,0.18); color: #fff; border-radius: 10px; padding: 10px 12px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .sidebar-foot button:hover { background: rgba(255,255,255,0.06); }
    .sidebar-foot form { margin: 0; }

    .main { display: flex; flex-direction: column; min-width: 0; }
    .topbar { display: none; align-items: center; gap: 12px; padding: 14px 16px; background: #fff; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 50; }
    .topbar h1 { margin: 0; font-size: 16px; }
    .menu-btn { width: 40px; height: 40px; border-radius: 12px; border: 1px solid var(--line); background: #fff; cursor: pointer; font-size: 18px; }

    .page { padding: 32px 28px 56px; }
    .page-head { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; margin-bottom: 22px; }
    .page-head h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.01em; }
    .page-head .crumbs { font-size: 13px; color: var(--muted); }
    .page-head .crumbs a:hover { color: var(--primary); }
    .page-head .actions { margin-left: auto; display: flex; gap: 8px; flex-wrap: wrap; }

    /* Card primitives */
    .card { background: var(--card); border-radius: 22px; padding: 22px; box-shadow: 0 8px 30px rgba(0,0,0,0.04); border: 1px solid #f0e6d7; min-width: 0; }
    .card h2 { margin: 0 0 6px; font-size: 17px; font-weight: 700; }
    .card .sub { color: var(--muted); font-size: 13px; margin-bottom: 14px; }
    .card-link { display: block; transition: transform .12s, box-shadow .12s; }
    .card-link:hover { transform: translateY(-2px); box-shadow: 0 14px 38px rgba(0,0,0,0.06); }

    /* Grids */
    .stats { display:grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap:12px; }
    .stat { background: var(--card); border-radius:18px; padding:18px; border:1px solid var(--line); min-width: 0; }
    .stat .k { color: var(--muted); font-size:13px; }
    .stat .v { font-size:28px; font-weight:800; margin-top:6px; word-break: break-all; }
    .row { display:grid; gap:18px; }
    .row.cols-2 { grid-template-columns: 1fr 1fr; }
    .row.cols-3 { grid-template-columns: 1fr 1fr 1fr; }

    /* Chart card */
    .chart-wrap { position: relative; height: 240px; }

    /* Tables */
    .scroll { overflow:auto; -webkit-overflow-scrolling: touch; }
    table { width:100%; min-width: 600px; border-collapse: collapse; font-size:14px; }
    th, td { padding: 11px 10px; text-align:left; border-bottom: 1px solid #f0e4d8; vertical-align: top; }
    th { color: var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:0.04em; font-weight: 700; }
    tr.clickable { cursor: pointer; }
    tr.clickable:hover td { background: var(--primary-soft); }
    .pill { display:inline-flex; align-items:center; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; }
    .pill.ok { color: var(--ok); background:#e8f5ed; }
    .pill.warn { color: var(--warn); background:#fff3da; }
    .pill.muted { color: var(--muted); background:#f4ece1; }
    .pill.fail { color: var(--fail); background:#fde6e6; }
    .pill.primary { color: var(--primary); background: var(--primary-soft); }
    .detail-row td { background:#fffaf4; }
    .detail-box { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; padding:12px 0; }
    .detail-panel { border:1px solid var(--line); border-radius:14px; padding:12px; background:#fff; min-width:0; }
    .detail-panel h3 { margin:0 0 8px; font-size:13px; color:var(--text); }
    .detail-kv { display:grid; grid-template-columns: 86px 1fr; gap:5px 8px; font-size:12px; }
    .detail-kv dt { color:var(--muted); }
    .detail-kv dd { margin:0; min-width:0; word-break:break-word; }

    /* Toolbar */
    .toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
    .toolbar > .left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .toolbar input, .toolbar select { padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); font-size: 13px; background: #fff; max-width: 100%; }
    .btn { display:inline-flex; align-items:center; justify-content:center; background: var(--primary); color: white; border: 0; border-radius: 14px; padding: 10px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
    .btn.secondary { background:#fff; color: var(--text); border:1px solid var(--line); }
    .btn.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
    button.btn:disabled { opacity: 0.55; cursor: default; }

    /* Forms */
    .form-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-field { display:flex; flex-direction:column; gap:6px; min-width:0; }
    .form-field.full { grid-column: 1 / -1; }
    .form-field label, .toggle-field label { color: var(--muted); font-size: 12px; font-weight: 700; }
    .form-field input, .form-field textarea { width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--line); font-size:14px; background:#fff; font-family: inherit; }
    .form-field textarea { resize: vertical; min-height: 76px; }
    .toggle-field { display:flex; align-items:center; gap:10px; padding:10px 0; }
    .toggle-field input { width:18px; height:18px; accent-color: var(--primary); }
    .form-actions { display:flex; align-items:center; gap:10px; margin-top:14px; flex-wrap:wrap; }
    .form-status { color: var(--ok); font-size: 13px; font-weight: 700; display:none; }
    pre.preview { white-space:pre-wrap; font-size:12px; background:#f9f4ee; padding:12px; border-radius:14px; border:1px solid var(--line); margin:0; overflow:auto; }

    /* Pagination */
    .pager { display:flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px; }
    .pager button { padding: 8px 12px; border-radius: 10px; border: 1px solid var(--line); background: #fff; cursor: pointer; font-size: 13px; }
    .pager button:disabled { opacity: 0.4; cursor: default; }
    .pager .info { color: var(--muted); font-size: 13px; }

    /* Empty & spinners */
    .empty { padding: 28px; text-align: center; color: var(--muted); font-size: 14px; }
    .skeleton { background: linear-gradient(90deg,#f0e6d7 0%,#faf2e6 50%,#f0e6d7 100%); background-size: 200% 100%; animation: shimmer 1.2s infinite; border-radius: 10px; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Hero (overview only) */
    .hero { background: linear-gradient(135deg,#f26b3a,#ffb88a); color:#fff; padding:24px 26px; border-radius:24px; margin-bottom:20px; }
    .hero h1 { margin:0 0 6px; font-size:22px; }
    .hero small { opacity:.86; font-size:13px; }

    /* Sidebar drawer for mobile */
    .scrim { display:none; position:fixed; inset:0; background: rgba(0,0,0,0.4); z-index: 90; }

    /* Modal (native <dialog>) */
    dialog { border: 0; padding: 0; background: transparent; max-width: 100%; }
    dialog::backdrop { background: rgba(20,12,4,0.5); backdrop-filter: blur(2px); }
    .modal { background: var(--card); border-radius: 22px; padding: 24px; width: min(560px, 92vw); max-height: 86vh; overflow: auto; border: 1px solid var(--line); }
    .modal h2 { margin: 0 0 12px; font-size: 18px; }
    .modal label { display:block; margin-top:12px; font-weight:700; font-size:13px; color: var(--muted); }
    .modal input, .modal textarea, .modal select { width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--line); font-size:14px; margin-top:6px; background:#fff; }
    .modal textarea { resize: vertical; min-height: 60px; font-family: inherit; }
    .modal .row2 { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
    .modal .actions { display:flex; gap:8px; justify-content:flex-end; margin-top:18px; }
    @media (max-width: 640px) { .modal { padding: 20px; border-radius: 18px; } .modal .row2, .form-grid { grid-template-columns: 1fr; } }

    /* Track grid */
    .track-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
    .track-tile { display:block; background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 22px; transition: transform .12s, box-shadow .12s; }
    .track-tile:hover { transform: translateY(-2px); box-shadow: 0 14px 38px rgba(0,0,0,0.06); }
    .track-tile .name { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
    .track-tile .count { color: var(--primary); font-size: 28px; font-weight: 800; margin-top: 8px; }
    .track-tile .meta { color: var(--muted); font-size: 12px; }

    @media (max-width: 1080px) {
      .row.cols-2, .row.cols-3 { grid-template-columns: 1fr; }
    }
    @media (max-width: 880px) {
      .shell { grid-template-columns: 1fr; }
      .sidebar { position: fixed; top: 0; left: 0; height: 100vh; width: 78%; max-width: 300px; transform: translateX(-100%); transition: transform .22s ease; z-index: 100; box-shadow: 12px 0 32px rgba(0,0,0,0.18); }
      .sidebar.open { transform: translateX(0); }
      .scrim.open { display: block; }
      .topbar { display: flex; }
      .page { padding: 20px 16px 40px; }
      .page-head h1 { font-size: 22px; }
      .hero { padding: 20px; border-radius: 20px; }
      .stats { grid-template-columns: 1fr 1fr; gap: 10px; }
      .stat { padding: 14px; border-radius: 16px; }
      .stat .v { font-size: 22px; }
      .card { padding: 18px; border-radius: 18px; }
      .chart-wrap { height: 220px; }
      .toolbar { gap: 8px; margin-bottom: 12px; }
      .toolbar input, .toolbar select { width: 100%; font-size: 16px; }
    }
    @media (max-width: 380px) { .stats { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><span class="dot"></span>LingoLoop<small>Backstage</small></div>
      ${navItem('overview', '개요', '/backstage', '◎')}
      ${navItem('stats', '통계', '/backstage/stats', '▦')}
      ${navItem('users', '유저', '/backstage/users', '◌')}
      ${navItem('content', '콘텐츠', '/backstage/content', '✎')}
      ${navItem('words', '단어', '/backstage/words', 'A')}
      ${navItem('subscriptions', '구독·매출', '/backstage/subscriptions', '₩')}
      ${navItem('inquiries', '문의', '/backstage/inquiries', '?')}
      ${navItem('pushes', '푸시 히스토리', '/backstage/pushes', '✦')}
      <div class="sidebar-foot">
        <div class="legal-links">
          <a href="/terms" target="_blank" rel="noopener noreferrer">이용약관</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer">개인정보처리방침</a>
        </div>
        <span class="user">로그인: <strong>${escapeHtml(opts.adminUsername)}</strong></span>
        <form method="post" action="/backstage/logout"><button type="submit">로그아웃</button></form>
      </div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <main class="main">
      <div class="topbar">
        <button class="menu-btn" id="menuBtn" aria-label="메뉴">☰</button>
        <h1>${escapeHtml(opts.title)}</h1>
      </div>
      <div class="page">${opts.content}</div>
    </main>
  </div>
  <script>
    (function () {
      const sb = document.getElementById('sidebar');
      const sc = document.getElementById('scrim');
      const btn = document.getElementById('menuBtn');
      function close() { sb.classList.remove('open'); sc.classList.remove('open'); }
      btn && btn.addEventListener('click', () => { sb.classList.toggle('open'); sc.classList.toggle('open'); });
      sc && sc.addEventListener('click', close);
    })();
    // Bounce to login if any /api/admin call returns 401.
    window.adminFetch = async function (url, opts) {
      const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {}));
      if (r.status === 401) { window.location.href = '/backstage/login'; throw new Error('unauthorized'); }
      return r;
    };
    window.pill = function (label, tone) {
      return '<span class="pill ' + (tone || 'muted') + '">' + label + '</span>';
    };
    window.escapeHtml = function (value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    window.pickPalette = function (n) {
      const base = ['#f26b3a','#ffb88a','#6b5b4b','#2f8f5b','#d38a18','#5b8bf2','#a965d6','#c54c4c','#888','#bcae9b'];
      const out = []; for (let i = 0; i < n; i++) out.push(base[i % base.length]); return out;
    };
    window.copyText = function (btn, text) {
      if (!text) return;
      const restore = btn.textContent;
      const done = function () { btn.textContent = '복사됨'; setTimeout(function () { btn.textContent = restore; }, 1200); };
      const fail = function () { btn.textContent = '실패'; setTimeout(function () { btn.textContent = restore; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fail);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { fail(); }
        document.body.removeChild(ta);
      }
    };
  </script>
  ${opts.scripts ?? ''}
</body>
</html>`;
}

export interface PageBody {
  content: string;
  scripts: string;
}

/** Overview page content (no <html> wrapper — meant to go inside renderLayout). */
export function renderOverview(): PageBody {
  const content = `
    <div class="hero">
      <h1>한눈에 보는 LingoLoop</h1>
      <small>요약 카드를 누르면 해당 상세 페이지로 이동합니다.</small>
    </div>
    <div id="stats" class="stats"></div>

    <div class="row cols-2" style="margin-top:18px;">
      <div class="card">
        <div class="toolbar">
          <div class="left"><h2 style="margin:0">운영 핵심 KPI</h2></div>
          <span class="pill primary">server data</span>
        </div>
        <div class="stats" id="operatingKpis"></div>
      </div>
      <a class="card card-link" href="/backstage/subscriptions">
        <div class="toolbar">
          <div class="left"><h2 style="margin:0">구독 퍼널 · 최근 30일</h2></div>
          <span class="pill primary">검증 로그 기준</span>
        </div>
        <div class="sub">신규가입 → 구매 검증 시도 → 검증 성공 → 활성 프리미엄</div>
        <div id="subscriptionFunnel"></div>
      </a>
    </div>

    <div class="row cols-2" style="margin-top:18px;">
      <a class="card card-link" href="/backstage/users">
        <h2>가입자 추이 · 최근 30일</h2>
        <div class="sub">KST 기준 일자별 신규 가입자 · 클릭하면 유저 목록</div>
        <div class="chart-wrap"><canvas id="signupChart"></canvas></div>
      </a>
      <a class="card card-link" href="/backstage/pushes">
        <h2>푸시 발송/탭 추이 · 30일</h2>
        <div class="sub">매일 보낸 푸시와 탭된 푸시 · 클릭하면 푸시 히스토리</div>
        <div class="chart-wrap"><canvas id="pushChart"></canvas></div>
      </a>
    </div>

    <div class="row cols-3" style="margin-top:18px;">
      <a class="card card-link" href="/backstage/pushes">
        <h2>푸시 타입 분포 (30일)</h2>
        <div class="sub">sentence · quiz · widget_refresh</div>
        <div class="chart-wrap"><canvas id="pushTypeChart"></canvas></div>
      </a>
      <a class="card card-link" href="/backstage/users">
        <h2>인증 수단</h2>
        <div class="sub">전체 사용자 가입 경로</div>
        <div class="chart-wrap"><canvas id="providerChart"></canvas></div>
      </a>
      <a class="card card-link" href="/backstage/users">
        <h2>학습 트랙</h2>
        <div class="sub">현재 선택된 트랙별 사용자 수</div>
        <div class="chart-wrap"><canvas id="trackChart"></canvas></div>
      </a>
    </div>

    <div class="row cols-2" style="margin-top:18px;">
      <div class="card">
        <div class="toolbar"><div class="left"><h2 style="margin:0">최근 가입자</h2></div>
          <a class="btn ghost" href="/backstage/users">전체 보기 →</a></div>
        <div class="scroll"><table>
          <thead><tr><th>유저</th><th>플랜</th><th>인증</th><th>활동</th></tr></thead>
          <tbody id="overview-users"></tbody>
        </table></div>
      </div>
      <div class="card">
        <div class="toolbar"><div class="left"><h2 style="margin:0">최근 푸시</h2></div>
          <a class="btn ghost" href="/backstage/pushes">전체 보기 →</a></div>
        <div class="scroll"><table>
          <thead><tr><th>시간</th><th>유저</th><th>타입</th><th>상태</th></tr></thead>
          <tbody id="overview-pushes"></tbody>
        </table></div>
      </div>
    </div>
  `;

  const scripts = `<script>
    (async function () {
      const stats = document.getElementById('stats');
      const r = await window.adminFetch('/api/admin/dashboard');
      const data = await r.json();
      const s = data.summary;
      const o = data.operating;
      const f = data.subscriptionFunnel;

      stats.innerHTML = [
        ['총 유저', s.totalUsers, '/backstage/users'],
        ['오늘 가입', s.signupsToday, '/backstage/users'],
        ['최근 7일 가입', s.signups7d, '/backstage/users'],
        ['최근 30일 가입', s.signups30d, '/backstage/users'],
        ['프리미엄', s.premiumUsers, '/backstage/users?plan=premium'],
        ['활성 디바이스', s.activeDevices, '/backstage/users'],
        ['오늘 할당', s.assignedToday, ''],
        ['오늘 완료', s.completedToday, ''],
        ['7일 푸시', s.pushes7d, '/backstage/pushes'],
        ['7일 푸시 탭률', s.pushTapRate7d + '%', '/backstage/pushes'],
        ['7일 퀴즈 정답률', s.quizAccuracy7d + '%', ''],
        ['총 문장', s.totalSentences, ''],
      ].map(([k, v, href]) => href
        ? '<a class="stat" style="cursor:pointer" href="' + href + '"><div class="k">' + k + '</div><div class="v">' + v + '</div></a>'
        : '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'
      ).join('');

      document.getElementById('operatingKpis').innerHTML = [
        ['DAU', o.activeUsersToday],
        ['WAU', o.activeUsers7d],
        ['MAU', o.activeUsers30d],
        ['오늘 완료율', o.completionRateToday + '%'],
        ['7일 완료율', o.completionRate7d + '%'],
        ['7일 퀴즈 참여율', o.quizParticipationRate7d + '%'],
        ['7일 퀴즈 유저', o.quizUsers7d],
        ['프리미엄 비율', o.premiumRatio + '%'],
      ].map(([k, v]) => '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>').join('');

      const funnelSteps = [
        ['신규가입', f.signups, 100],
        ['구매 검증 시도 유저', f.verifyAttemptUsers, f.signupToVerifyRate],
        ['검증 성공 유저', f.verifyAppliedUsers, f.signupToPremiumRate],
        ['현재 활성 프리미엄', f.activePremium, s.totalUsers ? Math.round((f.activePremium / s.totalUsers) * 100) : 0],
      ];
      document.getElementById('subscriptionFunnel').innerHTML =
        '<div style="display:grid;gap:10px">' + funnelSteps.map(([label, value, rate], index) => (
          '<div>' +
            '<div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#6b5b4b;margin-bottom:5px">' +
              '<strong style="color:#23180f">' + label + '</strong><span>' + value + ' · ' + rate + '%</span>' +
            '</div>' +
            '<div style="height:10px;background:#f4ece1;border-radius:999px;overflow:hidden">' +
              '<div style="height:100%;width:' + Math.max(2, Math.min(100, rate)) + '%;background:' + ['#f26b3a','#ffb88a','#2f8f5b','#5b8bf2'][index] + ';border-radius:999px"></div>' +
            '</div>' +
          '</div>'
        )).join('') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
          window.pill('검증 시도 ' + f.verifyAttempts + '회', 'muted') +
          window.pill('성공률 ' + f.verifySuccessRate + '%', f.verifySuccessRate >= 80 ? 'ok' : 'warn') +
          window.pill('문제 ' + f.verifyProblem + '회', f.verifyProblem > 0 ? 'warn' : 'ok') +
        '</div>';

      // Build 30-day axis
      const allDays = [];
      const today = new Date();
      for (let i = 29; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); allDays.push(d.toISOString().split('T')[0]); }
      const signMap = new Map(data.trends.signupsByDay.map((r) => [r.day, r.count]));
      const sentMap = new Map(data.trends.pushesByDay.map((r) => [r.day, r.sent]));
      const tapMap = new Map(data.trends.pushesByDay.map((r) => [r.day, r.tapped]));

      function lineChart(id, labels, datasets) {
        new Chart(document.getElementById(id), { type: 'line', data: { labels, datasets },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }, });
      }
      function donut(id, labels, values) {
        new Chart(document.getElementById(id), { type: 'doughnut',
          data: { labels, datasets: [{ data: values, backgroundColor: window.pickPalette(values.length) }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }, });
      }

      lineChart('signupChart', allDays, [{ label: '가입', data: allDays.map((d) => signMap.get(d) || 0),
        borderColor: '#f26b3a', backgroundColor: 'rgba(242,107,58,0.18)', tension: .3, fill: true }]);
      lineChart('pushChart', allDays, [
        { label: '발송', data: allDays.map((d) => sentMap.get(d) || 0), borderColor: '#5b8bf2',
          backgroundColor: 'rgba(91,139,242,0.15)', tension: .3, fill: true },
        { label: '탭', data: allDays.map((d) => tapMap.get(d) || 0), borderColor: '#2f8f5b',
          backgroundColor: 'rgba(47,143,91,0.15)', tension: .3, fill: true },
      ]);
      donut('pushTypeChart', data.breakdowns.pushType.map((r) => r.label), data.breakdowns.pushType.map((r) => r.count));
      donut('providerChart', data.breakdowns.authProvider.map((r) => r.label), data.breakdowns.authProvider.map((r) => r.count));
      donut('trackChart', data.breakdowns.learningTrack.map((r) => r.label), data.breakdowns.learningTrack.map((r) => r.count));

      document.getElementById('overview-users').innerHTML = data.users.slice(0, 10).map((u) => (
        '<tr class="clickable" onclick="location.href=\\'/backstage/users/' + u.id + '\\'">' +
          '<td><strong>' + (u.nickname || '-') + '</strong><br><span style="color:#6b5b4b;font-size:12px">' + u.email + '</span></td>' +
          '<td>' + window.pill(u.subscriptionTier, u.subscriptionTier === 'premium' ? 'ok' : 'muted') + '</td>' +
          '<td>' + window.pill(u.provider || '-', 'muted') + '</td>' +
          '<td><span style="color:#6b5b4b;font-size:12px">가입 ' + u.createdAt + '</span></td>' +
        '</tr>'
      )).join('');
      document.getElementById('overview-pushes').innerHTML = data.recentPushes.slice(0, 10).map((p) => (
        '<tr><td>' + p.sentAt + '</td><td>' + p.userLabel + '</td>' +
        '<td>' + window.pill(p.pushType) + '</td>' +
        '<td>' + window.pill(p.status, p.status === 'sent' ? 'ok' : p.status === 'failed' ? 'fail' : 'muted') + '</td></tr>'
      )).join('');
    })();
  </script>`;

  return { content, scripts };
}

/**
 * 통계 페이지 — 개요(/backstage) 카드들에 안 잡히는 운영 관심사 세 가지:
 *   1) OS별 가입자 — user.lastPlatform 분포. 마케팅 채널/디바이스 친화도 가늠.
 *   2) 트랙별 학습자 — language × track cross. JA 런칭 직후 트랙별
 *      쏠림과 비활성 트랙(jpt 등) 모니터링.
 *   3) 연속학습 TOP 50 — 어제/오늘까지 살아있는 streak. 헤비 유저 식별 +
 *      회고 인터뷰 후보.
 *
 * 단일 API(/api/admin/stats)로 세 데이터 한 번에 받음.
 */
export function renderStats(): PageBody {
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · 통계</div>
        <h1>유의미한 통계</h1>
        <small>OS 분포 · 트랙별 학습자 · 연속학습 상위 — 마지막 갱신 후 즉시 반영</small>
      </div>
      <div class="actions"><button class="btn secondary" id="refresh">새로고침</button></div>
    </div>

    <div class="row cols-2" style="margin-top:18px;">
      <div class="card">
        <h2>OS별 가입자수</h2>
        <div class="sub">user.lastPlatform 기준. unknown = 클라이언트 정보 미전송 사용자</div>
        <div class="chart-wrap"><canvas id="osChart"></canvas></div>
        <div class="scroll" style="margin-top:12px;">
          <table>
            <thead><tr><th>OS</th><th style="text-align:right;">유저 수</th><th style="text-align:right;">비중</th></tr></thead>
            <tbody id="osRows"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <h2>트랙별 학습자수</h2>
        <div class="sub">학습 트랙을 선택한 사용자만 (미선택 제외) · 언어별로 그룹화</div>
        <div class="scroll" style="margin-top:8px;">
          <table>
            <thead><tr><th>언어</th><th>트랙</th><th style="text-align:right;">학습자 수</th></tr></thead>
            <tbody id="trackRows"></tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <div class="toolbar">
        <div class="left"><h2 style="margin:0">연속학습 TOP 50</h2></div>
        <span class="pill primary">streak 진행 중 (어제/오늘까지)</span>
      </div>
      <div class="sub">사용자별 timezone으로 일자 buckets. 끊긴 streak는 제외.</div>
      <div class="scroll">
        <table>
          <thead><tr><th>#</th><th>유저</th><th style="text-align:right;">연속 일수</th><th>마지막 완료일</th></tr></thead>
          <tbody id="streakRows"></tbody>
        </table>
      </div>
    </div>
  `;

  const scripts = `<script>
    (function () {
      const TRACK_LABELS = ${JSON.stringify(TRACK_LABELS)};
      const LANG_LABELS = { en: '🇺🇸 영어', ja: '🇯🇵 일본어' };

      function pickOsColor(p) {
        if (p === 'ios') return '#3478f6';
        if (p === 'android') return '#3ddc84';
        if (p === 'web') return '#f26b3a';
        return '#a3a3a3';
      }

      async function load() {
        const r = await window.adminFetch('/api/admin/stats');
        const data = await r.json();

        // ── OS별 가입자 ──────────────────────────────────────
        const osTotal = data.byOs.reduce((acc, x) => acc + x.count, 0) || 1;
        document.getElementById('osRows').innerHTML = data.byOs.map((x) => (
          '<tr>' +
            '<td>' + window.pill(x.platform, x.platform === 'ios' ? 'ok' : (x.platform === 'android' ? 'primary' : 'muted')) + '</td>' +
            '<td style="text-align:right;font-weight:700">' + x.count.toLocaleString() + '</td>' +
            '<td style="text-align:right;color:#6b5b4b">' + Math.round((x.count / osTotal) * 100) + '%</td>' +
          '</tr>'
        )).join('') || '<tr><td colspan="3" class="empty">데이터 없음</td></tr>';

        const osCtx = document.getElementById('osChart').getContext('2d');
        new Chart(osCtx, {
          type: 'doughnut',
          data: {
            labels: data.byOs.map((x) => x.platform),
            datasets: [{
              data: data.byOs.map((x) => x.count),
              backgroundColor: data.byOs.map((x) => pickOsColor(x.platform)),
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
          },
        });

        // ── 트랙별 학습자 ────────────────────────────────────
        document.getElementById('trackRows').innerHTML = data.byTrack.map((x) => (
          '<tr>' +
            '<td>' + window.escapeHtml(LANG_LABELS[x.languageCode] || x.languageCode) + '</td>' +
            '<td>' + window.escapeHtml(TRACK_LABELS[x.track] || x.track) + '</td>' +
            '<td style="text-align:right;font-weight:700">' + x.count.toLocaleString() + '</td>' +
          '</tr>'
        )).join('') || '<tr><td colspan="3" class="empty">트랙을 선택한 사용자가 없어요.</td></tr>';

        // ── 연속학습 TOP 50 ──────────────────────────────────
        document.getElementById('streakRows').innerHTML = data.topStreaks.map((s, i) => (
          '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td><a href="/backstage/users/' + encodeURIComponent(s.userId) + '"><strong>' + window.escapeHtml(s.nickname || '-') + '</strong></a><br>' +
              '<span style="color:#6b5b4b;font-size:12px">' + window.escapeHtml(s.email) + '</span></td>' +
            '<td style="text-align:right;font-weight:800;font-size:18px;color:#f26b3a">' + s.streak + '일</td>' +
            '<td><span style="color:#6b5b4b;font-size:13px">' + window.escapeHtml(s.lastDate) + '</span></td>' +
          '</tr>'
        )).join('') || '<tr><td colspan="4" class="empty">활성 streak 보유자가 없어요.</td></tr>';
      }

      document.getElementById('refresh').addEventListener('click', load);
      load();
    })();
  </script>`;

  return { content, scripts };
}

export function renderUsersList(): PageBody {
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · 유저</div>
        <h1>유저 관리</h1>
      </div>
      <div class="actions"><button class="btn secondary" id="refresh">새로고침</button></div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="left">
          <input id="q" placeholder="이메일/닉네임 검색" />
          <select id="provider"><option value="">전체 인증</option><option value="email">email</option><option value="google">google</option><option value="apple">apple</option><option value="kakao">kakao</option></select>
          <select id="plan"><option value="">전체 플랜</option><option value="free">free</option><option value="premium">premium</option></select>
          <select id="track"><option value="">전체 트랙</option><option value="unset">unset</option></select>
        </div>
        <div class="info" id="total"></div>
      </div>
      <div class="scroll">
        <table>
          <thead><tr><th>유저</th><th>플랜</th><th>인증</th><th>트랙</th><th>OS</th><th>디바이스</th><th>완료/할당</th><th>퀴즈</th><th>가입</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div class="pager">
        <button id="prev">←</button>
        <span class="info" id="pageInfo"></span>
        <button id="next">→</button>
      </div>
    </div>
  `;
  const scripts = `<script>
    (function () {
      const params = new URLSearchParams(location.search);
      const state = {
        q: params.get('q') || '',
        provider: params.get('provider') || '',
        plan: params.get('plan') || '',
        track: params.get('track') || '',
        page: parseInt(params.get('page') || '1', 10),
        limit: 30,
      };

      const $ = (id) => document.getElementById(id);
      $('q').value = state.q; $('provider').value = state.provider;
      $('plan').value = state.plan; $('track').value = state.track;
      function kv(obj) {
        return '<dl class="detail-kv">' + Object.entries(obj).map(([k, v]) =>
          '<dt>' + window.escapeHtml(k) + '</dt><dd>' + window.escapeHtml(v == null || v === '' ? '-' : v) + '</dd>'
        ).join('') + '</dl>';
      }
      function panel(title, body) {
        return '<div class="detail-panel"><h3>' + title + '</h3>' + body + '</div>';
      }
      function renderUserAnalysis(u) {
        const sub = u.subscription || {};
        const settings = u.settings || {};
        const deviceBody = (u.devices || []).length
          ? u.devices.map((d) => kv({
              id: d.id,
              platform: d.platform,
              active: d.isActive ? 'true' : 'false',
              token: d.token,
              created: d.createdAt,
              updated: d.updatedAt,
            })).join('<hr style="border:0;border-top:1px solid #f0e4d8;margin:10px 0">')
          : '<div class="empty" style="padding:8px">디바이스 없음</div>';
        const pushBody = (u.recentPushes || []).length
          ? '<dl class="detail-kv">' + u.recentPushes.map((p) =>
              '<dt>' + window.escapeHtml(p.sentAt) + '</dt><dd>' +
                window.escapeHtml(p.pushType + ' · ' + p.status + (p.tappedAt ? ' · tapped ' + p.tappedAt : '')) +
              '</dd>'
            ).join('') + '</dl>'
          : '<div class="empty" style="padding:8px">최근 푸시 없음</div>';
        return '<div style="margin-bottom:10px"><a class="btn secondary" href="/backstage/users/' + encodeURIComponent(u.id) + '">상세 페이지 열기</a></div>' +
          '<div class="detail-box">' +
            panel('유저', kv({
              id: u.id,
              email: u.email,
              nickname: u.nickname,
              provider: u.provider,
              active: String(u.isActive),
              timezone: u.timezone,
              language: u.targetLanguage + ' / ' + u.nativeLanguage,
              track: u.learningTrack,
              dailyGoal: u.dailyGoal,
              tier: u.subscriptionTier,
              joined: u.createdAt,
              updated: u.updatedAt,
              deletedAt: u.deletedAt,
            })) +
            panel('구독', u.subscription ? kv({
              store: sub.store,
              product: sub.productId,
              plan: sub.plan,
              active: String(sub.isActive),
              autoRenew: String(sub.autoRenew),
              env: sub.environment,
              trial: String(sub.inTrial),
              expires: sub.expiresAt,
              revoked: sub.revokedAt,
            }) : '<div class="empty" style="padding:8px">구독 정보 없음</div>') +
            panel('알림 설정', u.settings ? kv({
              enabled: String(settings.isEnabled),
              frequency: settings.frequencyMinutes + '분',
              activeTime: settings.activeStartTime + ' ~ ' + settings.activeEndTime,
              timezone: settings.timezone,
              wordRatio: settings.wordPushRatio,
              nextPushAt: settings.nextPushAt,
              updated: settings.updatedAt,
            }) : '<div class="empty" style="padding:8px">알림 설정 없음</div>') +
            panel('학습/퀴즈', kv({
              assignments: u.completedAssignments + ' / ' + u.totalAssignments,
              quizAttempts: u.quizAttempts,
              quizCorrect: u.quizCorrect,
              quizAccuracy: u.quizAccuracy + '%',
            })) +
            panel('디바이스', deviceBody) +
            panel('최근 푸시', pushBody) +
          '</div>';
      }

      async function load() {
        const qs = new URLSearchParams({
          page: String(state.page), limit: String(state.limit),
        });
        if (state.q) qs.set('q', state.q);
        if (state.provider) qs.set('provider', state.provider);
        if (state.plan) qs.set('plan', state.plan);
        if (state.track) qs.set('track', state.track);

        history.replaceState(null, '', '/backstage/users?' + qs.toString());
        const r = await window.adminFetch('/api/admin/users?' + qs.toString());
        const data = await r.json();

        $('total').textContent = '총 ' + data.total + '명';
        $('rows').innerHTML = data.items.map((u, idx) => (
          '<tr class="clickable user-row" data-index="' + idx + '">' +
            '<td><strong>' + (u.nickname || '-') + '</strong><br><span style="color:#6b5b4b;font-size:12px">' + u.email + '</span></td>' +
            '<td>' + window.pill(u.subscriptionTier, u.subscriptionTier === 'premium' ? 'ok' : 'muted') + '<br><span style="color:#6b5b4b;font-size:12px">' + (u.subscriptionStore || '-') + '</span></td>' +
            '<td>' + window.pill(u.provider || '-', 'muted') + '<br><span style="color:#6b5b4b;font-size:12px">' + u.targetLanguage + '/' + u.nativeLanguage + '</span></td>' +
            '<td>' + window.pill(u.learningTrack || 'unset', 'primary') + '</td>' +
            '<td>' + window.pill(u.lastPlatform || 'unknown', u.lastPlatform === 'ios' ? 'ok' : (u.lastPlatform === 'android' ? 'primary' : 'muted')) + '</td>' +
            '<td>' + u.activeDevices + '/' + u.totalDevices + '대<br><span style="color:#6b5b4b;font-size:12px">' + (u.notificationEnabled ? '알림 On' : '알림 Off') + '</span></td>' +
            '<td>' + u.completedAssignments + '/' + u.totalAssignments + '</td>' +
            '<td>' + u.quizAttempts + '회<br><span style="color:#6b5b4b;font-size:12px">' + u.quizAccuracy + '%</span></td>' +
            '<td><span style="color:#6b5b4b;font-size:12px">' + u.createdAt + '</span></td>' +
          '</tr>' +
          '<tr class="detail-row" data-detail="' + idx + '" style="display:none"><td colspan="9">' +
            renderUserAnalysis(u) +
          '</td></tr>'
        )).join('') || '<tr><td colspan="9" class="empty">조건에 맞는 유저가 없어요.</td></tr>';
        document.querySelectorAll('.user-row').forEach((row) => {
          row.addEventListener('click', () => {
            const detail = document.querySelector('[data-detail="' + row.dataset.index + '"]');
            if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
          });
        });

        $('pageInfo').textContent = state.page + ' / ' + data.totalPages;
        $('prev').disabled = state.page <= 1;
        $('next').disabled = state.page >= data.totalPages;
      }

      let t;
      function bounce() { clearTimeout(t); t = setTimeout(() => { state.page = 1; load(); }, 200); }
      $('q').addEventListener('input', (e) => { state.q = e.target.value; bounce(); });
      $('provider').addEventListener('change', (e) => { state.provider = e.target.value; state.page = 1; load(); });
      $('plan').addEventListener('change', (e) => { state.plan = e.target.value; state.page = 1; load(); });
      $('track').addEventListener('change', (e) => { state.track = e.target.value; state.page = 1; load(); });
      $('prev').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
      $('next').addEventListener('click', () => { state.page++; load(); });
      $('refresh').addEventListener('click', load);
      load();
    })();
  </script>`;
  return { content, scripts };
}

export function renderUserDetail(userId: string): PageBody {
  const safeId = escapeHtml(userId);
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · <a href="/backstage/users">유저</a> · 상세</div>
        <h1 id="userTitle">로딩 중…</h1>
      </div>
      <div class="actions"><a class="btn secondary" href="/backstage/users">← 목록</a></div>
    </div>

    <div class="row cols-2">
      <div class="card">
        <h2>프로필</h2>
        <div class="sub" id="userMeta">…</div>
        <table style="min-width: 0;">
          <tbody id="profileTable"></tbody>
        </table>
      </div>
      <div class="card">
        <h2>학습 지표</h2>
        <div class="sub">전체 누적</div>
        <div class="stats" id="userStats"></div>
      </div>
    </div>

    <div class="row cols-2" style="margin-top:18px;">
      <div class="card">
        <h2>구독</h2>
        <div class="sub">스토어/만료일</div>
        <table style="min-width:0"><tbody id="subTable"></tbody></table>
        <hr style="margin:14px 0; border:none; border-top:1px solid #e5dccf" />
        <h3 style="margin:0 0 8px 0; font-size:14px">프리미엄 부여 / 회수</h3>
        <div class="sub" style="margin-bottom:8px">기존 만료일에 일수가 추가됩니다(스택). 회수는 즉시 만료 처리.</div>
        <div class="sub" style="margin-bottom:8px; padding:8px 10px; background:#fff5e6; border-left:3px solid #c98b1f; border-radius:4px; color:#6b5b4b; font-size:12px;">
          ⚠ <strong>회수는 영구 차단이 아닙니다.</strong> Apple/Google에서 구독이 여전히 활성이면 다음 갱신 webhook(DID_RENEW 등)이 도착할 때 자동으로 premium이 복구됩니다.
          영구 차단이 필요하면 사용자에게 스토어에서 직접 구독 취소를 안내해 주세요.
        </div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
          <input id="grantDays" type="number" min="1" max="3650" placeholder="일수 (예: 30)" style="width:120px; padding:6px 8px; border:1px solid #d3c5b1; border-radius:6px" />
          <input id="grantReason" type="text" placeholder="사유 (선택)" style="flex:1; min-width:160px; padding:6px 8px; border:1px solid #d3c5b1; border-radius:6px" />
        </div>
        <div style="display:flex; gap:8px; margin-top:10px">
          <button id="grantBtn" class="btn primary" type="button">프리미엄 부여</button>
          <button id="revokeBtn" class="btn ghost" type="button" style="color:#b04a3a">회수</button>
        </div>
        <div id="grantMsg" style="margin-top:8px; font-size:12px; color:#6b5b4b"></div>
        <hr style="border:0;border-top:1px solid #f0e4d8;margin:16px 0">
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap">
          <strong style="min-width:90px">관리자 권한</strong>
          <span id="adminStatus" class="info" style="flex:1">-</span>
          <button id="adminToggleBtn" class="btn secondary" type="button" disabled>로딩…</button>
        </div>
        <div class="sub" style="margin-top:6px; font-size:11px">
          on이면 신규 문의 / 결제 / 환불 / 구독취소 알림을 이 사용자의 LingoLoop 앱 푸시로 받음.
        </div>
        <div id="adminMsg" style="margin-top:8px; font-size:12px; color:#6b5b4b"></div>
      </div>
      <div class="card">
        <h2>알림 설정</h2>
        <div class="sub">푸시 주기/활성 시간</div>
        <table style="min-width:0"><tbody id="settingsTable"></tbody></table>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h2>디바이스</h2>
      <div class="sub">등록된 푸시 디바이스</div>
      <div class="scroll"><table style="min-width:480px"><thead><tr><th>플랫폼</th><th>토큰</th><th>활성</th></tr></thead><tbody id="devices"></tbody></table></div>
    </div>

    <div class="row cols-2" style="margin-top:18px;">
      <div class="card">
        <h2>최근 할당</h2>
        <div class="sub">최근 30건</div>
        <div class="scroll"><table><thead><tr><th>날짜</th><th>문장</th><th>완료</th></tr></thead><tbody id="assignments"></tbody></table></div>
      </div>
      <div class="card">
        <h2>최근 푸시</h2>
        <div class="sub">최근 30건</div>
        <div class="scroll"><table><thead><tr><th>시간</th><th>타입</th><th>상태</th><th>탭</th></tr></thead><tbody id="pushes"></tbody></table></div>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h2>최근 퀴즈</h2>
      <div class="sub">최근 30건</div>
      <div class="scroll"><table style="min-width:480px"><thead><tr><th>시간</th><th>퀴즈 ID</th><th>정답</th></tr></thead><tbody id="quizzes"></tbody></table></div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h2>결제 / 구독 히스토리</h2>
      <div class="sub">audit log 기반 · 최근 50건 (구매 · 갱신 · 환불 · admin 부여/회수 포함)</div>
      <div class="scroll"><table style="min-width:680px"><thead><tr><th>시간</th><th>출처</th><th>이벤트</th><th>결과</th><th>txn</th><th>비고</th></tr></thead><tbody id="subEvents"></tbody></table></div>
    </div>
  `;
  const scripts = `<script>
    (async function () {
      const r = await window.adminFetch('/api/admin/users/${safeId}');
      if (r.status === 404) { document.getElementById('userTitle').textContent = '찾을 수 없는 유저입니다.'; return; }
      const d = await r.json();
      const u = d.user;

      document.getElementById('userTitle').textContent = (u.nickname || u.email);
      document.getElementById('userMeta').textContent = u.email + ' · 가입 ' + u.createdAt;

      function row(k, v) { return '<tr><td style="color:#6b5b4b;font-size:12px;width:120px">' + k + '</td><td>' + v + '</td></tr>'; }
      // 클라이언트 환경: 인증 시점에 받은 OS/앱버전/디바이스 모델을
      // "iOS 17.5 · 1.1.0 (12) · iPhone15,2" 형태로 한 줄에 합쳐 노출.
      // 값이 하나도 없으면 '-' (구버전 클라이언트). 운영자가 한눈에
      // 사용자 환경을 파악할 수 있게.
      const clientParts = [];
      if (u.lastPlatform || u.lastOsVersion) {
        const os = [u.lastPlatform, u.lastOsVersion].filter(Boolean).join(' ');
        if (os) clientParts.push(os);
      }
      if (u.lastAppVersion) {
        clientParts.push(u.lastAppVersion + (u.lastAppBuild ? ' (' + u.lastAppBuild + ')' : ''));
      }
      if (u.lastDeviceModel) clientParts.push(u.lastDeviceModel);
      const clientInfoLine = clientParts.length ? clientParts.join(' · ') : '-';

      document.getElementById('profileTable').innerHTML = [
        row('ID', '<code style="font-size:11px">' + u.id + '</code>'),
        row('인증', window.pill(u.provider || '-')),
        row('플랜', window.pill(u.subscriptionTier, u.subscriptionTier === 'premium' ? 'ok' : 'muted')),
        row('언어', u.targetLanguage + ' / ' + u.nativeLanguage),
        row('타임존', u.timezone),
        row('학습 트랙', window.pill(u.learningTrack || 'unset', 'primary')),
        row('일일 목표', (u.dailyGoal != null ? u.dailyGoal + '문장' : '-')),
        row('활성 상태', u.isActive ? window.pill('active', 'ok') : window.pill('inactive', 'muted')),
        row('최근 접속', u.lastSeenAt || '<span style="color:#a39580">기록 없음</span>'),
        row('클라이언트', clientInfoLine),
        row('수정', u.updatedAt || '-'),
        u.deletedAt ? row('탈퇴', u.deletedAt) : '',
      ].join('');

      const s = d.stats;
      document.getElementById('userStats').innerHTML = [
        ['총 할당', s.totalAssignments],
        ['완료', s.completedAssignments],
        ['퀴즈 시도', s.quizAttempts],
        ['정답률', s.quizAccuracy + '%'],
      ].map((p) => '<div class="stat"><div class="k">' + p[0] + '</div><div class="v">' + p[1] + '</div></div>').join('');

      document.getElementById('subTable').innerHTML = d.subscription
        ? [ row('스토어', window.pill(d.subscription.store || '-', d.subscription.store === 'admin_grant' ? 'primary' : 'muted')),
            row('상품', d.subscription.productId || '-'),
            row('상태', d.subscription.isActive ? window.pill('active', 'ok') : window.pill('inactive', 'muted')),
            row('만료', d.subscription.expiresAt || '-'),
            row('자동갱신', d.subscription.autoRenew ? window.pill('on', 'ok') : window.pill('off', 'muted')),
            row('환경', d.subscription.environment || '-'),
            row('무료체험', d.subscription.inTrial ? window.pill('trial', 'warn') : window.pill('no', 'muted')),
            d.subscription.revokedAt ? row('회수일', d.subscription.revokedAt) : ''].join('')
        : '<tr><td class="empty">구독 정보 없음</td></tr>';

      document.getElementById('settingsTable').innerHTML = d.settings
        ? [ row('알림', d.settings.isEnabled ? window.pill('On', 'ok') : window.pill('Off', 'muted')),
            row('주기', d.settings.frequencyMinutes ? d.settings.frequencyMinutes + '분' : '-'),
            row('활성 시간', (d.settings.activeStartTime || '-') + ' ~ ' + (d.settings.activeEndTime || '-')),
            row('타임존', d.settings.timezone || '-'),
            row('단어 푸시 비율', d.settings.wordPushRatio != null ? d.settings.wordPushRatio : '-'),
            row('다음 푸시', d.settings.nextPushAt || '-'),
            row('수정', d.settings.updatedAt || '-') ].join('')
        : '<tr><td class="empty">알림 설정 없음</td></tr>';

      document.getElementById('devices').innerHTML = d.devices.length
        ? d.devices.map((dev) => {
            const tokenJs = JSON.stringify(dev.token || '').replace(/</g, '\\u003c').replace(/"/g, '&quot;');
            return '<tr><td>' + dev.platform + '<br><span style="color:#6b5b4b;font-size:12px">#' + dev.id + '</span></td>'
              + '<td><code style="font-size:11px;word-break:break-all;white-space:normal;display:block">' + window.escapeHtml(dev.token || '') + '</code>'
              + '<div style="margin-top:4px"><button type="button" class="btn ghost" style="font-size:11px;padding:2px 8px" onclick="window.copyText(this, ' + tokenJs + ')">복사</button></div>'
              + '<span style="color:#6b5b4b;font-size:12px">생성 ' + dev.createdAt + ' · 수정 ' + dev.updatedAt + '</span></td>'
              + '<td>' + (dev.isActive ? window.pill('active', 'ok') : window.pill('inactive', 'muted')) + '</td></tr>';
          }).join('')
        : '<tr><td colspan="3" class="empty">등록된 디바이스가 없습니다.</td></tr>';

      document.getElementById('assignments').innerHTML = d.recentAssignments.length
        ? d.recentAssignments.map((a) => '<tr><td>' + a.assignedDate + '<br><span style="color:#6b5b4b;font-size:12px">' + (a.completedAt ? '완료 ' + a.completedAt : '생성 ' + a.createdAt) + '</span></td><td>' + (a.sentenceText || '#' + a.sentenceId) + '<br><span style="color:#6b5b4b;font-size:12px">' + (a.sentenceTranslation || '') + '</span></td><td>' + (a.isCompleted ? window.pill('완료', 'ok') : window.pill(a.status || '대기', 'muted')) + '</td></tr>').join('')
        : '<tr><td colspan="3" class="empty">할당 내역 없음</td></tr>';

      document.getElementById('pushes').innerHTML = d.recentPushes.length
        ? d.recentPushes.map((p) => '<tr><td>' + p.sentAt + '</td><td>' + window.pill(p.pushType) + '</td><td>' + window.pill(p.status, p.status === 'sent' ? 'ok' : p.status === 'failed' ? 'fail' : 'muted') + '</td><td>' + (p.tappedAt ? window.pill('tapped', 'ok') : '-') + '</td></tr>').join('')
        : '<tr><td colspan="4" class="empty">푸시 기록 없음</td></tr>';

      document.getElementById('quizzes').innerHTML = d.recentQuizzes.length
        ? d.recentQuizzes.map((q) => '<tr><td>' + q.attemptedAt + '</td><td>#' + q.quizId + '</td><td>' + (q.isCorrect ? window.pill('정답', 'ok') : window.pill('오답', 'warn')) + '</td></tr>').join('')
        : '<tr><td colspan="3" class="empty">퀴즈 기록 없음</td></tr>';

      // Subscription event timeline — colour outcomes (applied/skipped/etc)
      // and label sources so the operator can scan for refunds vs renewals
      // at a glance.
      const sourceLabel = {
        apple_verify: 'Apple 구매',
        play_verify: 'Play 구매',
        apple_webhook: 'Apple 알림',
        google_webhook: 'Google 알림',
        google_voided: 'Google 환불',
        sweep: '만료 sweep',
        lazy_downgrade: '지연 다운그레이드',
        admin_grant: '관리자 부여',
        admin_revoke: '관리자 회수',
      };
      const outcomeTone = (o) => o === 'applied' ? 'ok' : (o === 'skipped' ? 'muted' : 'fail');
      document.getElementById('subEvents').innerHTML = d.subscriptionEvents.length
        ? d.subscriptionEvents.map((e) => {
            const noteParts = [];
            if (e.outcomeReason) noteParts.push(e.outcomeReason);
            if (e.productId) noteParts.push(e.productId);
            if (e.payload && e.payload.admin) noteParts.push('admin=' + e.payload.admin);
            if (e.payload && e.payload.days) noteParts.push(e.payload.days + '일');
            return '<tr>' +
              '<td>' + e.occurredAt + '</td>' +
              '<td>' + window.pill(sourceLabel[e.source] || e.source, e.source.startsWith('admin') ? 'primary' : 'muted') + '</td>' +
              '<td>' + (e.eventType || '-') + '</td>' +
              '<td>' + window.pill(e.outcome, outcomeTone(e.outcome)) + '</td>' +
              '<td>' + (e.txnIdTail ? '…' + e.txnIdTail : '-') + '</td>' +
              '<td style="color:#6b5b4b;font-size:12px">' + (noteParts.join(' · ') || '-') + '</td>' +
              '</tr>';
          }).join('')
        : '<tr><td colspan="6" class="empty">구독 이력 없음</td></tr>';

      const setMsg = (text, isError) => {
        const el = document.getElementById('grantMsg');
        el.textContent = text;
        el.style.color = isError ? '#b04a3a' : '#3a7c3a';
      };

      document.getElementById('grantBtn').addEventListener('click', async () => {
        const days = parseInt(document.getElementById('grantDays').value, 10);
        const reason = document.getElementById('grantReason').value.trim();
        if (!days || days <= 0) { setMsg('일수를 입력해주세요.', true); return; }
        if (!confirm(days + '일치 프리미엄을 부여하시겠습니까?')) return;
        setMsg('처리 중…', false);
        try {
          const r = await window.adminFetch('/api/admin/users/${safeId}/grant-premium', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ days, reason: reason || undefined }),
          });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            setMsg(err.message || '실패: HTTP ' + r.status, true);
            return;
          }
          const out = await r.json();
          setMsg('완료 — 만료 ' + out.subscription.expiresAt, false);
          setTimeout(() => location.reload(), 800);
        } catch (e) {
          setMsg('네트워크 오류: ' + e.message, true);
        }
      });

      document.getElementById('revokeBtn').addEventListener('click', async () => {
        const reason = document.getElementById('grantReason').value.trim();
        if (!confirm('정말 회수하시겠습니까? 즉시 free로 전환됩니다.')) return;
        setMsg('처리 중…', false);
        try {
          const r = await window.adminFetch('/api/admin/users/${safeId}/revoke-premium', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason || undefined }),
          });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            setMsg(err.message || '실패: HTTP ' + r.status, true);
            return;
          }
          setMsg('회수 완료', false);
          setTimeout(() => location.reload(), 800);
        } catch (e) {
          setMsg('네트워크 오류: ' + e.message, true);
        }
      });

      // ── 관리자 권한 토글 ──────────────────────────────────────────
      function paintAdminToggle(isAdmin) {
        const status = document.getElementById('adminStatus');
        const btn = document.getElementById('adminToggleBtn');
        status.textContent = isAdmin ? '🔔 관리자 알림 수신 중' : '비활성';
        status.style.color = isAdmin ? '#3a7c3a' : '#6b5b4b';
        btn.textContent = isAdmin ? '권한 해제' : '권한 부여';
        btn.disabled = false;
        btn.dataset.next = isAdmin ? 'false' : 'true';
      }
      paintAdminToggle(!!u.isAdmin);

      const adminMsg = (text, isError) => {
        const el = document.getElementById('adminMsg');
        el.textContent = text;
        el.style.color = isError ? '#b04a3a' : '#3a7c3a';
      };

      document.getElementById('adminToggleBtn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const next = btn.dataset.next === 'true';
        if (next && !confirm('이 사용자에게 관리자 권한을 부여합니다. 신규 문의 / 결제 / 환불 / 구독취소 알림을 이 사용자의 LingoLoop 앱으로 받게 됩니다.')) return;
        if (!next && !confirm('관리자 권한을 해제하시겠습니까? 운영 이벤트 알림이 더 이상 안 옵니다.')) return;
        btn.disabled = true;
        adminMsg('처리 중…', false);
        try {
          const r = await window.adminFetch('/api/admin/users/${safeId}/set-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isAdmin: next }),
          });
          if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            adminMsg(err.message || '실패: HTTP ' + r.status, true);
            btn.disabled = false;
            return;
          }
          const out = await r.json();
          paintAdminToggle(out.isAdmin);
          adminMsg(out.isAdmin ? '관리자 권한 부여 완료' : '관리자 권한 해제 완료', false);
        } catch (err) {
          adminMsg('네트워크 오류: ' + err.message, true);
          btn.disabled = false;
        }
      });
    })();
  </script>`;
  return { content, scripts };
}

const TRACK_LABELS: Record<string, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
  toeic: '토익',
  toefl: '토플',
  conversation: '회화',
  jlpt_n5: 'JLPT N5',
  jlpt_n4: 'JLPT N4',
  jlpt_n3: 'JLPT N3',
  jlpt_n2: 'JLPT N2',
  jlpt_n1: 'JLPT N1',
  jpt: 'JPT',
};

/// 어드민 UI에 사용하는 언어 메타. content list/seed 화면의 언어 picker.
const ADMIN_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'en', label: '🇺🇸 영어' },
  { code: 'ja', label: '🇯🇵 일본어' },
];

function buildAiPrompt(
  track: string,
  label: string,
  hint: string,
  languageCode: string,
): string {
  return languageCode === 'ja'
    ? buildJaAiPrompt(track, label, hint)
    : buildEnAiPrompt(track, label, hint);
}

function buildEnAiPrompt(track: string, label: string, hint: string): string {
  return `You are generating English-learning sentences for the LingoLoop app.
Output ONLY a CSV — no markdown fences, no commentary, no surrounding prose.

Header (exact, first row):
text,translation,pronunciation,situation,difficulty,category,words

Rules per column:
- text:          ONE natural English sentence. No numbering, no quotes around the whole sentence unless required by CSV rules below.
- translation:   Natural Korean translation. 자연스러운 의역 환영.
- pronunciation: Korean phonetic guide in 한글 (NOT IPA). 어절 사이는 공백.
- situation:     1줄 한국어. 그 문장을 어떤 상황/맥락에서 쓰는지.
- difficulty:    one of: beginner | intermediate | advanced
- category:      short English tag (lowercase, e.g. greeting, business, idiom, food).
- words:         JSON array of the 2~6 KEY words from the sentence with Korean meanings.
                 Shape: [{"w":"<english word>","m":"<korean meaning>"}, ...]
                 Skip articles (a/an/the), be-verbs, basic pronouns. Pick the words that
                 carry the lesson (nouns, verbs, idioms, less common words).
                 If a sentence has only filler words, an empty array [] is acceptable.

CSV escaping (반드시 지켜야 합니다):
- Wrap any field containing a comma, newline, or quote in "double quotes".
- Escape an inner double quote by doubling it: "He said ""Hi""".
- The "words" column is JSON inside CSV — its double quotes MUST be doubled:
    "[{""w"":""bus"",""m"":""버스""},{""w"":""stop"",""m"":""정류장""}]"
- UTF-8. No BOM required, no tab characters, no trailing spaces.

Target for this batch:
- 트랙: ${label} (${track})
- 트랙 가이드: ${hint}
- 개수: {N}개
- 주제(선택): {주제}

Constraints:
- 같은 영어 문장이 두 번 나오지 않게 해주세요 (서버에서 자동 스킵되지만 깔끔하게).
- difficulty는 이 트랙의 가이드에 맞춰 사용해주세요.
- pronunciation은 한글로만. 가능한 한 또박또박, 음절 분리는 자연스럽게.
- words 컬럼은 반드시 채워주세요 — 학습 카드를 만드는 데 쓰입니다.

Quality self-check (각 행을 출력하기 전에 반드시 검토하세요):
1. 영어가 자연스러운가? — 원어민이 실제로 쓰는 표현인지 확인하세요. 교과서식 직역체나
   문법은 맞지만 어색한 문장은 다시 쓰세요. 의심되면 더 흔한 표현으로 교체.
   (예: "Is breakfast included in the room?" 어색 → "Is breakfast included in the room rate?"
        또는 "Does the room include breakfast?")
2. translation이 정확한가? — 영어가 의미하는 바를 빠짐없이, 더하지 않고 한국어로 옮겼는가.
   존댓말/반말, 격식 수준이 상황(situation)과 맞는가.
3. pronunciation이 실제 발음에 가까운가? — "스피크"(speak)를 "스페아크"라고 쓰지 말고,
   "오프"(off)와 "오브"(of) 같은 흔한 혼동을 정확히 구분.
4. situation이 구체적이고 그 문장에 맞는 상황인가? — 너무 일반적이지("말할 때") 않고,
   구체적이어야 학습자가 맥락을 잡습니다.
5. words 각 단어의 뜻이 그 문장 안에서 쓰인 의미와 일치하는가? — 다의어는 문맥에 맞는
   뜻으로. (예: "stop"이 동사 "멈추다"가 아니라 명사 "정류장"인 문장이면 "정류장")
6. text가 차분히 읽었을 때 사람이 자연스럽게 말하는 리듬인가? — 어색한 어순,
   원어민이 잘 쓰지 않는 단어 조합은 피하세요.

위 6개 항목 중 하나라도 의심되면 그 행을 폐기하고 새로 작성하세요.
형식은 통과하지만 품질이 떨어지는 20개보다, 모든 면에서 자연스러운 18개가 낫습니다.

Example (참고용 형식 — 따옴표 이스케이프 잘 보세요):
text,translation,pronunciation,situation,difficulty,category,words
"Where is the bus stop?","버스 정류장이 어디에 있나요?","웨어 이즈 더 버스 스탑","버스 정류장 위치를 물을 때",beginner,travel,"[{""w"":""where"",""m"":""어디""},{""w"":""bus"",""m"":""버스""},{""w"":""stop"",""m"":""정류장""}]"
"He said ""Hi""","그가 ""안녕"" 이라고 했다","히 세드 하이","따옴표 이스케이프 예시",beginner,quote,"[{""w"":""said"",""m"":""말했다""}]"

이제 위 요건에 맞춰 {N}개 문장의 CSV를 출력해주세요. 헤더 한 줄 다음 곧바로 데이터 행만 출력. 끝.`;
}

function buildJaAiPrompt(track: string, label: string, hint: string): string {
  return `You are generating Japanese-learning sentences for the LingoLoop app.
Output ONLY a CSV — no markdown fences, no commentary, no surrounding prose.

Header (exact, first row):
text,translation,pronunciation,situation,difficulty,category,words

Rules per column:
- text:          자연스러운 일본어 문장 한 개. 한자/히라가나/카타카나는 트랙 수준에 맞게
                 (beginner는 히라가나 중심, 고급으로 갈수록 한자 비중 증가).
                 평서문은 「。」, 의문문은 「？」/「か」로 마감.
                 · N5/N4라도 일상에서 늘 한자로 쓰는 단어(明日/元気/お願い/学校/今日/食べる)
                   는 한자 그대로. 모든 단어를 히라가나로 풀어쓰면 학습자가 실제 일본어
                   표기와 괴리되어 신문·간판·웹페이지에서 못 읽음.
- translation:   자연스러운 한국어 번역. 직역 X, 의역 환영. 일본어 원문의 정중도/
                 반말이 한국어 톤(~입니다/~예요/~야)에 매칭되도록.
                 · 인사/관용 표현(こんばんは, ただいま, お疲れさま, いただきます 등)은
                   풀어쓰지 말고 한국식 인사로 자연 매칭. 한국에 1:1 표현이 없으면
                   "안녕하세요 (저녁 인사)" 처럼 한국식 인사 + 괄호로 맥락 보조.
                   ❌ こんばんは → "안녕하세요, 좋은 저녁이에요" (ChatGPT 직역체)
                   ✅ こんばんは → "안녕하세요 (저녁 인사)"
                 · **문법 패턴의 뉘앙스 보존** — 다음 패턴은 뉘앙스가 살아 있도록:
                     ~かねない (부정적 가능성/우려): "할 수 있다" ❌ → "할 우려가 있다"
                                                 "범할 수 있다" / "초래할 수 있다" ✅
                     ~ざるを得ない (어쩔 수 없음/강요): "~한다" ❌ → "~할 수밖에 없다" ✅
                     ~わけにはいかない (도덕적 불가): "안 된다" ❌ → "~할 수는 없다" ✅
                     ~ものだ (보편 진리·당위): "그렇다" ❌ → "법이다 / ~인 법이다" ✅
                   문법이 가진 톤(우려/강요/당위)이 한국어 번역에서도 들리게.
- pronunciation: 한글 표기 (NOT 로마자). 어절 사이 공백.
                 · 장음 「-」 (コーヒー → 코-히-, おはよう → 오하요-)
                 · 촉음 「っ」은 「ㅅ」 받침 (行った → 잇타)
                 · 발음 「ん」은 「ㅇ」/「ㄴ」 받침 (今度 → 콘도, 連絡 → 렌라쿠)
                 · **한자어 안의 촉음** 누락 주의 — 표기엔 「っ」이 안 보여도 실제
                   발음에 촉음이 들어가는 한자어가 많음:
                     欲求(yokkyū) → 욧큐- (요큐- ❌)
                     結果(kekka) → 켓카 (케카 ❌)
                     学校(gakkō) → 갓코- (가코- ❌)
                     勉強(benkyō) → 벤쿄- (벤쿄-는 OK, 勉学 mengaku는 멩가쿠)
                   확신 없으면 사전형(romaji)로 확인 후 ㅅ받침/장음 정확히.
- situation:     1줄 한국어. 그 문장을 어떤 상황/맥락에서 쓰는지 구체적으로.
- difficulty:    one of: beginner | intermediate | advanced
                 (서버 enum은 이 3개뿐 — JLPT N5/N4 → beginner, N3 → intermediate,
                  N2/N1/jpt/advanced 트랙 → advanced)
- category:      short English tag (lowercase, e.g. greeting, business, meal, weather).
- words:         JSON array of the 2~5 KEY words from the sentence with Korean meanings.
                 Shape: [{"w":"<일본어 단어>","m":"<한국어 뜻>"}, ...]
                 조사(は/が/を/に/で), 정중 어미(です/ます)는 보통 제외.
                 핵심 명사·동사·형용사·관용 표현 위주.
                 · 각 단어의 m(뜻)은 **단독 학습 단위로서의 핵심 의미를 우선**.
                   무관한 의미 콤마 나열 금지 — "건강함, 안부" ❌ → "건강(하심)" ✅
                 · 단독 단어 의미와 문맥 의역이 크게 다르면 "단독 의미(문맥: ...)"
                   형식으로 **둘 다 표시**해 단어장 카드(단독 학습) + 문장 내 의미
                   둘 다 학습 가능하게:
                     ❌ 査収 → "검토 수령" (한국어로 어색한 합성)
                     ✅ 査収 → "수령(문맥: 검토 후 수령)"
                     ❌ 幸い → "감사함" (단독 의미는 "다행")
                     ✅ 幸い → "다행(문맥: ~いただければ幸い=감사하겠다)"
                     ❌ 徹底 → "철저 시행"
                     ✅ 徹底 → "철저(문맥: 철저히 시행)"
                   단독과 문맥 의미가 거의 같으면 단독만으로 충분 (学校→"학교",
                   今日→"오늘", 走る→"달리다").
                 · 정중 접미사·복합 인사는 의미 단위로 분리해 학습 가치 확보.
                   ❌ おはようございます 한 덩어리로 [{"w":"おはようございます","m":"좋은 아침입니다"}]
                   ✅ 분리: [{"w":"おはよう","m":"아침 인사"},{"w":"ございます","m":"~입니다(정중)"}]
                   よろしくお願いします도 同じ: よろしく + お願いします.

CSV escaping (반드시 지켜야 합니다):
- Wrap any field containing a comma, newline, or quote in "double quotes".
- Escape an inner double quote by doubling it: "彼は ""ありがとう"" と言った".
- The "words" column is JSON inside CSV — its double quotes MUST be doubled:
    "[{""w"":""学校"",""m"":""학교""},{""w"":""行く"",""m"":""가다""}]"
- UTF-8. No BOM required, no tab characters, no trailing spaces.

Target for this batch:
- 트랙: ${label} (${track})
- 트랙 가이드: ${hint}
- 개수: {N}개
- 주제(선택): {주제}

Constraints:
- 같은 일본어 문장이 두 번 나오지 않게 해주세요 (서버에서 자동 스킵되지만 깔끔하게).
- difficulty는 이 트랙의 가이드에 맞춰 사용해주세요.
- pronunciation은 한글로만. 로마자/IPA 금지.
- words 컬럼은 반드시 채워주세요 — 학습 카드를 만드는 데 쓰입니다.

Quality self-check (각 행을 출력하기 전에 반드시 검토하세요):
1. 일본어가 자연스러운가? — 「私は学校に行きます」 같은 교과서적 정의문 회피.
   원어민이 실제로 쓰는 표현인지 확인. 의심되면 맥락 있는 표현으로 교체.
   (예: "私は走る" → "公園で犬と走っています")
2. 한자/히라가나 균형이 트랙 수준에 맞는가? — beginner에 「諸般」 같은 어려운 한자
   금지, advanced에서 모든 단어를 히라가나로 풀어쓰지 말 것.
3. 정중도가 situation과 일치하는가? — 친구 톤(だ·である / 회화체)과 비즈니스 톤
   (です·ます / 敬語)이 같은 문장에 섞이지 않게.
4. translation이 자연스러운 한국어인가? — 「~です」를 무조건 "~입니다"로 옮기지
   말고, 친근한 자리면 "~예요"/"~야"로 톤 매칭. 인사/관용 표현은 풀어쓰지 말고
   한국식 인사 + 괄호로 맥락 보조 (こんばんは → "안녕하세요 (저녁 인사)").
5. pronunciation이 실제 일본어 발음에 가까운가? — 장음 「-」 정확히, 「ん」 받침
   정확히 (콘도 vs 콩도가 아니라 콘도). **한자어 촉음 누락 주의** — 표기엔 「っ」이
   없어도 발음엔 들어가는 한자어 다수 (欲求→욧큐-, 結果→켓카, 学校→갓코-).
6. words 각 단어의 뜻이 그 문장 안 의미와 일치하는가? — 다의어(いる: 있다 vs
   필요하다, かける: 걸다 vs 곱하다)는 문맥에 맞는 뜻으로. m은 단독 학습 단위
   의미 우선, 단독과 문맥이 크게 다르면 "단독(문맥: ...)" 형식으로 둘 다 표시
   (査収 → "수령(문맥: 검토 후 수령)"). 복합 인사는 의미 단위로 분리.
7. text에 흔한 기초 한자가 한자로 들어가 있는가? — 「明日」를 「あした」로, 「元気」를
   「げんき」로 풀어쓰면 N5라도 실제 일본어 문서와 괴리. 모든 단어를 히라가나로만
   쓰지 말 것.

위 7개 항목 중 하나라도 의심되면 그 행을 폐기하고 새로 작성하세요.
형식은 통과하지만 품질이 떨어지는 20개보다, 모든 면에서 자연스러운 18개가 낫습니다.

Example (참고용 형식 — 따옴표 이스케이프 잘 보세요. 한자 노출/words 분리에 주목):
text,translation,pronunciation,situation,difficulty,category,words
"今日は寒いですね。","오늘은 춥네요.","쿄-와 사무이데스네","날씨 인사",beginner,daily,"[{""w"":""今日"",""m"":""오늘""},{""w"":""寒い"",""m"":""춥다""}]"
"おはようございます。","안녕하세요 (아침 인사).","오하요- 고자이마스","아침에 처음 만났을 때",beginner,greeting,"[{""w"":""おはよう"",""m"":""아침 인사""},{""w"":""ございます"",""m"":""~입니다(정중)""}]"
"明日また会いましょう。","내일 또 만나요.","아시타 마타 아이마쇼-","헤어지면서 약속할 때",beginner,greeting,"[{""w"":""明日"",""m"":""내일""},{""w"":""会う"",""m"":""만나다""}]"

이제 위 요건에 맞춰 {N}개 문장의 CSV를 출력해주세요. 헤더 한 줄 다음 곧바로 데이터 행만 출력. 끝.`;
}

const TRACK_AI_HINTS_BY_LANG: Record<string, Record<string, string>> = {
  en: {
    beginner:
      '입문자용. 5~8단어, 현재형/단순 과거. 인사·자기소개·길 묻기·주문 등 첫 만남 상황 위주',
    intermediate:
      '중급. 8~15단어, 현재완료/관계대명사/조동사 활용. 직장 동료와의 대화, 여행 중 트러블, 가벼운 토론',
    advanced:
      '고급. 12~25단어, 가정법·도치·복합 종속절. 발표/협상/뉴스 코멘트 같은 격식 있는 표현',
    toeic:
      '토익 PART 1~7 빈출 비즈니스 영어. 이메일, 미팅, 보고서, 회사 안내 같은 업무 맥락',
    toefl:
      '토플 ibT 스피킹·라이팅 빈출 학술 영어. 강의 요약, 과학/사회 토픽, 논증 표현',
    conversation:
      '일상 회화. 친구/연인/가족과 자연스러운 구어체. 줄임말과 자연스러운 리듬',
  },
  ja: {
    beginner:
      '입문 일본어. 5~12자, 인사·자기소개·식사·길 묻기. 히라가나 위주, 기본 한자(私/学校/今日/食べる 등)만',
    intermediate:
      '중급 회화. 12~25자, です·ます 기본 + ~てくる/~ようになる/~ば 같은 핵심 N4~N3 문법 활용',
    advanced:
      '고급 격식. 비즈니스 메일·회의 톤. 敬語(존경어·겸양어)와 ~いたします/~させていただく 같은 정중 표현',
    jlpt_n5:
      'JLPT N5 빈출 문법(です/ます/~を/~が/~に/~で). 800단어 수준 기초 어휘. 히라가나 중심, 기본 한자만',
    jlpt_n4:
      'JLPT N4 문법(~たい/~ば/~たことがある/~ようになる/可能形). 일상 대화 + 기초 한자 확장',
    jlpt_n3:
      'JLPT N3 문법(~べき/~はず/~わけ/~ように/~ても). 일상 + 가벼운 의견 표현. 한자 비중 증가',
    jlpt_n2:
      'JLPT N2 문법(~ばかり/~ながら/~に違いない/~とおりに). 뉴스·기사·논설에서 보이는 격식',
    jlpt_n1:
      'JLPT N1 문법(~に至る/~を踏まえて/~かねない/~まじき/~を余儀なくされる). 격식 있는 문어체·뉴스체',
    jpt:
      'JPT 비즈니스 일본어. 회의·메일·납기·계약. お世話になっております / ご検討 / 申し上げます 같은 비즈니스 keigo',
    conversation:
      '일상 회화 구어체. マジ/うそでしょ/~ちゃった/なんか 같은 친근한 표현. 친구·가족·연인 톤',
  },
};

export function renderContentIndex(): PageBody {
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · 콘텐츠</div>
        <h1>콘텐츠 / 문장 섹션</h1>
      </div>
      <div class="actions">
        <button class="btn secondary" id="seedBtn">📦 시드 가져오기</button>
      </div>
    </div>
    <div class="card">
      <h2>섹션(트랙) 선택</h2>
      <div class="sub">먼저 학습 언어를 고르고, 트랙을 누르면 해당 언어의 문장만 표시됩니다.</div>
      <div style="margin:14px 0;display:flex;gap:8px;flex-wrap:wrap" id="langTabs">
        ${ADMIN_LANGUAGES.map(
          (l) => `<button class="btn ghost" data-lang="${escapeHtml(l.code)}">${l.label}</button>`,
        ).join('')}
      </div>
      <div id="tracks" class="track-grid"></div>
      <div id="seedResult" style="margin-top:14px;color:#6b5b4b;font-size:13px"></div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h2>📦 시드 가져오기란?</h2>
      <div class="sub">우측 상단 버튼이 무슨 일을 하는지</div>
      <div style="font-size:13px;line-height:1.7;color:#3a2a18;">
        <p style="margin:0 0 10px;">
          코드베이스에 내장된 <strong>기본 문장 묶음</strong>(현재 약 400+개)을 DB에 일괄 등록합니다.
          파일 위치: <code>server/src/modules/admin/seed-data/sentences.en.ts</code> — git으로 버전 관리되는 운영 자산이에요.
        </p>
        <p style="margin:0 0 6px;font-weight:700;">언제 누르면 되나</p>
        <ul style="margin:0 0 10px;padding-left:18px;">
          <li>새 환경에 DB를 처음 띄웠을 때 — 디폴트 콘텐츠 한 번에 채우기</li>
          <li>개발자가 시드 파일에 새 문장을 추가하고 배포했을 때 — 운영 DB에 그 추가분만 반영</li>
          <li>일부 트랙이 비어 있는 등 누락이 발견됐을 때 — 누락분만 복구</li>
        </ul>
        <p style="margin:0 0 6px;font-weight:700;">동작</p>
        <ul style="margin:0 0 10px;padding-left:18px;">
          <li>같은 <code>text</code>(영어 문장)가 이미 있으면 자동 스킵 — <strong>여러 번 눌러도 안전</strong></li>
          <li>단어 카드·문법 노트가 정의된 행은 자식 테이블도 함께 채움</li>
          <li>완료 후 <code>{ added, total }</code>가 표시됩니다 (added는 이번에 새로 들어간 행 수)</li>
        </ul>
        <p style="margin:0;color:#6b5b4b;">
          <strong>CSV 업로드</strong>와의 차이: CSV는 운영자가 임시로 부어 넣는 데이터(DB에만 적용), 시드는 코드에 박혀 모든 환경에 일관되게 깔리는 기준선이에요.
        </p>
      </div>
    </div>
  `;
  const scripts = `<script>
    (async function () {
      const labels = ${JSON.stringify(TRACK_LABELS)};
      // 마지막으로 선택한 언어를 localStorage에 저장 — 페이지 reload해도
      // 같은 언어로 복원. 첫 진입은 'en'.
      let currentLang = localStorage.getItem('admin_lang') || 'en';
      function setLang(code) {
        currentLang = code;
        localStorage.setItem('admin_lang', code);
        document.querySelectorAll('#langTabs button').forEach((b) => {
          b.classList.toggle('primary', b.dataset.lang === code);
          b.classList.toggle('ghost', b.dataset.lang !== code);
        });
      }
      setLang(currentLang);
      document.querySelectorAll('#langTabs button').forEach((b) => {
        b.addEventListener('click', () => {
          setLang(b.dataset.lang);
          loadCounts();
        });
      });

      async function loadCounts() {
        const r = await window.adminFetch(
          '/api/admin/sentences/tracks?lang=' + encodeURIComponent(currentLang),
        );
        const items = await r.json();
        document.getElementById('tracks').innerHTML = items.map((t) => (
          '<a class="track-tile" href="/backstage/content/' + t.track +
            '?lang=' + encodeURIComponent(currentLang) + '">' +
            '<div class="name">' + (labels[t.track] || t.track) + '</div>' +
            '<div class="meta">' + t.track + '</div>' +
            '<div class="count">' + t.count + '</div>' +
            '<div class="meta">활성 문장</div>' +
          '</a>'
        )).join('');
      }
      document.getElementById('seedBtn').addEventListener('click', async () => {
        if (!confirm('서버에 내장된 기본 문장 시드를 가져옵니다.\\n중복(같은 영어 문장)은 자동으로 건너뜁니다.\\n진행할까요?')) return;
        const btn = document.getElementById('seedBtn');
        const out = document.getElementById('seedResult');
        btn.disabled = true; out.textContent = '⏳ 시드 가져오는 중… (수십 초 걸릴 수 있어요)';
        try {
          const r = await window.adminFetch('/api/admin/seed', { method: 'POST' });
          const data = await r.json();
          out.innerHTML = '✅ 완료 · 추가 <strong>' + (data.added ?? '?') + '</strong>개 · 전체 <strong>' + (data.total ?? '?') + '</strong>개';
          await loadCounts();
        } catch (e) {
          out.textContent = '⚠ 시드 실패: ' + (e.message || e);
        } finally {
          btn.disabled = false;
        }
      });
      loadCounts();
    })();
  </script>`;
  return { content, scripts };
}

export function renderContentTrack(
  track: string,
  languageCode = 'en',
): PageBody {
  const safeTrack = escapeHtml(track);
  const safeLang = escapeHtml(languageCode);
  const label = TRACK_LABELS[track] || track;
  const langLabel =
    ADMIN_LANGUAGES.find((l) => l.code === languageCode)?.label ?? languageCode;
  const langHints =
    TRACK_AI_HINTS_BY_LANG[languageCode] ?? TRACK_AI_HINTS_BY_LANG.en;
  const fallbackHint =
    languageCode === 'ja' ? '자연스러운 일본어 학습 문장' : '자연스러운 영어 학습 문장';
  const aiHint = langHints[track] || fallbackHint;
  const aiPromptText = buildAiPrompt(track, label, aiHint, languageCode);

  // CSV 모달 helper의 예시·라벨도 트랙 언어에 맞춰 분기. JA 트랙에서
  // EN 예시가 그대로 박혀 있으면 운영자가 "이 트랙에 영어 문장을 넣어야
  // 하나?" 헷갈리게 됨.
  const isJa = languageCode === 'ja';
  const sampleCsvLines = isJa
    ? `"今日は寒いですね。","오늘은 춥네요.","쿄-와 사무이데스네","날씨 인사",beginner,daily,"[{""w"":""今日"",""m"":""오늘""},{""w"":""寒い"",""m"":""춥다""}]"
"駅はどこですか。","역은 어디입니까?","에키와 도코데스카","길을 물을 때",beginner,travel,"[{""w"":""駅"",""m"":""역""},{""w"":""どこ"",""m"":""어디""}]"`
    : `"Where is the bus stop?","버스 정류장이 어디에 있나요?","웨어 이즈 더 버스 스탑","버스 정류장 위치를 물을 때",beginner,travel,"[{""w"":""where"",""m"":""어디""},{""w"":""bus"",""m"":""버스""},{""w"":""stop"",""m"":""정류장""}]"
"It's a piece of cake.","식은 죽 먹기야.","잇츠 어 피스 오브 케익","쉽다고 말할 때",intermediate,idiom,"[{""w"":""piece"",""m"":""조각""},{""w"":""cake"",""m"":""케이크""}]"`;
  const textColLabel = isJa ? '일본어 원문' : '영어 원문';
  const pronExample = isJa ? '예: 쿄-와 사무이데스네' : '예: 헬로 월드';
  const wordsExample = isJa
    ? '[{"w":"学校","m":"학교"}]'
    : '[{"w":"bus","m":"버스"}]';
  const escapeExample = isJa
    ? '"彼は ""ありがとう"" と言った"'
    : '"He said ""Hi"""';
  const quoteWrapExample = isJa ? '"こんにちは、世界"' : '"Hello, world"';
  const dedupTextLabel = isJa ? '일본어 문장' : '영어 문장';
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · <a href="/backstage/content">콘텐츠</a> · ${langLabel} · ${escapeHtml(label)}</div>
        <h1>${langLabel} · ${escapeHtml(label)} 섹션</h1>
      </div>
      <div class="actions">
        <button class="btn secondary" id="csvBtn">📥 CSV 업로드</button>
        <button class="btn" id="addBtn">+ 새 문장</button>
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="left">
          <input id="q" placeholder="문장/해석 검색" />
        </div>
        <div class="info" id="total"></div>
      </div>
      <div class="scroll">
        <table>
          <thead>
            <tr><th>문장</th><th>해석</th><th>난이도</th><th>활성</th><th></th></tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div class="pager">
        <button id="prev">←</button>
        <span class="info" id="pageInfo"></span>
        <button id="next">→</button>
      </div>
    </div>

    <!-- Add / Edit modal -->
    <dialog id="editDlg">
      <form class="modal" id="editForm" method="dialog">
        <h2 id="dlgTitle">새 문장</h2>
        <input type="hidden" name="id" />
        <label>영어 문장</label>
        <textarea name="text" required></textarea>
        <label>한국어 해석</label>
        <textarea name="translation" required></textarea>
        <div class="row2">
          <div><label>발음 (선택)</label><input name="pronunciation" /></div>
          <div><label>상황 (선택)</label><input name="situation" /></div>
        </div>
        <div class="row2">
          <div><label>난이도</label>
            <select name="difficulty">
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
          </div>
          <div><label>카테고리 (선택)</label><input name="category" /></div>
        </div>
        <div class="row2">
          <div><label>트랙</label>
            <select name="track">
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
              <option value="toeic">toeic</option>
              <option value="toefl">toefl</option>
              <option value="conversation">conversation</option>
            </select>
          </div>
          <div><label>활성</label>
            <select name="isActive">
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
        </div>
        <div class="actions">
          <button class="btn ghost" type="button" id="dlgDeactivate" style="display:none;color:#a07c1a;border-color:#f1dfa3;">비활성화</button>
          <button class="btn ghost" type="button" id="dlgHardDelete" style="display:none;color:#fff;background:#c54c4c;border-color:#c54c4c;">완전 삭제</button>
          <span style="flex:1"></span>
          <button class="btn secondary" type="button" id="dlgCancel">취소</button>
          <button class="btn" type="submit" id="dlgSave">저장</button>
        </div>
      </form>
    </dialog>

    <!-- CSV upload modal -->
    <dialog id="csvDlg">
      <div class="modal">
        <h2>CSV 업로드 · <span style="color:#f26b3a">${escapeHtml(track)}</span></h2>
        <div class="csv-guide" style="background:#fff8ef;border:1px solid #f3e5cf;border-radius:14px;padding:14px 16px;font-size:13px;color:#3a2a18;margin-bottom:14px;">
          <div style="font-weight:800;margin-bottom:8px;">📌 형식</div>
          <div style="margin-bottom:6px;">
            첫 줄은 반드시 헤더. 컬럼 순서는 상관없고, 컬럼 이름이 키예요.
          </div>
          <pre style="background:#fff;border:1px solid #f0e6d7;border-radius:10px;padding:10px;margin:6px 0 10px;font-size:12px;line-height:1.5;overflow:auto;">text,translation,pronunciation,situation,difficulty,category,words
${sampleCsvLines}</pre>

          <div style="font-weight:800;margin:10px 0 4px;">필수 컬럼</div>
          <div><code>text</code> · ${textColLabel} (이미 DB에 같은 문장이 있으면 자동 스킵)</div>
          <div><code>translation</code> · 한국어 해석</div>

          <div style="font-weight:800;margin:10px 0 4px;">선택 컬럼</div>
          <div><code>pronunciation</code> · 한국어 발음 가이드 (${pronExample})</div>
          <div><code>situation</code> · 어떤 상황에서 쓰는지 한 줄</div>
          <div><code>difficulty</code> · <code>beginner</code> · <code>intermediate</code> · <code>advanced</code> 중 하나. 비우면 <code>beginner</code></div>
          <div><code>category</code> · 분류 태그 (예: greeting / business / food)</div>
          <div><code>words</code> · 학습 카드용 단어 JSON 배열. 형식: <code>${wordsExample}</code>. CSV 안에선 큰따옴표 더블링. 비워두면 단어 카드 없이 문장만 등록.</div>

          <div style="font-weight:800;margin:10px 0 4px;">⚠ 주의사항</div>
          <ul style="margin:0;padding-left:18px;line-height:1.7;">
            <li><strong>UTF-8</strong>로 저장하세요. 엑셀에서 저장 시 "CSV UTF-8 (쉼표로 분리)" 선택 (한글 깨짐 방지).</li>
            <li>값에 콤마·줄바꿈·따옴표가 포함되면 <strong>큰따옴표</strong>로 감싸세요: <code>${quoteWrapExample}</code></li>
            <li>큰따옴표 자체는 <code>""</code>(두 개)로 이스케이프합니다: <code>${escapeExample}</code></li>
            <li>업로드 트랙은 <strong>${escapeHtml(track)}</strong>로 강제됩니다. CSV에 track 컬럼이 있어도 무시돼요.</li>
            <li>같은 <code>text</code>(${dedupTextLabel})는 자동 스킵하므로 같은 파일을 두 번 올려도 안전합니다.</li>
            <li>결과는 <strong>삽입 · 건너뜀(중복) · 오류(text/translation 둘 중 하나라도 비어 있음)</strong>로 나옵니다.</li>
          </ul>
        </div>

        <details style="margin-bottom:12px;background:#fff;border:1px solid #f0e6d7;border-radius:14px;padding:10px 14px;">
          <summary style="cursor:pointer;font-weight:700;font-size:13px;">🤖 AI(ChatGPT, Claude 등)로 CSV 만들 때 쓸 프롬프트</summary>
          <div style="margin-top:10px;font-size:12px;color:#6b5b4b;line-height:1.7;">
            아래 두 칸을 채우면 프롬프트가 자동으로 완성됩니다. <strong>복사</strong>해서 AI에게 붙여 넣고, 결과 CSV를 받아 위의 파일 칸에 올리면 끝.
          </div>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:10px;margin-top:10px;">
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#6b5b4b;margin-bottom:4px;">개수 (N)</label>
              <input id="aiN" type="number" min="1" value="20" style="width:100%;padding:9px 12px;border-radius:12px;border:1px solid #e7d7c6;font-size:14px;" />
            </div>
            <div>
              <label style="display:block;font-size:12px;font-weight:700;color:#6b5b4b;margin-bottom:4px;">주제 (선택 — AI가 어떤 상황의 문장을 만들지 좁혀줘요)</label>
              <input id="aiTopic" placeholder="예: 카페에서 주문 · 비즈니스 이메일 회신 · 공항 체크인 (비워두면 트랙 가이드만 따라감)" style="width:100%;padding:9px 12px;border-radius:12px;border:1px solid #e7d7c6;font-size:14px;" />
            </div>
          </div>
          <div style="margin-top:8px;font-size:11px;color:#6b5b4b;">
            ⓘ AI가 가끔 <code>\`\`\`csv</code> 마크다운 펜스를 덧붙이는데, 그건 직접 지워주세요.
          </div>
          <textarea id="aiPrompt" readonly rows="14" style="width:100%;margin-top:10px;padding:12px;border-radius:12px;border:1px solid #e7d7c6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;background:#faf6ef;color:#23180f;"></textarea>
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">
            <button class="btn secondary" type="button" id="aiCopy">📋 프롬프트 복사</button>
            <span id="aiCopied" style="color:#2f8f5b;font-size:13px;display:none;">복사됐어요</span>
          </div>
        </details>

        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          <button class="btn secondary" type="button" id="csvSample">📄 샘플 CSV 다운로드</button>
          <input type="file" id="csvFile" accept=".csv,text/csv,text/plain" style="flex:1;min-width:200px" />
        </div>
        <details style="margin-bottom:10px;background:#fff;border:1px solid #f0e6d7;border-radius:14px;padding:10px 14px;">
          <summary style="cursor:pointer;font-weight:700;font-size:13px;">📝 또는 AI 응답 텍스트를 직접 붙여넣기</summary>
          <div style="margin-top:8px;font-size:12px;color:#6b5b4b;line-height:1.6;">
            ChatGPT/Claude가 출력한 결과를 그대로 붙여 넣으세요. 코드 펜스(<code>\`\`\`csv</code>),
            번호 prefix(<code>1.</code>), 스마트 따옴표는 자동으로 정리됩니다.
            파일로 저장할 필요 없어요.
          </div>
          <textarea id="csvPaste" rows="8" placeholder="text,translation,pronunciation,situation,difficulty,category&#10;&quot;Hello, world&quot;,&quot;안녕, 세상&quot;,&quot;헬로 월드&quot;,&quot;인사할 때&quot;,beginner,greeting&#10;..." style="width:100%;margin-top:10px;padding:12px;border-radius:12px;border:1px solid #e7d7c6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;background:#faf6ef;color:#23180f;"></textarea>
          <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap;">
            <button class="btn secondary" type="button" id="csvPasteApply">이 텍스트로 미리보기</button>
            <button class="btn ghost" type="button" id="csvPasteClear">비우기</button>
          </div>
        </details>
        <div id="csvPreview" style="margin-top:4px;color:#6b5b4b;font-size:13px"></div>
        <div class="actions">
          <button class="btn secondary" type="button" id="csvCancel">취소</button>
          <button class="btn" type="button" id="csvUpload" disabled>업로드</button>
        </div>
      </div>
    </dialog>
  `;
  const scripts = `<script>
    (function () {
      const TRACK = '${safeTrack}';
      const LANG = '${safeLang}';
      const $ = (id) => document.getElementById(id);
      const params = new URLSearchParams(location.search);
      const state = {
        q: params.get('q') || '',
        page: parseInt(params.get('page') || '1', 10),
        limit: 50,
      };
      $('q').value = state.q;
      function langQs() { return 'lang=' + encodeURIComponent(LANG); }

      const dlg = $('editDlg');
      const csvDlg = $('csvDlg');

      function pillFor(active) { return active ? window.pill('on', 'ok') : window.pill('off', 'muted'); }

      async function load() {
        const qs = new URLSearchParams({
          track: TRACK,
          lang: LANG,
          page: String(state.page),
          limit: String(state.limit),
        });
        if (state.q) qs.set('q', state.q);
        const urlQs = new URLSearchParams({ lang: LANG });
        if (state.q) urlQs.set('q', state.q);
        history.replaceState(
          null,
          '',
          '/backstage/content/' + TRACK + '?' + urlQs.toString(),
        );
        const r = await window.adminFetch('/api/admin/sentences?' + qs.toString());
        const d = await r.json();
        $('total').textContent = '총 ' + d.total + '개';
        $('rows').innerHTML = d.items.map((s) => (
          '<tr class="clickable" data-id="' + s.id + '">' +
            '<td><div style="font-weight:700">' + escapeText(s.text) + '</div>' + (s.pronunciation ? '<div style="color:#6b5b4b;font-size:12px">' + escapeText(s.pronunciation) + '</div>' : '') + '</td>' +
            '<td><div>' + escapeText(s.translation) + '</div>' + (s.situation ? '<div style="color:#6b5b4b;font-size:12px">💬 ' + escapeText(s.situation) + '</div>' : '') + '</td>' +
            '<td>' + window.pill(s.difficulty || '-', 'muted') + '</td>' +
            '<td>' + pillFor(s.isActive) + '</td>' +
            '<td style="text-align:right"><button class="btn ghost" data-id="' + s.id + '">편집</button></td>' +
          '</tr>'
        )).join('') || '<tr><td colspan="5" class="empty">아직 문장이 없어요. "+ 새 문장" 또는 CSV로 추가해 보세요.</td></tr>';

        $('rows').querySelectorAll('button[data-id]').forEach((b) => {
          b.addEventListener('click', (e) => { e.stopPropagation(); openEdit(b.dataset.id); });
        });
        $('rows').querySelectorAll('tr[data-id]').forEach((t) => {
          t.addEventListener('click', () => openEdit(t.dataset.id));
        });

        $('pageInfo').textContent = state.page + ' / ' + d.totalPages;
        $('prev').disabled = state.page <= 1;
        $('next').disabled = state.page >= d.totalPages;
      }

      function escapeText(s) { return (s || '').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

      function setForm(values) {
        const f = $('editForm');
        f.elements.id.value = values.id ?? '';
        f.elements.text.value = values.text ?? '';
        f.elements.translation.value = values.translation ?? '';
        f.elements.pronunciation.value = values.pronunciation ?? '';
        f.elements.situation.value = values.situation ?? '';
        f.elements.difficulty.value = values.difficulty ?? 'beginner';
        f.elements.category.value = values.category ?? '';
        f.elements.track.value = values.track ?? TRACK;
        f.elements.isActive.value = (values.isActive ?? true) ? 'true' : 'false';
      }

      function openAdd() {
        $('dlgTitle').textContent = '새 문장';
        $('dlgDeactivate').style.display = 'none';
        $('dlgHardDelete').style.display = 'none';
        setForm({ track: TRACK, difficulty: 'beginner', isActive: true });
        dlg.showModal();
      }
      async function openEdit(id) {
        const r = await window.adminFetch('/api/admin/sentences/' + id);
        const s = await r.json();
        $('dlgTitle').textContent = '문장 편집 #' + id;
        $('dlgDeactivate').style.display = (s.isActive === false) ? 'none' : 'inline-block';
        $('dlgHardDelete').style.display = 'inline-block';
        setForm(s);
        dlg.showModal();
      }

      $('addBtn').addEventListener('click', openAdd);
      $('dlgCancel').addEventListener('click', () => dlg.close());

      $('editForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = $('editForm');
        const id = f.elements.id.value;
        const body = {
          text: f.elements.text.value,
          translation: f.elements.translation.value,
          pronunciation: f.elements.pronunciation.value || null,
          situation: f.elements.situation.value || null,
          difficulty: f.elements.difficulty.value,
          category: f.elements.category.value || null,
          track: f.elements.track.value,
          languageCode: LANG, // 신규 row 한정 — update 시 무시됨
          isActive: f.elements.isActive.value === 'true',
        };
        const url = id ? '/api/admin/sentences/' + id : '/api/admin/sentences';
        const method = id ? 'PATCH' : 'POST';
        await window.adminFetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        dlg.close();
        load();
      });
      $('dlgDeactivate').addEventListener('click', async () => {
        const id = $('editForm').elements.id.value;
        if (!id) return;
        if (!confirm('이 문장을 비활성화할까요?\\n앱 회전에선 빠지지만 기존 학습 기록은 그대로 유지됩니다.')) return;
        await window.adminFetch('/api/admin/sentences/' + id, { method: 'DELETE' });
        dlg.close();
        load();
      });
      $('dlgHardDelete').addEventListener('click', async () => {
        const id = $('editForm').elements.id.value;
        if (!id) return;
        const text = $('editForm').elements.text.value || '';
        const sample = text.slice(0, 60) + (text.length > 60 ? '…' : '');
        if (!confirm('⚠ 완전 삭제: 이 문장과 함께 모든 유저의 할당 기록·SRS 진도가 함께 삭제됩니다. 되돌릴 수 없어요.\\n\\n"' + sample + '"\\n\\n정말 삭제할까요?')) return;
        if (!confirm('정말입니까? 한 번 더 확인합니다. 학습 기록까지 모두 사라집니다.')) return;
        await window.adminFetch('/api/admin/sentences/' + id + '?hard=true', { method: 'DELETE' });
        dlg.close();
        load();
      });

      // CSV
      let csvParsed = null;
      const AI_PROMPT_TEMPLATE = ${JSON.stringify(aiPromptText)};
      function refreshAiPrompt() {
        const n = ($('aiN').value || '').trim() || '20';
        const topicRaw = ($('aiTopic').value || '').trim();
        const topic = topicRaw || '(자유 — 트랙 가이드만 따라가도 됨)';
        $('aiPrompt').value = AI_PROMPT_TEMPLATE
          .replaceAll('{N}', n)
          .replaceAll('{주제}', topic);
      }
      $('aiN').addEventListener('input', refreshAiPrompt);
      $('aiTopic').addEventListener('input', refreshAiPrompt);

      $('csvBtn').addEventListener('click', () => {
        $('csvFile').value = '';
        $('csvPreview').textContent = '';
        $('csvUpload').disabled = true;
        csvParsed = null;
        refreshAiPrompt();
        $('aiCopied').style.display = 'none';
        csvDlg.showModal();
      });
      $('aiCopy').addEventListener('click', async () => {
        refreshAiPrompt();
        const ta = $('aiPrompt');
        ta.select();
        try {
          await navigator.clipboard.writeText(ta.value);
        } catch {
          document.execCommand('copy');
        }
        $('aiCopied').style.display = 'inline';
        setTimeout(() => { $('aiCopied').style.display = 'none'; }, 1800);
      });
      $('csvCancel').addEventListener('click', () => csvDlg.close());
      $('csvSample').addEventListener('click', () => {
        const sample =
          'text,translation,pronunciation,situation,difficulty,category,words\\n' +
          '"Where is the bus stop?","버스 정류장이 어디에 있나요?","웨어 이즈 더 버스 스탑","버스 정류장 위치를 물을 때",beginner,travel,"[{""w"":""where"",""m"":""어디""},{""w"":""bus"",""m"":""버스""},{""w"":""stop"",""m"":""정류장""}]"\\n' +
          '"It\\'s a piece of cake.","식은 죽 먹기야.","잇츠 어 피스 오브 케익","쉽다고 말할 때",intermediate,idiom,"[{""w"":""piece"",""m"":""조각""},{""w"":""cake"",""m"":""케이크""}]"\\n' +
          '"He said ""Hi"".","그가 ""안녕"" 이라고 했다.","히 세드 하이","따옴표 이스케이프 예시",beginner,quote,"[{""w"":""said"",""m"":""말했다""}]"\\n';
        // UTF-8 BOM so Excel opens it correctly on Windows.
        const blob = new Blob(['\\uFEFF' + sample], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'lingoloop-sentences-${safeTrack}.csv';
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 200);
      });
      function applyCsvText(text, sourceLabel) {
        try {
          csvParsed = parseCsv(sanitizeAiCsv(text));
          renderPreviewWithValidation(csvParsed, sourceLabel);
        } catch (err) {
          $('csvPreview').innerHTML = '<div style="padding:10px;border-radius:10px;background:#fde6e6;color:#c54c4c;">❌ 파싱 실패: ' + escapeText(err.message) + '</div>';
          $('csvUpload').disabled = true;
        }
      }

      function validateRows(rows) {
        const errors = [];
        const warnings = [];
        if (!rows || rows.length === 0) {
          errors.push('파싱된 행이 0건입니다. 헤더(첫 줄)와 데이터 형식을 확인하세요.');
          return { errors, warnings };
        }
        if (rows.length > 1000) {
          errors.push('한 번에 1000행을 초과합니다. 파일을 나눠서 올려주세요.');
        }

        const validDiff = new Set(['beginner', 'intermediate', 'advanced']);
        const seen = new Map(); // text → first index
        let blankRequired = 0;

        rows.forEach((r, i) => {
          const idx = i + 1;

          // Required fields
          if (!r.text || !r.text.trim()) { warnings.push('#' + idx + ' text 비어 있음 (서버에서 이 행은 오류로 카운트됩니다)'); blankRequired++; return; }
          if (!r.translation || !r.translation.trim()) { warnings.push('#' + idx + ' translation 비어 있음'); blankRequired++; }

          // Duplicate within batch
          const t = r.text.trim();
          if (seen.has(t)) warnings.push('#' + idx + ' 같은 배치에 중복: "' + t.slice(0, 40) + '"');
          else seen.set(t, idx);

          // difficulty enum
          if (r.difficulty && !validDiff.has(String(r.difficulty).toLowerCase())) {
            warnings.push('#' + idx + ' difficulty="' + r.difficulty + '" 유효값 아님 (beginner로 폴백)');
          }

          // pronunciation should be Hangul
          if (r.pronunciation && /[a-zA-Z]/.test(r.pronunciation)) {
            warnings.push('#' + idx + ' pronunciation에 영문자 포함: "' + r.pronunciation.slice(0, 40) + '"');
          }

          // category should be English lowercase tag
          if (r.category && /[\\uAC00-\\uD7A3]/.test(r.category)) {
            warnings.push('#' + idx + ' category가 한글입니다: "' + r.category + '" (영어 소문자 권장)');
          }
          if (r.category && r.category !== r.category.toLowerCase()) {
            warnings.push('#' + idx + ' category 대소문자 섞임: "' + r.category + '"');
          }

          // text length sanity
          const wc = (r.text.match(/\\S+/g) || []).length;
          if (wc < 3) warnings.push('#' + idx + ' text가 ' + wc + '단어로 너무 짧음');
          if (wc > 30) warnings.push('#' + idx + ' text가 ' + wc + '단어로 김 (학습용 적합성 확인)');

          // situation sanity
          if (r.situation !== undefined && r.situation.trim().length > 0 && r.situation.trim().length < 4) {
            warnings.push('#' + idx + ' situation이 너무 짧음 (' + r.situation.trim().length + '자)');
          }

          // translation looks like English (probably swapped)
          if (r.translation && !/[\\uAC00-\\uD7A3]/.test(r.translation) && /[a-zA-Z]/.test(r.translation)) {
            warnings.push('#' + idx + ' translation에 한글이 없습니다: "' + r.translation.slice(0, 40) + '" (translation 자리에 영어가 들어간 듯)');
          }

          // markdown fence leak
          if (/\`\`\`/.test(r.text || '') || /\`\`\`/.test(r.translation || '')) {
            warnings.push('#' + idx + ' 마크다운 펜스(\`\`\`)가 셀 안에 들어있어요');
          }

          // words JSON
          if (r.words && String(r.words).trim()) {
            try {
              const arr = JSON.parse(r.words);
              if (!Array.isArray(arr)) {
                warnings.push('#' + idx + ' words가 배열이 아님');
              } else if (arr.length === 0) {
                // empty array is allowed
              } else {
                arr.forEach((w, j) => {
                  if (!w || typeof w !== 'object') {
                    warnings.push('#' + idx + '.words[' + j + '] 객체 아님');
                    return;
                  }
                  const ww = w.w || w.word;
                  const mm = w.m || w.meaning;
                  if (!ww || !String(ww).trim()) warnings.push('#' + idx + '.words[' + j + '] w(단어) 비어 있음');
                  if (!mm || !String(mm).trim()) warnings.push('#' + idx + '.words[' + j + '] m(뜻) 비어 있음');
                  if (mm && !/[\\uAC00-\\uD7A3]/.test(String(mm))) {
                    warnings.push('#' + idx + '.words[' + j + '] m="' + mm + '"에 한글이 없음');
                  }
                });
              }
            } catch (e) {
              warnings.push('#' + idx + ' words JSON 파싱 실패');
            }
          } else {
            // missing words isn't fatal, just nudge
            warnings.push('#' + idx + ' words가 비어 있음 (단어 카드 없이 등록됩니다)');
          }
        });

        // Catastrophic mis-parse heuristic
        if (blankRequired > rows.length * 0.5) {
          errors.unshift('필수 컬럼이 비어 있는 행이 ' + blankRequired + '개 (전체의 ' + Math.round(blankRequired/rows.length*100) + '%). 헤더 또는 콤마/따옴표 깨짐 가능성 — 다시 확인해주세요.');
        }
        return { errors, warnings };
      }

      function renderPreviewWithValidation(rows, sourceLabel) {
        const v = validateRows(rows);
        const parts = [];
        const head = (sourceLabel ? '<span style="color:#2f8f5b">' + sourceLabel + '</span> · ' : '') +
          '<strong>' + rows.length + '행</strong> 파싱됨' +
          (rows[0]?.text ? ' · 미리보기: <code>' + escapeText(rows[0].text.slice(0, 60)) + '</code>' : '');
        parts.push('<div>' + head + '</div>');

        if (v.errors.length) {
          parts.push('<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#fde6e6;color:#c54c4c;font-size:13px;">' +
            '<div style="font-weight:800;margin-bottom:4px;">❌ 에러 ' + v.errors.length + '건 · 업로드 차단됨</div>' +
            v.errors.slice(0, 10).map((e) => '· ' + escapeText(e)).join('<br>') +
            (v.errors.length > 10 ? '<br>… 외 ' + (v.errors.length - 10) + '건' : '') +
            '</div>');
        }
        if (v.warnings.length) {
          parts.push('<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff3da;color:#a07c1a;font-size:13px;">' +
            '<div style="font-weight:800;margin-bottom:4px;">⚠ 경고 ' + v.warnings.length + '건 · 업로드는 가능하지만 한 번 더 검토 권장</div>' +
            v.warnings.slice(0, 20).map((w) => '· ' + escapeText(w)).join('<br>') +
            (v.warnings.length > 20 ? '<br>… 외 ' + (v.warnings.length - 20) + '건' : '') +
            '</div>');
        }
        if (!v.errors.length && !v.warnings.length) {
          parts.push('<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#e8f5ed;color:#2f8f5b;font-size:13px;font-weight:700;">✅ 검증 통과 · 그대로 업로드하세요</div>');
        }

        $('csvPreview').innerHTML = parts.join('');
        $('csvUpload').disabled = rows.length === 0 || v.errors.length > 0;
      }
      $('csvFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        applyCsvText(text, '파일 ' + file.name);
      });
      $('csvPasteApply').addEventListener('click', () => {
        const raw = $('csvPaste').value || '';
        if (!raw.trim()) {
          $('csvPreview').textContent = '붙여넣은 텍스트가 비어 있어요.';
          $('csvUpload').disabled = true;
          return;
        }
        applyCsvText(raw, '붙여넣기 텍스트');
      });
      $('csvPasteClear').addEventListener('click', () => {
        $('csvPaste').value = '';
        $('csvPreview').textContent = '';
        $('csvUpload').disabled = true;
        csvParsed = null;
      });

      /** Clean common AI noise before passing to the CSV parser. */
      function sanitizeAiCsv(text) {
        let s = String(text || '');
        // Strip markdown code fences (triple backticks, optional language).
        s = s.replace(/\`\`\`[a-zA-Z]*\\n?/g, '').replace(/\`\`\`/g, '');
        // Normalise line endings.
        s = s.replace(/\\r\\n?/g, '\\n');
        // Replace smart quotes with straight quotes.
        s = s.replace(/[\\u201c\\u201d\\u2033]/g, '"').replace(/[\\u2018\\u2019\\u2032]/g, "'");
        // Find the header line (case-insensitive); skip any prose before it.
        const lower = s.toLowerCase();
        const hIdx = lower.indexOf('text,translation');
        if (hIdx > 0) s = s.slice(hIdx);
        // Strip leading numbered prefixes per line ("1. ", "1) ", "- ", "* ").
        s = s.split('\\n').map((line) =>
          line.replace(/^\\s*(?:\\d+[\\.\\)]|[-*])\\s+/, '')
        ).join('\\n');
        return s;
      }
      $('csvUpload').addEventListener('click', async () => {
        if (!csvParsed) return;
        $('csvUpload').disabled = true;
        $('csvPreview').textContent = '업로드 중…';
        const r = await window.adminFetch('/api/admin/sentences/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            track: TRACK,
            languageCode: LANG,
            rows: csvParsed,
          }),
        });
        const result = await r.json();
        $('csvPreview').innerHTML = '✅ 삽입 <strong>' + result.inserted + '</strong> · 건너뜀 ' + result.skipped + ' · 오류 ' + result.errors;
        setTimeout(() => { csvDlg.close(); load(); }, 1200);
      });

      function parseCsv(input) {
        // Single-pass state machine. Splits the input into rows of cells,
        // respecting quoted fields (commas / newlines inside "..." stay
        // inside the cell) and the standard "" → " escape. Previous
        // version did its escaping in two phases which caused the JSON in
        // the words column to be decoded twice and the comma-split to
        // misalign rows that contained commas inside quoted text.
        const rows = [];
        let currentRow = [];
        let cell = '';
        let inQ = false;
        for (let i = 0; i < input.length; i++) {
          const c = input[i];
          if (inQ) {
            if (c === '"') {
              if (input[i + 1] === '"') { cell += '"'; i++; }
              else inQ = false;
            } else { cell += c; }
          } else {
            if (c === '"') { inQ = true; }
            else if (c === ',') { currentRow.push(cell); cell = ''; }
            else if (c === '\\n') {
              currentRow.push(cell); cell = '';
              rows.push(currentRow); currentRow = [];
            }
            else if (c === '\\r') { /* skip */ }
            else { cell += c; }
          }
        }
        if (cell.length || currentRow.length) {
          currentRow.push(cell);
          rows.push(currentRow);
        }
        if (rows.length === 0) return [];

        const header = rows[0].map((h) => h.trim().toLowerCase());
        const idxOf = (name) => header.indexOf(name);
        const out = [];
        for (let i = 1; i < rows.length; i++) {
          const cells = rows[i];
          if (cells.length === 1 && cells[0] === '') continue;
          const obj = {
            text: cells[idxOf('text')]?.trim() || '',
            translation: cells[idxOf('translation')]?.trim() || '',
            pronunciation: idxOf('pronunciation') >= 0 ? cells[idxOf('pronunciation')]?.trim() : '',
            situation: idxOf('situation') >= 0 ? cells[idxOf('situation')]?.trim() : '',
            difficulty: idxOf('difficulty') >= 0 ? cells[idxOf('difficulty')]?.trim() : '',
            category: idxOf('category') >= 0 ? cells[idxOf('category')]?.trim() : '',
            words: idxOf('words') >= 0 ? cells[idxOf('words')]?.trim() : '',
          };
          if (obj.text || obj.translation) out.push(obj);
        }
        return out;
      }

      let t;
      function bounce() { clearTimeout(t); t = setTimeout(() => { state.page = 1; load(); }, 200); }
      $('q').addEventListener('input', (e) => { state.q = e.target.value; bounce(); });
      $('prev').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
      $('next').addEventListener('click', () => { state.page++; load(); });
      load();
    })();
  </script>`;
  return { content, scripts };
}

export function renderPushesList(): PageBody {
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · 푸시 히스토리</div>
        <h1>푸시 히스토리</h1>
      </div>
      <div class="actions"><button class="btn secondary" id="refresh">새로고침</button></div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="left">
          <input id="q" placeholder="유저 이메일/닉네임" />
          <select id="type"><option value="">전체 타입</option><option value="sentence">sentence</option><option value="quiz">quiz</option><option value="widget_refresh">widget_refresh</option></select>
          <select id="status"><option value="">전체 상태</option><option value="sent">sent</option><option value="failed">failed</option><option value="pending">pending</option></select>
        </div>
        <div class="info" id="total"></div>
      </div>
      <div class="scroll">
        <table>
          <thead><tr><th>시간</th><th>유저</th><th>타입</th><th>제목</th><th>내용</th><th>상태</th><th>탭</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div class="pager">
        <button id="prev">←</button>
        <span class="info" id="pageInfo"></span>
        <button id="next">→</button>
      </div>
    </div>
  `;
  const scripts = `<script>
    (function () {
      const params = new URLSearchParams(location.search);
      const state = {
        q: params.get('q') || '',
        type: params.get('type') || '',
        status: params.get('status') || '',
        page: parseInt(params.get('page') || '1', 10),
        limit: 50,
      };
      const $ = (id) => document.getElementById(id);
      $('q').value = state.q; $('type').value = state.type; $('status').value = state.status;

      async function load() {
        const qs = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
        if (state.q) qs.set('q', state.q);
        if (state.type) qs.set('type', state.type);
        if (state.status) qs.set('status', state.status);
        history.replaceState(null, '', '/backstage/pushes?' + qs.toString());

        const r = await window.adminFetch('/api/admin/pushes?' + qs.toString());
        const d = await r.json();
        $('total').textContent = '총 ' + d.total + '건';
        const esc = (s) => String(s == null ? '' : s)
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        const clip = (s, n) => {
          const t = String(s == null ? '' : s);
          return t.length > n ? t.slice(0, n) + '…' : t;
        };
        $('rows').innerHTML = d.items.map((p) => (
          '<tr class="clickable" onclick="location.href=\\'/backstage/users/' + p.userId + '\\'">' +
            '<td>' + p.sentAt + '</td>' +
            '<td>' + p.userLabel + '</td>' +
            '<td>' + window.pill(p.pushType) + '</td>' +
            '<td style="max-width:200px">' + esc(clip(p.title, 50)) + '</td>' +
            '<td style="max-width:280px">' + esc(clip(p.body, 80)) + '</td>' +
            '<td>' + window.pill(p.status, p.status === 'sent' ? 'ok' : p.status === 'failed' ? 'fail' : 'muted') + '</td>' +
            '<td>' + (p.tappedAt ? window.pill('tapped', 'ok') : '-') + '</td>' +
          '</tr>'
        )).join('') || '<tr><td colspan="7" class="empty">조건에 맞는 푸시가 없어요.</td></tr>';
        $('pageInfo').textContent = state.page + ' / ' + d.totalPages;
        $('prev').disabled = state.page <= 1;
        $('next').disabled = state.page >= d.totalPages;
      }

      let t;
      function bounce() { clearTimeout(t); t = setTimeout(() => { state.page = 1; load(); }, 200); }
      $('q').addEventListener('input', (e) => { state.q = e.target.value; bounce(); });
      $('type').addEventListener('change', (e) => { state.type = e.target.value; state.page = 1; load(); });
      $('status').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
      $('prev').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
      $('next').addEventListener('click', () => { state.page++; load(); });
      $('refresh').addEventListener('click', load);
      load();
    })();
  </script>`;
  return { content, scripts };
}

export function renderInquiriesList(): PageBody {
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · 문의</div>
        <h1>문의</h1>
      </div>
      <div class="actions"><button class="btn secondary" id="refresh">새로고침</button></div>
    </div>

    <div class="card">
      <div class="toolbar">
        <div class="left">
          <input id="q" placeholder="이메일/닉네임/내용 검색" />
          <select id="category"><option value="">전체 유형</option><option value="subscription">구독</option><option value="general">일반</option></select>
          <select id="status"><option value="">전체 상태</option><option value="open">open</option><option value="closed">closed</option></select>
        </div>
        <div class="info" id="total"></div>
      </div>
      <div class="scroll">
        <table>
          <thead><tr><th>시간</th><th>유저</th><th>유형</th><th>상태</th><th>IP</th><th>디바이스</th><th>이메일</th><th>내용</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div class="pager">
        <button id="prev">←</button>
        <span class="info" id="pageInfo"></span>
        <button id="next">→</button>
      </div>
    </div>
  `;
  const scripts = `<script>
    (function () {
      const params = new URLSearchParams(location.search);
      const state = {
        q: params.get('q') || '',
        category: params.get('category') || '',
        status: params.get('status') || '',
        page: parseInt(params.get('page') || '1', 10),
        limit: 50,
      };
      const $ = (id) => document.getElementById(id);
      $('q').value = state.q; $('category').value = state.category; $('status').value = state.status;
      function kv(obj) {
        return '<dl class="detail-kv">' + Object.entries(obj).map(([k, v]) =>
          '<dt>' + window.escapeHtml(k) + '</dt><dd>' + window.escapeHtml(v == null || v === '' ? '-' : v) + '</dd>'
        ).join('') + '</dl>';
      }
      function panel(title, body) {
        return '<div class="detail-panel"><h3>' + title + '</h3>' + body + '</div>';
      }
      function renderDetail(i) {
        const user = i.user || {};
        const sub = i.subscription || {};
        const settings = i.settings || {};
        const stats = i.stats || {};
        const devices = i.devices || [];
        const deviceBody = devices.length
          ? devices.map((d) => kv({
              id: d.id,
              platform: d.platform,
              active: d.isActive ? 'true' : 'false',
              token: d.token,
              created: d.createdAt,
              updated: d.updatedAt,
            })).join('<hr style="border:0;border-top:1px solid #f0e4d8;margin:10px 0">')
          : '<div class="empty" style="padding:8px">디바이스 없음</div>';

        // 답변 영역: 이미 답변되었으면 history + 추가/수정 폼,
        // 미답변이면 새 답변 폼만. 모든 폼은 inquiry id로 namespace
        // 해서 같은 페이지의 다른 문의와 충돌 안 함.
        const replyHistory = i.reply
          ? '<div style="background:#f8f3e8; padding:12px; border-radius:8px; margin-bottom:12px; border-left:3px solid #3aa75a">' +
              '<div style="font-size:12px; color:#6b5b4b; margin-bottom:6px">답변 ' + i.repliedAt + ' · ' + (i.repliedBy || '-') + (i.userReadAt ? ' · <span style="color:#3aa75a">사용자 확인 ' + i.userReadAt + '</span>' : ' · <span style="color:#b04a3a">사용자 미확인</span>') + '</div>' +
              '<div style="white-space:pre-wrap">' + window.escapeHtml(i.reply) + '</div>' +
            '</div>'
          : '';
        const replyBox =
          '<div style="background:#fff; padding:12px; border-radius:8px; border:1px solid #d3c5b1">' +
            replyHistory +
            '<textarea id="replyText_' + i.id + '" rows="4" style="width:100%; padding:8px; border:1px solid #d3c5b1; border-radius:6px; resize:vertical" placeholder="' + (i.reply ? '답변 수정/추가 (보내면 사용자에게 푸시 알림)' : '답변 작성 (보내면 사용자에게 푸시 알림)') + '"></textarea>' +
            '<div style="display:flex; gap:8px; margin-top:8px; align-items:center">' +
              '<button class="btn primary" type="button" data-reply-id="' + i.id + '">답변 보내기 (푸시 발송)</button>' +
              '<span class="form-status reply-status" id="replyStatus_' + i.id + '"></span>' +
            '</div>' +
          '</div>';

        return '<div class="detail-box">' +
          panel('답변', replyBox) +
          panel('문의 접속 정보', kv({ ip: i.ipAddress, userAgent: i.userAgent })) +
          panel('유저', kv({
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            provider: user.provider,
            active: user.isActive == null ? null : String(user.isActive),
            timezone: user.timezone,
            track: user.learningTrack,
            dailyGoal: user.dailyGoal,
            tier: user.subscriptionTier,
            joined: user.createdAt,
            deletedAt: user.deletedAt,
          })) +
          panel('구독', i.subscription ? kv({
            store: sub.store,
            product: sub.productId,
            plan: sub.plan,
            active: String(sub.isActive),
            autoRenew: String(sub.autoRenew),
            env: sub.environment,
            trial: String(sub.inTrial),
            expires: sub.expiresAt,
            revoked: sub.revokedAt,
          }) : '<div class="empty" style="padding:8px">구독 정보 없음</div>') +
          panel('알림 설정', i.settings ? kv({
            enabled: String(settings.isEnabled),
            frequency: settings.frequencyMinutes + '분',
            activeTime: settings.activeStartTime + ' ~ ' + settings.activeEndTime,
            timezone: settings.timezone,
            wordRatio: settings.wordPushRatio,
            nextPushAt: settings.nextPushAt,
            updated: settings.updatedAt,
          }) : '<div class="empty" style="padding:8px">알림 설정 없음</div>') +
          panel('학습/퀴즈', kv({
            assignments: (stats.completedAssignments || 0) + ' / ' + (stats.totalAssignments || 0),
            quizAttempts: stats.quizAttempts || 0,
            quizCorrect: stats.quizCorrect || 0,
            quizAccuracy: (stats.quizAccuracy || 0) + '%',
          })) +
          panel('디바이스', deviceBody) +
        '</div>';
      }

      async function load() {
        const qs = new URLSearchParams({ page: String(state.page), limit: String(state.limit) });
        if (state.q) qs.set('q', state.q);
        if (state.category) qs.set('category', state.category);
        if (state.status) qs.set('status', state.status);
        history.replaceState(null, '', '/backstage/inquiries?' + qs.toString());

        const r = await window.adminFetch('/api/admin/inquiries?' + qs.toString());
        const d = await r.json();
        $('total').textContent = '총 ' + d.total + '건';
        $('rows').innerHTML = d.items.map((i, idx) => (
          '<tr class="clickable inquiry-row" data-index="' + idx + '">' +
            '<td>' + i.createdAt + '</td>' +
            '<td>' + window.escapeHtml(i.userLabel || '-') + '</td>' +
            '<td>' + window.pill(i.category === 'subscription' ? '구독' : i.category === 'word_request' ? '단어요청' : '일반', i.category === 'subscription' ? 'primary' : i.category === 'word_request' ? 'warn' : 'muted') + '</td>' +
            '<td>' + window.pill(i.status, i.status === 'open' ? 'ok' : 'muted') + '</td>' +
            '<td>' + window.escapeHtml(i.ipAddress || '-') + '</td>' +
            '<td>' + (i.devices ? i.devices.length : 0) + '</td>' +
            '<td>' + window.escapeHtml(i.email || '-') + '</td>' +
            '<td style="white-space:pre-wrap; min-width:280px">' + window.escapeHtml(i.message || '') + '</td>' +
          '</tr>' +
          '<tr class="detail-row" data-detail="' + idx + '" style="display:none"><td colspan="8">' +
            (i.userId ? '<div style="margin-bottom:10px"><a class="btn secondary" href="/backstage/users/' + encodeURIComponent(i.userId) + '">유저 상세 열기</a></div>' : '') +
            renderDetail(i) +
          '</td></tr>'
        )).join('') || '<tr><td colspan="8" class="empty">문의가 없어요.</td></tr>';
        document.querySelectorAll('.inquiry-row').forEach((row) => {
          row.addEventListener('click', (e) => {
            // textarea / button 내부 클릭은 토글 무시 — 안 그러면
            // 입력 중에 카드가 접혀버림.
            if (e.target.closest('textarea, button, .reply-status, a')) return;
            const detail = document.querySelector('[data-detail="' + row.dataset.index + '"]');
            if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
          });
        });
        // 답변 보내기 버튼들 — data-reply-id로 inquiry 매칭.
        document.querySelectorAll('button[data-reply-id]').forEach((btn) => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const id = btn.dataset.replyId;
            const textarea = document.getElementById('replyText_' + id);
            const status = document.getElementById('replyStatus_' + id);
            const reply = (textarea.value || '').trim();
            if (!reply) {
              status.textContent = '답변 내용을 입력해주세요.';
              status.style.color = '#b04a3a';
              return;
            }
            if (!confirm('답변을 보내면 사용자에게 푸시 알림이 전송됩니다. 계속할까요?')) return;
            btn.disabled = true;
            status.textContent = '전송 중...';
            status.style.color = '#6b5b4b';
            try {
              const r = await window.adminFetch('/api/admin/inquiries/' + id + '/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reply }),
              });
              if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                status.textContent = err.message || ('실패: HTTP ' + r.status);
                status.style.color = '#b04a3a';
                btn.disabled = false;
                return;
              }
              status.textContent = '답변 전송 완료. 새로고침 중...';
              status.style.color = '#3aa75a';
              setTimeout(load, 600);
            } catch (err) {
              status.textContent = '네트워크 오류: ' + err.message;
              status.style.color = '#b04a3a';
              btn.disabled = false;
            }
          });
        });
        $('pageInfo').textContent = state.page + ' / ' + d.totalPages;
        $('prev').disabled = state.page <= 1;
        $('next').disabled = state.page >= d.totalPages;
      }

      let t;
      function bounce() { clearTimeout(t); t = setTimeout(() => { state.page = 1; load(); }, 200); }
      $('q').addEventListener('input', (e) => { state.q = e.target.value; bounce(); });
      $('category').addEventListener('change', (e) => { state.category = e.target.value; state.page = 1; load(); });
      $('status').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
      $('prev').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
      $('next').addEventListener('click', () => { state.page++; load(); });
      $('refresh').addEventListener('click', load);
      load();
    })();
  </script>`;
  return { content, scripts };
}

// ──────────────────────────────────────────────────────────────────────
// Subscriptions / revenue
// ──────────────────────────────────────────────────────────────────────

export function renderSubscriptions(): PageBody {
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · 구독·매출</div>
        <h1>구독 / 매출</h1>
      </div>
      <div class="actions" style="display:flex; gap:8px; align-items:center;">
        <select id="envFilter" style="padding:6px 10px; border:1px solid #d3c5b1; border-radius:6px">
          <option value="production">프로덕션</option>
          <option value="sandbox">샌드박스</option>
          <option value="all">전체</option>
        </select>
        <a class="btn secondary" href="/backstage/subscriptions/verification">검증 로그 →</a>
      </div>
    </div>

    <div class="stats" id="kpi"></div>

    <div class="row cols-2" style="margin-top:18px;">
      <div class="card">
        <h2>결제 상품 설정</h2>
        <div class="sub">앱이 읽는 프리미엄 상품 ID와 스토어 메타 정보를 관리합니다.</div>
        <form id="billingConfigForm">
          <div class="form-grid">
            <div class="form-field full">
              <label for="premiumMonthlyProductId">Premium Monthly Product ID</label>
              <input id="premiumMonthlyProductId" name="premiumMonthlyProductId" autocomplete="off" />
            </div>
            <div class="toggle-field full">
              <input id="billingEnabled" name="billingEnabled" type="checkbox" />
              <label for="billingEnabled">빌링 사용</label>
            </div>
            <div class="form-field">
              <label for="iosProductGroupId">iOS Product Group ID</label>
              <input id="iosProductGroupId" name="iosProductGroupId" autocomplete="off" />
            </div>
            <div class="form-field">
              <label for="androidBasePlanId">Android Base Plan ID</label>
              <input id="androidBasePlanId" name="androidBasePlanId" autocomplete="off" />
            </div>
            <div class="form-field full">
              <label for="adminNote">Admin Note</label>
              <textarea id="adminNote" name="adminNote" rows="3"></textarea>
            </div>
          </div>
          <div class="form-actions">
            <button class="btn" type="submit" id="saveBillingConfig">설정 저장</button>
            <span class="form-status" id="billingConfigStatus">저장되었습니다.</span>
          </div>
        </form>
      </div>
      <div class="card">
        <h2>공개 설정 미리보기</h2>
        <div class="sub">앱의 /api/admin/app-config/public 응답값입니다.</div>
        <pre class="preview" id="publicConfigPreview">불러오는 중...</pre>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <h2>운영자 푸시 알림 수신</h2>
      <div class="sub">isAdmin=true 사용자(들)에게 어떤 이벤트가 발생했을 때 푸시를 보낼지 토글. 모든 운영자에게 공통 적용.</div>
      <div id="pushPrefsBox" style="margin-top:12px">불러오는 중...</div>
      <div class="form-actions" style="margin-top:12px">
        <button class="btn" type="button" id="savePushPrefs">저장</button>
        <span class="form-status" id="pushPrefsStatus"></span>
      </div>
    </div>

    <div class="row cols-2" style="margin-top:18px;">
      <div class="card">
        <h2>최근 30일 일별 활동</h2>
        <div class="sub">KST · 신규 / 갱신 / 환불 (stacked, subscription 단위 dedupe)</div>
        <!-- maintainAspectRatio:false makes Chart.js fill the parent box.
             A wrapper with explicit height keeps it from growing to fill
             whatever flex slot the layout grants. -->
        <div style="position: relative; height: 260px;">
          <canvas id="timelineChart"></canvas>
        </div>
      </div>
      <div class="card">
        <h2>활성 구독 분포</h2>
        <div class="sub">스토어별 (active=true 기준)</div>
        <table style="min-width:0"><tbody id="storeBreakdown"></tbody></table>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h2>최근 결제·구독 이벤트</h2>
      <div class="sub">최근 50건 · 환경 필터 반영</div>
      <div class="scroll">
        <table style="min-width:840px">
          <thead><tr><th>시간</th><th>유저</th><th>환경</th><th>출처</th><th>이벤트</th><th>결과</th><th>txn</th><th>비고</th></tr></thead>
          <tbody id="recentEvents"></tbody>
        </table>
      </div>
    </div>
  `;
  const scripts = `<script>
    (function () {
      let chart = null;
      const configForm = document.getElementById('billingConfigForm');
      const configStatus = document.getElementById('billingConfigStatus');
      const saveConfigButton = document.getElementById('saveBillingConfig');
      const publicConfigPreview = document.getElementById('publicConfigPreview');

      async function load(env) {
        const r = await window.adminFetch('/api/admin/subscriptions/dashboard?env=' + encodeURIComponent(env));
        const d = await r.json();

      const krw = (n) => n.toLocaleString('ko-KR') + '원';
      document.getElementById('kpi').innerHTML = [
        ['활성 프리미엄', d.kpi.activePremium, ''],
        ['무료 체험 중', d.kpi.inTrial, ''],
        ['이번 달 신규', d.kpi.newThisMonth, ''],
        ['이번 달 환불', d.kpi.refundsThisMonth, ''],
        ['추정 매출 (gross)', krw(d.kpi.grossRevenueKrw), ''],
        ['환불 차감', '-' + krw(d.kpi.refundedKrw), ''],
        ['추정 매출 (net)', krw(d.kpi.netRevenueKrw), '이번 달'],
      ].map(([k, v, sub]) =>
        '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="meta">' + sub + '</div>' : '') + '</div>'
      ).join('');

      const labels = d.timeline.map(t => t.day);
      if (chart) { chart.destroy(); }
      chart = new Chart(document.getElementById('timelineChart'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: '신규',  data: d.timeline.map(t => t.new),    backgroundColor: '#3aa75a' },
            { label: '갱신',  data: d.timeline.map(t => t.renew),  backgroundColor: '#3a7cd6' },
            { label: '환불',  data: d.timeline.map(t => t.refund), backgroundColor: '#b04a3a' },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, ticks: { autoSkip: true, maxRotation: 0 } },
            y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
          },
          plugins: { legend: { position: 'bottom' } },
        },
      });

      function row(k, v) { return '<tr><td style="color:#6b5b4b;font-size:12px;width:120px">' + k + '</td><td>' + v + '</td></tr>'; }
      document.getElementById('storeBreakdown').innerHTML = d.breakdownByStore.length
        ? d.breakdownByStore.map(b => row(b.store, b.count + '명')).join('')
        : '<tr><td class="empty">활성 구독 없음</td></tr>';

      const sourceLabel = {
        apple_verify: 'Apple 구매',
        play_verify: 'Play 구매',
        apple_webhook: 'Apple 알림',
        google_webhook: 'Google 알림',
        google_voided: 'Google 환불',
        sweep: '만료 sweep',
        lazy_downgrade: '지연 다운그레이드',
        admin_grant: '관리자 부여',
        admin_revoke: '관리자 회수',
      };
      const outcomeTone = (o) => o === 'applied' ? 'ok' : (o === 'skipped' ? 'muted' : 'fail');
      document.getElementById('recentEvents').innerHTML = d.recentEvents.length
        ? d.recentEvents.map(e => {
            const noteParts = [];
            if (e.outcomeReason) noteParts.push(e.outcomeReason);
            if (e.productId) noteParts.push(e.productId);
            const userCell = e.userId
              ? '<a href="/backstage/users/' + encodeURIComponent(e.userId) + '"><code style="font-size:11px">' + e.userId.slice(0, 8) + '…</code></a>'
              : '-';
            const envChip = e.environment === 'sandbox'
              ? window.pill('sandbox', 'warn')
              : (e.environment === 'production' ? window.pill('prod', 'ok') : '-');
            return '<tr>' +
              '<td>' + e.occurredAt + '</td>' +
              '<td>' + userCell + '</td>' +
              '<td>' + envChip + '</td>' +
              '<td>' + window.pill(sourceLabel[e.source] || e.source, e.source.startsWith('admin') ? 'primary' : 'muted') + '</td>' +
              '<td>' + (e.eventType || '-') + '</td>' +
              '<td>' + window.pill(e.outcome, outcomeTone(e.outcome)) + '</td>' +
              '<td>' + (e.txnIdTail ? '…' + e.txnIdTail : '-') + '</td>' +
              '<td style="color:#6b5b4b;font-size:12px">' + (noteParts.join(' · ') || '-') + '</td>' +
              '</tr>';
          }).join('')
        : '<tr><td colspan="8" class="empty">아직 이벤트가 없어요.</td></tr>';
      }

      async function loadConfig() {
        const [privateResponse, publicResponse] = await Promise.all([
          window.adminFetch('/api/admin/app-config'),
          window.adminFetch('/api/admin/app-config/public'),
        ]);
        const config = await privateResponse.json();
        const publicConfig = await publicResponse.json();
        configForm.premiumMonthlyProductId.value = config.premiumMonthlyProductId || '';
        configForm.billingEnabled.checked = !!config.billingEnabled;
        configForm.iosProductGroupId.value = config.iosProductGroupId || '';
        configForm.androidBasePlanId.value = config.androidBasePlanId || '';
        configForm.adminNote.value = config.adminNote || '';
        publicConfigPreview.textContent = JSON.stringify(publicConfig, null, 2);
      }

      configForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        configStatus.style.display = 'none';
        saveConfigButton.disabled = true;
        const payload = {
          premiumMonthlyProductId: configForm.premiumMonthlyProductId.value.trim(),
          billingEnabled: configForm.billingEnabled.checked,
          iosProductGroupId: configForm.iosProductGroupId.value.trim() || null,
          androidBasePlanId: configForm.androidBasePlanId.value.trim() || null,
          adminNote: configForm.adminNote.value.trim() || null,
        };
        const response = await window.adminFetch('/api/admin/app-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          saveConfigButton.disabled = false;
          alert('설정 저장에 실패했어요.');
          return;
        }
        await loadConfig();
        configStatus.style.display = 'inline';
        saveConfigButton.disabled = false;
      });

      // 운영자 푸시 토글 로딩 + 저장.
      const pushPrefsBox = document.getElementById('pushPrefsBox');
      const savePushPrefsBtn = document.getElementById('savePushPrefs');
      const pushPrefsStatus = document.getElementById('pushPrefsStatus');
      async function loadPushPrefs() {
        const r = await window.adminFetch('/api/admin/admin-push-prefs');
        const d = await r.json();
        // 누락 키 = 기본 true.
        pushPrefsBox.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">' +
          d.knownTypes.map((t) => {
            const enabled = d.prefs[t.key] !== false;
            return '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #e7d7c6;border-radius:10px;cursor:pointer;background:#fbf7f0">' +
              '<input type="checkbox" data-key="' + t.key + '"' + (enabled ? ' checked' : '') + ' />' +
              '<span style="font-weight:600">' + t.label + '</span>' +
            '</label>';
          }).join('') +
        '</div>';
      }
      savePushPrefsBtn.addEventListener('click', async () => {
        savePushPrefsBtn.disabled = true;
        pushPrefsStatus.textContent = '';
        const prefs = {};
        pushPrefsBox.querySelectorAll('input[type=checkbox][data-key]').forEach((el) => {
          prefs[el.dataset.key] = el.checked;
        });
        const r = await window.adminFetch('/api/admin/admin-push-prefs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefs }),
        });
        savePushPrefsBtn.disabled = false;
        pushPrefsStatus.textContent = r.ok ? '저장됨' : '실패';
      });

      const envSelect = document.getElementById('envFilter');
      envSelect.addEventListener('change', (e) => load(e.target.value));
      load(envSelect.value);
      loadConfig();
      loadPushPrefs();
    })();
  </script>`;
  return { content, scripts };
}

export function renderSubscriptionVerification(): PageBody {
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · <a href="/backstage/subscriptions">구독·매출</a> · 검증 로그</div>
        <h1>결제 검증 로그</h1>
      </div>
      <div class="actions">
        <a class="btn secondary" href="/backstage/subscriptions">← 대시보드</a>
      </div>
    </div>

    <div class="card">
      <h2>필터</h2>
      <div class="sub">기본은 outcome != applied. 모든 출처/결과를 보고 싶으면 전체 선택.</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:10px;">
        <select id="outcomeFilter" style="padding:6px 10px; border:1px solid #d3c5b1; border-radius:6px">
          <option value="">결과: 비-적용 전체</option>
          <option value="applied">applied</option>
          <option value="skipped">skipped</option>
          <option value="rejected">rejected</option>
          <option value="error">error</option>
        </select>
        <select id="sourceFilter" style="padding:6px 10px; border:1px solid #d3c5b1; border-radius:6px">
          <option value="">출처: 전체</option>
          <option value="apple_verify">apple_verify</option>
          <option value="play_verify">play_verify</option>
          <option value="apple_webhook">apple_webhook</option>
          <option value="google_webhook">google_webhook</option>
          <option value="google_voided">google_voided</option>
          <option value="sweep">sweep</option>
          <option value="lazy_downgrade">lazy_downgrade</option>
        </select>
        <button id="reload" class="btn primary" type="button">필터 적용</button>
        <span id="totalLabel" class="sub" style="margin-left:auto"></span>
      </div>
    </div>

    <div class="card" style="margin-top:18px;">
      <h2>이벤트</h2>
      <div class="scroll">
        <table style="min-width:920px">
          <thead><tr><th>시간</th><th>유저</th><th>출처</th><th>이벤트</th><th>결과</th><th>이유</th><th>txn</th><th>payload</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div style="display:flex; gap:8px; margin-top:12px;">
        <button id="prev" class="btn ghost" type="button" disabled>← 이전</button>
        <button id="next" class="btn ghost" type="button" disabled>다음 →</button>
        <span id="pageLabel" class="sub" style="margin-left:auto"></span>
      </div>
    </div>
  `;
  const scripts = `<script>
    (function () {
      let page = 1;
      const limit = 50;
      const $ = (id) => document.getElementById(id);

      const sourceLabel = {
        apple_verify: 'Apple 구매',
        play_verify: 'Play 구매',
        apple_webhook: 'Apple 알림',
        google_webhook: 'Google 알림',
        google_voided: 'Google 환불',
        sweep: '만료 sweep',
        lazy_downgrade: '지연 다운그레이드',
        admin_grant: '관리자 부여',
        admin_revoke: '관리자 회수',
      };
      const outcomeTone = (o) => o === 'applied' ? 'ok' : (o === 'skipped' ? 'muted' : 'fail');

      async function load() {
        const q = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if ($('outcomeFilter').value) q.set('outcome', $('outcomeFilter').value);
        if ($('sourceFilter').value)  q.set('source',  $('sourceFilter').value);
        const r = await window.adminFetch('/api/admin/subscriptions/verification?' + q.toString());
        const d = await r.json();
        $('totalLabel').textContent = '전체 ' + d.total + '건';
        $('rows').innerHTML = d.items.length
          ? d.items.map(e => {
              const userCell = e.userId
                ? '<a href="/backstage/users/' + encodeURIComponent(e.userId) + '"><code style="font-size:11px">' + e.userId.slice(0, 8) + '…</code></a>'
                : '-';
              const payloadStr = e.payload
                ? '<details><summary style="cursor:pointer; color:#6b5b4b">보기</summary><pre style="margin:6px 0 0 0; font-size:11px; max-width:380px; white-space:pre-wrap">' + JSON.stringify(e.payload, null, 2) + '</pre></details>'
                : '-';
              return '<tr>' +
                '<td>' + e.occurredAt + '</td>' +
                '<td>' + userCell + '</td>' +
                '<td>' + window.pill(sourceLabel[e.source] || e.source, 'muted') + '</td>' +
                '<td>' + (e.eventType || '-') + '</td>' +
                '<td>' + window.pill(e.outcome, outcomeTone(e.outcome)) + '</td>' +
                '<td style="color:#6b5b4b;font-size:12px">' + (e.outcomeReason || '-') + '</td>' +
                '<td>' + (e.txnIdTail ? '…' + e.txnIdTail : '-') + '</td>' +
                '<td>' + payloadStr + '</td>' +
                '</tr>';
            }).join('')
          : '<tr><td colspan="8" class="empty">조건에 맞는 이벤트가 없어요.</td></tr>';
        $('pageLabel').textContent = page + ' / ' + d.totalPages + ' (' + d.total + '건)';
        $('prev').disabled = page <= 1;
        $('next').disabled = page >= d.totalPages;
      }

      $('reload').addEventListener('click', () => { page = 1; load(); });
      $('prev').addEventListener('click', () => { if (page > 1) { page--; load(); } });
      $('next').addEventListener('click', () => { page++; load(); });
      load();
    })();
  </script>`;
  return { content, scripts };
}

/**
 * 단어 활용형(word forms) 관리 페이지. ll_words에서 distinct 단어를
 * 모아 ll_word_forms 커버리지와 함께 표시. "데이터 채우기"로 forms 미생성
 * 단어 N개를 뽑아 AI 프롬프트를 만들어주고, 응답 JSON을 다시 붙여넣어
 * 일괄 import. CSV 업로드와 같은 패턴이지만 데이터는 AI가 만들어주는 흐름.
 */
export function renderWordsList(): PageBody {
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · 단어</div>
        <h1>단어 활용형 사전</h1>
      </div>
      <div class="actions">
        <button class="btn secondary" id="importBtn">📥 JSON 붙여넣기</button>
        <button class="btn" id="batchBtn">✨ 데이터 채우기</button>
      </div>
    </div>

    <div class="card">
      <h2>현황</h2>
      <div class="sub">콘텐츠 카드(ll_words)에 등록된 단어 기준 · forms 채워졌는지 표시</div>
      <div class="toolbar">
        <div class="left">
          <input id="q" placeholder="단어 검색" />
          <select id="coverage">
            <option value="all">전체</option>
            <option value="missing" selected>forms 누락만</option>
            <option value="filled">forms 완료만</option>
          </select>
        </div>
        <div class="info" id="total"></div>
      </div>
      <div class="scroll">
        <table>
          <thead>
            <tr><th>단어</th><th>언어</th><th>품사</th><th>뜻</th><th>등장 횟수</th><th>상태</th><th></th></tr>
          </thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
      <div class="pager">
        <button id="prev">←</button>
        <span class="info" id="pageInfo"></span>
        <button id="next">→</button>
      </div>
    </div>

    <!-- 데이터 채우기 (배치) 모달 -->
    <dialog id="batchDlg">
      <div class="modal" style="max-width:880px">
        <h2>✨ 데이터 채우기</h2>
        <div class="sub" style="margin-bottom:10px">
          forms 미생성 단어를 한 번에 뽑아 AI 프롬프트를 만들어줍니다.
          ChatGPT/Claude에 프롬프트 전체를 복사·붙여넣기 → 응답 JSON을
          아래 [📥 JSON 붙여넣기]에 다시 넣어 import 하세요.
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
          <label>언어</label>
          <select id="batchLang" style="padding:6px 8px;border:1px solid #d3c5b1;border-radius:6px">
            ${ADMIN_LANGUAGES.map(
              (l) =>
                `<option value="${escapeHtml(l.code)}">${l.label}</option>`,
            ).join('')}
          </select>
          <label>배치 크기</label>
          <input id="batchLimit" type="number" value="10" min="1" max="30" style="width:80px;padding:6px 8px;border:1px solid #d3c5b1;border-radius:6px" />
          <button class="btn secondary" id="batchLoad" type="button">불러오기</button>
          <span class="info" id="batchInfo"></span>
        </div>
        <label>AI 프롬프트 (전체 복사해서 ChatGPT/Claude에 붙여넣으세요)</label>
        <textarea id="batchPrompt" rows="14" readonly style="font-family:ui-monospace,monospace;font-size:12px"></textarea>
        <div class="actions" style="margin-top:10px">
          <button class="btn secondary" type="button" id="batchCopy">📋 프롬프트 복사</button>
          <span style="flex:1"></span>
          <button class="btn secondary" type="button" id="batchClose">닫기</button>
        </div>
      </div>
    </dialog>

    <!-- 단어 상세 모달 -->
    <dialog id="detailDlg">
      <div class="modal" style="max-width:760px">
        <div id="detailBody">
          <div class="sub">⏳ 불러오는 중...</div>
        </div>
        <div class="actions" style="margin-top:14px">
          <span style="flex:1"></span>
          <button class="btn ghost" type="button" id="detailClose">닫기</button>
        </div>
      </div>
    </dialog>

    <!-- JSON 붙여넣기 모달 -->
    <dialog id="importDlg">
      <div class="modal" style="max-width:880px">
        <h2>📥 JSON 붙여넣기</h2>
        <div class="sub" style="margin-bottom:10px">
          AI가 만든 JSON 배열을 그대로 붙여넣으세요. 마크다운/설명이 섞여
          있으면 (\`\`\`json … \`\`\`) 자동으로 벗겨서 처리합니다.
          형식: <code>[{ "baseWord":"run", "languageCode":"en",
          "partOfSpeech":"verb", "meaning":"달리다", "forms":{...},
          "examples":{...} }, ...]</code>
        </div>
        <label>JSON</label>
        <textarea id="importJson" rows="14" placeholder='[\n  {\n    "baseWord": "run",\n    "languageCode": "en",\n    "partOfSpeech": "verb",\n    ...\n  }\n]' style="font-family:ui-monospace,monospace;font-size:12px"></textarea>
        <div class="actions" style="margin-top:10px">
          <button class="btn ghost" type="button" id="importClose">취소</button>
          <span style="flex:1"></span>
          <button class="btn" type="button" id="importRun">DB에 입력</button>
        </div>
        <div id="importResult" style="margin-top:12px;font-size:13px"></div>
      </div>
    </dialog>
  `;
  const scripts = `<script>
    (async function () {
      const $ = (id) => document.getElementById(id);
      const state = { page: 1, q: '', coverage: 'missing' };
      let timer = null;
      const bounce = () => { clearTimeout(timer); timer = setTimeout(() => { state.page = 1; load(); }, 250); };

      async function load() {
        const params = new URLSearchParams({
          q: state.q,
          coverage: state.coverage,
          page: String(state.page),
          limit: '50',
        });
        const r = await window.adminFetch('/api/admin/word-forms?' + params.toString());
        const d = await r.json();
        const tbody = $('rows');
        if (!d.items.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty">조건에 맞는 단어가 없어요.</td></tr>';
        } else {
          tbody.innerHTML = d.items.map((w) => {
            const status = w.hasForm
              ? window.pill('완료', 'ok')
              : window.pill('누락', 'warn');
            const baseEsc = w.baseWord.replace(/"/g, '&quot;');
            const langEsc = (w.languageCode || 'en').replace(/"/g, '&quot;');
            return '<tr>' +
              '<td><code style="font-size:13px">' + w.baseWord + '</code></td>' +
              '<td>' + (w.languageCode || '-') + '</td>' +
              '<td>' + (w.partOfSpeech ? window.pill(w.partOfSpeech, 'primary') : '-') + '</td>' +
              '<td>' + (w.meaning || '-') + '</td>' +
              '<td>' + w.occurrences + '</td>' +
              '<td>' + status + '</td>' +
              '<td><button class="btn ghost" data-base="' + baseEsc + '" data-lang="' + langEsc + '" type="button">상세</button></td>' +
              '</tr>';
          }).join('');
          // 상세 버튼 wire-up. 이벤트 위임 대신 querySelector 직접 — 행이
          // 50개 수준이라 비용 X.
          tbody.querySelectorAll('button[data-base]').forEach((btn) => {
            btn.addEventListener('click', () => {
              openDetail(btn.dataset.base, btn.dataset.lang);
            });
          });
        }
        $('total').textContent = '총 ' + d.total + '개';
        $('pageInfo').textContent = d.page + ' / ' + d.totalPages;
        $('prev').disabled = d.page <= 1;
        $('next').disabled = d.page >= d.totalPages;
      }

      // ── 상세 모달 ─────────────────────────────────────────────
      const escapeHtml = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

      const FORM_LABELS = {
        base: '원형', past: '과거형', pastParticiple: '과거분사',
        presentParticiple: '현재분사', thirdPersonSingular: '3인칭 단수',
        singular: '단수형', plural: '복수형',
        comparative: '비교급', superlative: '최상급',
      };
      const VERB_ORDER = ['base','thirdPersonSingular','past','pastParticiple','presentParticiple'];
      const NOUN_ORDER = ['singular','plural'];
      const ADJ_ORDER = ['base','comparative','superlative'];

      function orderKeys(forms) {
        if (!forms) return [];
        const keys = Object.keys(forms);
        // priority dedup — VERB/ADJ 둘 다 'base' 포함이라 spread 시 중복.
        // Set으로 한 번 거르면 같은 키가 두 번 ordered에 들어가는 버그 방지.
        const priority = Array.from(
          new Set([...VERB_ORDER, ...NOUN_ORDER, ...ADJ_ORDER])
        );
        const have = new Set(keys);
        const ordered = priority.filter((k) => have.has(k));
        const extras = keys.filter((k) => !priority.includes(k));
        return [...ordered, ...extras];
      }

      async function openDetail(base, lang) {
        $('detailBody').innerHTML = '<div class="sub">⏳ 불러오는 중...</div>';
        $('detailDlg').showModal();
        try {
          const params = new URLSearchParams({ baseWord: base, lang });
          const r = await window.adminFetch('/api/admin/word-forms/detail?' + params.toString());
          const d = await r.json();
          if (!d) {
            $('detailBody').innerHTML = '<div class="sub">데이터가 없어요.</div>';
            return;
          }
          let html = '';
          html += '<h2 style="margin:0 0 4px"><code style="font-size:20px">' + escapeHtml(d.baseWord) + '</code></h2>';
          html += '<div class="sub" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
          if (d.partOfSpeech) html += window.pill(d.partOfSpeech, 'primary');
          if (d.meaning) html += '<span>' + escapeHtml(d.meaning) + '</span>';
          html += '<span>· 콘텐츠 등장 ' + d.occurrences + '회</span>';
          if (d.source) html += '<span>· source: ' + escapeHtml(d.source) + '</span>';
          if (d.updatedAt) html += '<span>· ' + escapeHtml(new Date(d.updatedAt).toLocaleString('ko-KR')) + '</span>';
          html += '</div>';

          if (!d.hasForm) {
            html += '<div class="empty" style="padding:24px;margin-top:14px">아직 활용형 데이터가 없어요. "데이터 채우기"로 AI에 요청해 보세요.</div>';
            $('detailBody').innerHTML = html;
            return;
          }

          const keys = orderKeys(d.forms);
          html += '<div style="margin-top:14px"><h3 style="margin:0 0 8px">활용형</h3>';
          for (const key of keys) {
            const surface = d.forms[key] || '';
            const label = FORM_LABELS[key] || key;
            const ex = d.examples && d.examples[key];
            html += '<div style="border:1px solid #e7d7c6;border-radius:12px;padding:12px;margin-bottom:10px;background:#fbf7f0">';
            html += '<div style="font-size:11px;color:#8b6b4f;font-weight:600;margin-bottom:2px">' + escapeHtml(label) + '</div>';
            html += '<div style="font-size:18px;font-weight:700;color:#2d2218;margin-bottom:8px">' + escapeHtml(surface) + '</div>';
            if (ex && ex.en) {
              html += '<div style="background:white;border-radius:8px;padding:10px">';
              html += '<div style="font-weight:600;color:#2d2218">' + escapeHtml(ex.en) + '</div>';
              if (ex.ko) html += '<div style="color:#77685b;margin-top:2px;font-size:13px">' + escapeHtml(ex.ko) + '</div>';
              html += '</div>';
            }
            html += '</div>';
          }
          html += '</div>';

          $('detailBody').innerHTML = html;
        } catch (e) {
          $('detailBody').innerHTML = '<div class="sub">⚠ 실패: ' + escapeHtml(e.message || e) + '</div>';
        }
      }

      $('detailClose').addEventListener('click', () => $('detailDlg').close());

      $('q').addEventListener('input', (e) => { state.q = e.target.value; bounce(); });
      $('coverage').addEventListener('change', (e) => { state.coverage = e.target.value; state.page = 1; load(); });
      $('prev').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
      $('next').addEventListener('click', () => { state.page++; load(); });

      // ── 배치 모달 ─────────────────────────────────────────────
      $('batchBtn').addEventListener('click', () => {
        $('batchDlg').showModal();
        loadBatch();
      });
      $('batchLoad').addEventListener('click', loadBatch);
      $('batchClose').addEventListener('click', () => $('batchDlg').close());

      async function loadBatch() {
        const limit = parseInt($('batchLimit').value, 10) || 10;
        const lang = $('batchLang').value || 'en';
        $('batchInfo').textContent = '⏳ 단어 모으는 중...';
        $('batchPrompt').value = '';
        try {
          const r = await window.adminFetch(
            '/api/admin/word-forms/batch?limit=' + limit +
              '&lang=' + encodeURIComponent(lang),
          );
          const d = await r.json();
          if (d.count === 0) {
            $('batchInfo').textContent = '✅ 해당 언어의 모든 단어 forms이 채워져 있어요!';
            $('batchPrompt').value = '';
          } else {
            $('batchInfo').textContent =
              d.count + '개 단어 (' + (d.languageCode || lang) +
              ') · 프롬프트 복사 후 AI에 입력하세요';
            $('batchPrompt').value = d.prompt;
          }
        } catch (e) {
          $('batchInfo').textContent = '⚠ 실패: ' + (e.message || e);
        }
      }

      $('batchCopy').addEventListener('click', async () => {
        const text = $('batchPrompt').value;
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          $('batchCopy').textContent = '✅ 복사됨';
          setTimeout(() => { $('batchCopy').textContent = '📋 프롬프트 복사'; }, 1500);
        } catch (e) {
          // 폴백: textarea select
          $('batchPrompt').select();
          document.execCommand('copy');
        }
      });

      // ── import 모달 ───────────────────────────────────────────
      $('importBtn').addEventListener('click', () => {
        $('importJson').value = '';
        $('importResult').innerHTML = '';
        $('importDlg').showModal();
      });
      $('importClose').addEventListener('click', () => $('importDlg').close());

      $('importRun').addEventListener('click', async () => {
        const raw = $('importJson').value.trim();
        if (!raw) { $('importResult').innerHTML = '<span style="color:#b04a3a">JSON이 비어 있어요.</span>'; return; }
        // 1) 마크다운 코드블록 wrapper 제거
        let cleaned = raw.replace(/^\\s*\`\`\`(?:json)?\\s*/i, '').replace(/\`\`\`\\s*$/i, '').trim();
        // 2) AI가 intro/outro 텍스트 추가한 경우 — 첫 [ 부터 마지막 ] 까지만 추출.
        //    (예: "Here are the results: [...] Let me know if you need more.")
        const first = cleaned.indexOf('[');
        const last = cleaned.lastIndexOf(']');
        if (first > 0 && last > first) cleaned = cleaned.slice(first, last + 1);
        let rows;
        try {
          rows = JSON.parse(cleaned);
        } catch (e) {
          $('importResult').innerHTML = '<span style="color:#b04a3a">JSON 파싱 실패: ' + (e.message || e) + '</span>';
          return;
        }
        if (!Array.isArray(rows)) {
          $('importResult').innerHTML = '<span style="color:#b04a3a">최상위가 배열이 아니에요. [...] 형태여야 합니다.</span>';
          return;
        }
        $('importResult').innerHTML = '⏳ 처리 중... (' + rows.length + '개)';
        try {
          const r = await window.adminFetch('/api/admin/word-forms/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows, source: 'manual-ai' }),
          });
          const d = await r.json();
          let html = '<div style="color:#3a7c3a">✅ 완료 — 신규 ' + d.inserted + ' / 갱신 ' + d.updated + ' / 오류 ' + d.errors + ' (총 ' + d.total + ')</div>';
          if (d.errorDetails && d.errorDetails.length) {
            html += '<details style="margin-top:8px"><summary style="cursor:pointer;color:#b04a3a">오류 상세 ' + d.errorDetails.length + '건</summary><ul style="margin:6px 0 0 0;padding-left:20px">' +
              d.errorDetails.map((e) => '<li>#' + e.index + ': ' + e.reason + '</li>').join('') +
              '</ul></details>';
          }
          $('importResult').innerHTML = html;
          load();
        } catch (e) {
          $('importResult').innerHTML = '<span style="color:#b04a3a">⚠ 실패: ' + (e.message || e) + '</span>';
        }
      });

      load();
    })();
  </script>`;
  return { content, scripts };
}
