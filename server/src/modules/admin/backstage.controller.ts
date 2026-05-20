import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { AdminService } from './admin.service.js';

/**
 * Admin dashboard mounted at `/backstage` (no /api prefix).
 *
 * Renders a single HTML page that fetches `/api/admin/dashboard` for its
 * data and draws charts with Chart.js (CDN). Decoupled from the original
 * `/api/admin/page` route so the URL is cleaner and the page can grow
 * without touching the API surface.
 */
@Controller('backstage')
export class BackstageController {
  constructor(private adminService: AdminService) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index(): string {
    return renderPage();
  }
}

function renderPage(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LingoLoop Backstage</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg:#f7f2ea; --card:#ffffff; --text:#23180f; --muted:#6b5b4b;
      --line:#eee2d6; --primary:#f26b3a; --ok:#2f8f5b; --warn:#d38a18;
    }
    body { font-family: -apple-system, "Inter", system-ui, BlinkMacSystemFont, sans-serif; background: var(--bg); color: var(--text); margin: 0; }
    .wrap { max-width: 1380px; margin: 32px auto 56px; padding: 0 20px; }
    .hero { background: linear-gradient(135deg, #f26b3a, #ffb88a); color: white; padding: 28px; border-radius: 28px; display:flex; justify-content:space-between; gap:16px; align-items:flex-end; }
    .hero small { opacity: 0.86; display:block; margin-top:8px; }
    .stats { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px; margin-top:20px; }
    .stat { background: var(--card); border-radius:20px; padding:18px; border:1px solid var(--line); }
    .stat .k { color: var(--muted); font-size:13px; }
    .stat .v { font-size:28px; font-weight:800; margin-top:8px; }
    .row { display:grid; gap:20px; margin-top:20px; }
    .row.cols-2 { grid-template-columns: 1fr 1fr; }
    .row.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
    .card { background: var(--card); border-radius: 24px; padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.05); }
    .card h2 { margin: 0 0 6px; font-size: 18px; }
    .card .sub { color: var(--muted); font-size: 13px; margin-bottom: 16px; }
    .chart-wrap { position: relative; height: 240px; }
    table { width:100%; border-collapse: collapse; font-size:14px; }
    th, td { padding: 10px 10px; text-align:left; border-bottom: 1px solid #f0e4d8; vertical-align: top; }
    th { color: var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:0.04em; }
    .pill { display:inline-flex; align-items:center; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; }
    .pill.ok { color: var(--ok); background:#e8f5ed; }
    .pill.warn { color: var(--warn); background:#fff3da; }
    .pill.muted { color: var(--muted); background:#f4ece1; }
    .pill.fail { color:#c54c4c; background:#fde6e6; }
    .toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
    .toolbar input, .toolbar select { padding: 8px 12px; border-radius: 12px; border: 1px solid var(--line); font-size: 13px; background: #fff; }
    button { background: var(--primary); color: white; border: 0; border-radius: 16px; padding: 12px 18px; font-size: 14px; font-weight: 700; cursor: pointer; }
    button.secondary { background:#fff; color: var(--text); border:1px solid var(--line); }
    .scroll { overflow:auto; max-height: 480px; }
    @media (max-width: 1080px) { .row.cols-2, .row.cols-3 { grid-template-columns: 1fr; } .stats { grid-template-columns: 1fr 1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1 style="margin:0 0 10px;">LingoLoop Backstage</h1>
        <div>가입자, 푸시 히스토리, 학습 활동을 한 화면에서 확인합니다.</div>
        <small>이 페이지는 인증 없이 열립니다. 운영 배포 시 반드시 액세스 제어를 붙이세요.</small>
      </div>
      <button class="secondary" id="refresh">새로고침</button>
    </div>

    <div id="stats" class="stats"></div>

    <div class="row cols-2">
      <div class="card">
        <h2>가입자 추이 (최근 30일, KST)</h2>
        <div class="sub">하루 단위 신규 가입자 수</div>
        <div class="chart-wrap"><canvas id="signupChart"></canvas></div>
      </div>
      <div class="card">
        <h2>푸시 발송/탭 추이 (최근 30일)</h2>
        <div class="sub">매일 보낸 푸시와 탭된 푸시 수</div>
        <div class="chart-wrap"><canvas id="pushChart"></canvas></div>
      </div>
    </div>

    <div class="row cols-3">
      <div class="card">
        <h2>푸시 타입 분포 (30일)</h2>
        <div class="sub">sentence / quiz / widget_refresh</div>
        <div class="chart-wrap"><canvas id="pushTypeChart"></canvas></div>
      </div>
      <div class="card">
        <h2>인증 수단</h2>
        <div class="sub">전체 사용자의 가입 경로</div>
        <div class="chart-wrap"><canvas id="providerChart"></canvas></div>
      </div>
      <div class="card">
        <h2>학습 트랙</h2>
        <div class="sub">현재 선택된 트랙별 사용자 수</div>
        <div class="chart-wrap"><canvas id="trackChart"></canvas></div>
      </div>
    </div>

    <div class="row cols-2" style="margin-top:20px;">
      <div class="card">
        <div class="toolbar">
          <div>
            <h2 style="margin:0;">유저 (최근 100명)</h2>
            <div class="sub">가입 / 플랜 / 디바이스 / 학습 진행도</div>
          </div>
          <input id="user-search" placeholder="이메일/닉네임 검색" />
        </div>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>유저</th>
                <th>플랜</th>
                <th>인증</th>
                <th>디바이스</th>
                <th>완료/할당</th>
                <th>마지막 활동</th>
              </tr>
            </thead>
            <tbody id="users-body"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="toolbar">
          <div>
            <h2 style="margin:0;">푸시 히스토리</h2>
            <div class="sub">최근 발송 + 탭 활동</div>
          </div>
          <select id="push-filter">
            <option value="">전체 타입</option>
            <option value="sentence">sentence</option>
            <option value="quiz">quiz</option>
            <option value="widget_refresh">widget_refresh</option>
          </select>
        </div>
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>시간</th>
                <th>유저</th>
                <th>타입</th>
                <th>상태</th>
                <th>탭</th>
              </tr>
            </thead>
            <tbody id="push-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    const stats = document.getElementById('stats');
    const usersBody = document.getElementById('users-body');
    const pushBody = document.getElementById('push-body');
    const userSearch = document.getElementById('user-search');
    const pushFilter = document.getElementById('push-filter');
    let userRows = [];
    let pushRows = [];
    let charts = {};

    function pill(label, tone) {
      return '<span class="pill ' + (tone || 'muted') + '">' + label + '</span>';
    }

    function pickPalette(n) {
      const base = ['#f26b3a', '#ffb88a', '#6b5b4b', '#2f8f5b', '#d38a18',
                    '#5b8bf2', '#a965d6', '#c54c4c', '#888', '#bcae9b'];
      const out = [];
      for (let i = 0; i < n; i++) out.push(base[i % base.length]);
      return out;
    }

    function lineChart(id, labels, datasets) {
      if (charts[id]) charts[id].destroy();
      charts[id] = new Chart(document.getElementById(id), {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { position: 'bottom' } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });
    }

    function donutChart(id, labels, values) {
      if (charts[id]) charts[id].destroy();
      charts[id] = new Chart(document.getElementById(id), {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: pickPalette(values.length) }] },
        options: { responsive: true, maintainAspectRatio: false,
                   plugins: { legend: { position: 'bottom' } } },
      });
    }

    function renderUsers() {
      const q = userSearch.value.trim().toLowerCase();
      const rows = userRows.filter((row) => !q || row.search.includes(q));
      usersBody.innerHTML = rows.map((row) => row.html).join('');
    }

    function renderPushes() {
      const type = pushFilter.value;
      const rows = type ? pushRows.filter((r) => r.type === type) : pushRows;
      pushBody.innerHTML = rows.map((row) => row.html).join('');
    }

    async function load() {
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();
      const s = data.summary;

      stats.innerHTML = [
        ['총 유저', s.totalUsers],
        ['오늘 가입', (data.trends.signupsByDay.find((r) => r.day === new Date().toISOString().split('T')[0]) || {count: 0}).count],
        ['최근 7일 가입', s.signups7d],
        ['최근 30일 가입', s.signups30d],
        ['프리미엄', s.premiumUsers],
        ['활성 디바이스', s.activeDevices],
        ['오늘 할당', s.assignedToday],
        ['오늘 완료', s.completedToday],
        ['7일 푸시', s.pushes7d],
        ['7일 푸시 탭률', s.pushTapRate7d + '%'],
        ['7일 퀴즈 정답률', s.quizAccuracy7d + '%'],
        ['총 문장', s.totalSentences],
      ].map(([k, v]) => '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>').join('');

      // Build a complete 30-day axis even for days with zero rows.
      const today = new Date();
      const allDays = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        allDays.push(d.toISOString().split('T')[0]);
      }
      const signMap = new Map(data.trends.signupsByDay.map((r) => [r.day, r.count]));
      const pushSentMap = new Map(data.trends.pushesByDay.map((r) => [r.day, r.sent]));
      const pushTapMap = new Map(data.trends.pushesByDay.map((r) => [r.day, r.tapped]));

      lineChart('signupChart', allDays, [{
        label: '가입',
        data: allDays.map((d) => signMap.get(d) || 0),
        borderColor: '#f26b3a', backgroundColor: 'rgba(242,107,58,0.18)',
        tension: 0.3, fill: true,
      }]);

      lineChart('pushChart', allDays, [
        {
          label: '발송',
          data: allDays.map((d) => pushSentMap.get(d) || 0),
          borderColor: '#5b8bf2', backgroundColor: 'rgba(91,139,242,0.15)',
          tension: 0.3, fill: true,
        },
        {
          label: '탭',
          data: allDays.map((d) => pushTapMap.get(d) || 0),
          borderColor: '#2f8f5b', backgroundColor: 'rgba(47,143,91,0.15)',
          tension: 0.3, fill: true,
        },
      ]);

      donutChart(
        'pushTypeChart',
        data.breakdowns.pushType.map((r) => r.label),
        data.breakdowns.pushType.map((r) => r.count),
      );
      donutChart(
        'providerChart',
        data.breakdowns.authProvider.map((r) => r.label),
        data.breakdowns.authProvider.map((r) => r.count),
      );
      donutChart(
        'trackChart',
        data.breakdowns.learningTrack.map((r) => r.label),
        data.breakdowns.learningTrack.map((r) => r.count),
      );

      userRows = data.users.map((user) => {
        const plan = user.subscriptionTier === 'premium' ? pill('premium', 'ok') : pill('free', 'muted');
        const html = '<tr>' +
          '<td><strong>' + (user.nickname || '-') + '</strong><br><span style="color:#6b5b4b;font-size:12px">' + user.email + '</span><br><span style="color:#6b5b4b;font-size:12px">가입 ' + user.createdAt + '</span></td>' +
          '<td>' + plan + '<br><span style="color:#6b5b4b;font-size:12px">' + (user.subscriptionStore || '-') + '</span></td>' +
          '<td>' + pill(user.provider || '-', 'muted') + '<br><span style="color:#6b5b4b;font-size:12px">' + user.targetLanguage + '/' + user.nativeLanguage + '</span></td>' +
          '<td>' + user.activeDevices + '대<br><span style="color:#6b5b4b;font-size:12px">' + (user.notificationEnabled ? '알림 On' : '알림 Off') + '</span></td>' +
          '<td>' + user.completedAssignments + '/' + user.totalAssignments + '<br><span style="color:#6b5b4b;font-size:12px">최근 ' + (user.lastAssignmentDate || '-') + '</span></td>' +
          '<td><span style="color:#6b5b4b;font-size:12px">푸시 ' + (user.lastPushAt || '-') + '</span><br><span style="color:#6b5b4b;font-size:12px">퀴즈 ' + (user.lastQuizAt || '-') + '</span></td>' +
        '</tr>';
        return {
          search: ((user.email || '') + ' ' + (user.nickname || '')).toLowerCase(),
          html,
        };
      });
      renderUsers();

      pushRows = data.recentPushes.map((item) => {
        const statusTone = item.status === 'sent' ? 'ok' : item.status === 'failed' ? 'fail' : 'muted';
        const html = '<tr>' +
          '<td>' + item.sentAt + '</td>' +
          '<td>' + item.userLabel + '</td>' +
          '<td>' + pill(item.pushType, 'muted') + '</td>' +
          '<td>' + pill(item.status, statusTone) + '</td>' +
          '<td>' + (item.tappedAt ? pill('tapped', 'ok') : pill('-', 'muted')) + '</td>' +
        '</tr>';
        return { type: item.pushType, html };
      });
      renderPushes();
    }

    userSearch.addEventListener('input', renderUsers);
    pushFilter.addEventListener('change', renderPushes);
    document.getElementById('refresh').addEventListener('click', load);
    load();
  </script>
</body>
</html>`;
}
