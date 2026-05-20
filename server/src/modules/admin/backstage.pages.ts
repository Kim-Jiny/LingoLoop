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

/** Renders the full page with sidebar/topbar around the page-specific content. */
export function renderLayout(opts: {
  adminUsername: string;
  activeNav: 'overview' | 'users' | 'pushes';
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
