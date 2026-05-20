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

export type ActiveNav = 'overview' | 'users' | 'pushes' | 'content';

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

    /* Toolbar */
    .toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
    .toolbar > .left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .toolbar input, .toolbar select { padding: 9px 12px; border-radius: 12px; border: 1px solid var(--line); font-size: 13px; background: #fff; max-width: 100%; }
    button.btn { background: var(--primary); color: white; border: 0; border-radius: 14px; padding: 10px 16px; font-size: 13px; font-weight: 700; cursor: pointer; }
    button.btn.secondary { background:#fff; color: var(--text); border:1px solid var(--line); }
    button.btn.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }

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
    @media (max-width: 640px) { .modal { padding: 20px; border-radius: 18px; } .modal .row2 { grid-template-columns: 1fr; } }

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
      ${navItem('users', '유저', '/backstage/users', '◌')}
      ${navItem('content', '콘텐츠', '/backstage/content', '✎')}
      ${navItem('pushes', '푸시 히스토리', '/backstage/pushes', '✦')}
      <div class="sidebar-foot">
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
    window.pickPalette = function (n) {
      const base = ['#f26b3a','#ffb88a','#6b5b4b','#2f8f5b','#d38a18','#5b8bf2','#a965d6','#c54c4c','#888','#bcae9b'];
      const out = []; for (let i = 0; i < n; i++) out.push(base[i % base.length]); return out;
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

      stats.innerHTML = [
        ['총 유저', s.totalUsers, '/backstage/users'],
        ['오늘 가입', (data.trends.signupsByDay.find((r) => r.day === new Date().toISOString().split('T')[0]) || { count: 0 }).count, '/backstage/users'],
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
          <thead><tr><th>유저</th><th>플랜</th><th>인증</th><th>트랙</th><th>디바이스</th><th>완료/할당</th><th>가입</th></tr></thead>
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
        $('rows').innerHTML = data.items.map((u) => (
          '<tr class="clickable" onclick="location.href=\\'/backstage/users/' + u.id + '\\'">' +
            '<td><strong>' + (u.nickname || '-') + '</strong><br><span style="color:#6b5b4b;font-size:12px">' + u.email + '</span></td>' +
            '<td>' + window.pill(u.subscriptionTier, u.subscriptionTier === 'premium' ? 'ok' : 'muted') + '<br><span style="color:#6b5b4b;font-size:12px">' + (u.subscriptionStore || '-') + '</span></td>' +
            '<td>' + window.pill(u.provider || '-', 'muted') + '<br><span style="color:#6b5b4b;font-size:12px">' + u.targetLanguage + '/' + u.nativeLanguage + '</span></td>' +
            '<td>' + window.pill(u.learningTrack || 'unset', 'primary') + '</td>' +
            '<td>' + u.activeDevices + '대<br><span style="color:#6b5b4b;font-size:12px">' + (u.notificationEnabled ? '알림 On' : '알림 Off') + '</span></td>' +
            '<td>' + u.completedAssignments + '/' + u.totalAssignments + '</td>' +
            '<td><span style="color:#6b5b4b;font-size:12px">' + u.createdAt + '</span></td>' +
          '</tr>'
        )).join('') || '<tr><td colspan="7" class="empty">조건에 맞는 유저가 없어요.</td></tr>';

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
      document.getElementById('profileTable').innerHTML = [
        row('ID', '<code style="font-size:11px">' + u.id + '</code>'),
        row('인증', window.pill(u.provider || '-')),
        row('플랜', window.pill(u.subscriptionTier, u.subscriptionTier === 'premium' ? 'ok' : 'muted')),
        row('언어', u.targetLanguage + ' / ' + u.nativeLanguage),
        row('타임존', u.timezone),
        row('학습 트랙', window.pill(u.learningTrack || 'unset', 'primary')),
        row('일일 목표', (u.dailyGoal != null ? u.dailyGoal + '문장' : '-')),
      ].join('');

      const s = d.stats;
      document.getElementById('userStats').innerHTML = [
        ['총 할당', s.totalAssignments],
        ['완료', s.completedAssignments],
        ['퀴즈 시도', s.quizAttempts],
        ['정답률', s.quizAccuracy + '%'],
      ].map((p) => '<div class="stat"><div class="k">' + p[0] + '</div><div class="v">' + p[1] + '</div></div>').join('');

      document.getElementById('subTable').innerHTML = d.subscription
        ? [ row('스토어', d.subscription.store || '-'),
            row('상품', d.subscription.productId || '-'),
            row('만료', d.subscription.expiresAt || '-')].join('')
        : '<tr><td class="empty">구독 정보 없음</td></tr>';

      document.getElementById('settingsTable').innerHTML = d.settings
        ? [ row('알림', d.settings.isEnabled ? window.pill('On', 'ok') : window.pill('Off', 'muted')),
            row('주기', d.settings.frequencyMinutes ? d.settings.frequencyMinutes + '분' : '-'),
            row('활성 시간', (d.settings.activeStartTime || '-') + ' ~ ' + (d.settings.activeEndTime || '-')) ].join('')
        : '<tr><td class="empty">알림 설정 없음</td></tr>';

      document.getElementById('devices').innerHTML = d.devices.length
        ? d.devices.map((dev) => '<tr><td>' + dev.platform + '</td><td><code style="font-size:11px">' + dev.token + '</code></td><td>' + (dev.isActive ? window.pill('active', 'ok') : window.pill('inactive', 'muted')) + '</td></tr>').join('')
        : '<tr><td colspan="3" class="empty">등록된 디바이스가 없습니다.</td></tr>';

      document.getElementById('assignments').innerHTML = d.recentAssignments.length
        ? d.recentAssignments.map((a) => '<tr><td>' + a.assignedDate + '</td><td>' + (a.sentenceText || '#' + a.sentenceId) + '</td><td>' + (a.isCompleted ? window.pill('완료', 'ok') : window.pill('대기', 'muted')) + '</td></tr>').join('')
        : '<tr><td colspan="3" class="empty">할당 내역 없음</td></tr>';

      document.getElementById('pushes').innerHTML = d.recentPushes.length
        ? d.recentPushes.map((p) => '<tr><td>' + p.sentAt + '</td><td>' + window.pill(p.pushType) + '</td><td>' + window.pill(p.status, p.status === 'sent' ? 'ok' : p.status === 'failed' ? 'fail' : 'muted') + '</td><td>' + (p.tappedAt ? window.pill('tapped', 'ok') : '-') + '</td></tr>').join('')
        : '<tr><td colspan="4" class="empty">푸시 기록 없음</td></tr>';

      document.getElementById('quizzes').innerHTML = d.recentQuizzes.length
        ? d.recentQuizzes.map((q) => '<tr><td>' + q.attemptedAt + '</td><td>#' + q.quizId + '</td><td>' + (q.isCorrect ? window.pill('정답', 'ok') : window.pill('오답', 'warn')) + '</td></tr>').join('')
        : '<tr><td colspan="3" class="empty">퀴즈 기록 없음</td></tr>';
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
};

function buildAiPrompt(track: string, label: string, hint: string): string {
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

Example (참고용 형식 — 따옴표 이스케이프 잘 보세요):
text,translation,pronunciation,situation,difficulty,category,words
"Where is the bus stop?","버스 정류장이 어디에 있나요?","웨어 이즈 더 버스 스탑","버스 정류장 위치를 물을 때",beginner,travel,"[{""w"":""where"",""m"":""어디""},{""w"":""bus"",""m"":""버스""},{""w"":""stop"",""m"":""정류장""}]"
"He said ""Hi""","그가 ""안녕"" 이라고 했다","히 세드 하이","따옴표 이스케이프 예시",beginner,quote,"[{""w"":""said"",""m"":""말했다""}]"

이제 위 요건에 맞춰 {N}개 문장의 CSV를 출력해주세요. 헤더 한 줄 다음 곧바로 데이터 행만 출력. 끝.`;
}

const TRACK_AI_HINTS: Record<string, string> = {
  beginner: '입문자용. 5~8단어, 현재형/단순 과거. 인사·자기소개·길 묻기·주문 등 첫 만남 상황 위주',
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
      <div class="sub">섹션을 누르면 문장 목록·추가·CSV 업로드·편집을 할 수 있어요.</div>
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
      async function loadCounts() {
        const r = await window.adminFetch('/api/admin/sentences/tracks');
        const items = await r.json();
        document.getElementById('tracks').innerHTML = items.map((t) => (
          '<a class="track-tile" href="/backstage/content/' + t.track + '">' +
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

export function renderContentTrack(track: string): PageBody {
  const safeTrack = escapeHtml(track);
  const label = TRACK_LABELS[track] || track;
  const aiHint = TRACK_AI_HINTS[track] || '자연스러운 영어 학습 문장';
  const aiPromptText = buildAiPrompt(track, label, aiHint);
  const content = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/backstage">개요</a> · <a href="/backstage/content">콘텐츠</a> · ${escapeHtml(label)}</div>
        <h1>${escapeHtml(label)} 섹션</h1>
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
"Where is the bus stop?","버스 정류장이 어디에 있나요?","웨어 이즈 더 버스 스탑","버스 정류장 위치를 물을 때",beginner,travel,"[{""w"":""where"",""m"":""어디""},{""w"":""bus"",""m"":""버스""},{""w"":""stop"",""m"":""정류장""}]"
"It's a piece of cake.","식은 죽 먹기야.","잇츠 어 피스 오브 케익","쉽다고 말할 때",intermediate,idiom,"[{""w"":""piece"",""m"":""조각""},{""w"":""cake"",""m"":""케이크""}]"</pre>

          <div style="font-weight:800;margin:10px 0 4px;">필수 컬럼</div>
          <div><code>text</code> · 영어 원문 (이미 DB에 같은 문장이 있으면 자동 스킵)</div>
          <div><code>translation</code> · 한국어 해석</div>

          <div style="font-weight:800;margin:10px 0 4px;">선택 컬럼</div>
          <div><code>pronunciation</code> · 한국어 발음 가이드 (예: 헬로 월드)</div>
          <div><code>situation</code> · 어떤 상황에서 쓰는지 한 줄</div>
          <div><code>difficulty</code> · <code>beginner</code> · <code>intermediate</code> · <code>advanced</code> 중 하나. 비우면 <code>beginner</code></div>
          <div><code>category</code> · 분류 태그 (예: greeting / business / food)</div>
          <div><code>words</code> · 학습 카드용 단어 JSON 배열. 형식: <code>[{"w":"bus","m":"버스"}]</code>. CSV 안에선 큰따옴표 더블링. 비워두면 단어 카드 없이 문장만 등록.</div>

          <div style="font-weight:800;margin:10px 0 4px;">⚠ 주의사항</div>
          <ul style="margin:0;padding-left:18px;line-height:1.7;">
            <li><strong>UTF-8</strong>로 저장하세요. 엑셀에서 저장 시 "CSV UTF-8 (쉼표로 분리)" 선택 (한글 깨짐 방지).</li>
            <li>값에 콤마·줄바꿈·따옴표가 포함되면 <strong>큰따옴표</strong>로 감싸세요: <code>"Hello, world"</code></li>
            <li>큰따옴표 자체는 <code>""</code>(두 개)로 이스케이프합니다: <code>"He said ""Hi"""</code></li>
            <li>업로드 트랙은 <strong>${escapeHtml(track)}</strong>로 강제됩니다. CSV에 track 컬럼이 있어도 무시돼요.</li>
            <li>같은 <code>text</code>(영어 문장)는 자동 스킵하므로 같은 파일을 두 번 올려도 안전합니다.</li>
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
      const $ = (id) => document.getElementById(id);
      const params = new URLSearchParams(location.search);
      const state = {
        q: params.get('q') || '',
        page: parseInt(params.get('page') || '1', 10),
        limit: 50,
      };
      $('q').value = state.q;

      const dlg = $('editDlg');
      const csvDlg = $('csvDlg');

      function pillFor(active) { return active ? window.pill('on', 'ok') : window.pill('off', 'muted'); }

      async function load() {
        const qs = new URLSearchParams({ track: TRACK, page: String(state.page), limit: String(state.limit) });
        if (state.q) qs.set('q', state.q);
        history.replaceState(null, '', '/backstage/content/' + TRACK + (state.q ? '?q=' + encodeURIComponent(state.q) : ''));
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
          $('csvPreview').innerHTML =
            (sourceLabel ? '<span style="color:#2f8f5b">' + sourceLabel + '</span> · ' : '') +
            '<strong>' + csvParsed.length + '행</strong> · 미리보기: <code>' + escapeText(csvParsed[0]?.text || '-') + '</code>';
          $('csvUpload').disabled = csvParsed.length === 0;
        } catch (err) {
          $('csvPreview').textContent = '파싱 실패: ' + err.message;
          $('csvUpload').disabled = true;
        }
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
          body: JSON.stringify({ track: TRACK, rows: csvParsed }),
        });
        const result = await r.json();
        $('csvPreview').innerHTML = '✅ 삽입 <strong>' + result.inserted + '</strong> · 건너뜀 ' + result.skipped + ' · 오류 ' + result.errors;
        setTimeout(() => { csvDlg.close(); load(); }, 1200);
      });

      function parseCsv(input) {
        const lines = [];
        let cur = '';
        let inQ = false;
        for (let i = 0; i < input.length; i++) {
          const c = input[i];
          if (c === '"') {
            if (inQ && input[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
          } else if (c === '\\n' && !inQ) { lines.push(cur); cur = ''; }
          else if (c === '\\r') { /* skip */ }
          else { cur += c; }
        }
        if (cur.length) lines.push(cur);
        if (lines.length === 0) return [];
        const split = (line) => {
          const out = []; let v = ''; let q = false;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (c === '"') {
              if (q && line[i + 1] === '"') { v += '"'; i++; }
              else q = !q;
            } else if (c === ',' && !q) { out.push(v); v = ''; }
            else { v += c; }
          }
          out.push(v); return out;
        };
        const header = split(lines[0]).map((h) => h.trim().toLowerCase());
        const idxOf = (name) => header.indexOf(name);
        const out = [];
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cells = split(lines[i]);
          const row = {
            text: cells[idxOf('text')]?.trim() || '',
            translation: cells[idxOf('translation')]?.trim() || '',
            pronunciation: idxOf('pronunciation') >= 0 ? cells[idxOf('pronunciation')]?.trim() : '',
            situation: idxOf('situation') >= 0 ? cells[idxOf('situation')]?.trim() : '',
            difficulty: idxOf('difficulty') >= 0 ? cells[idxOf('difficulty')]?.trim() : '',
            category: idxOf('category') >= 0 ? cells[idxOf('category')]?.trim() : '',
            words: idxOf('words') >= 0 ? cells[idxOf('words')]?.trim() : '',
          };
          if (row.text && row.translation) out.push(row);
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
          <thead><tr><th>시간</th><th>유저</th><th>타입</th><th>상태</th><th>탭</th><th>콘텐츠</th></tr></thead>
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
        $('rows').innerHTML = d.items.map((p) => (
          '<tr class="clickable" onclick="location.href=\\'/backstage/users/' + p.userId + '\\'">' +
            '<td>' + p.sentAt + '</td>' +
            '<td>' + p.userLabel + '</td>' +
            '<td>' + window.pill(p.pushType) + '</td>' +
            '<td>' + window.pill(p.status, p.status === 'sent' ? 'ok' : p.status === 'failed' ? 'fail' : 'muted') + '</td>' +
            '<td>' + (p.tappedAt ? window.pill('tapped', 'ok') : '-') + '</td>' +
            '<td>' + (p.contentId ? '#' + p.contentId : '-') + '</td>' +
          '</tr>'
        )).join('') || '<tr><td colspan="6" class="empty">조건에 맞는 푸시가 없어요.</td></tr>';
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
