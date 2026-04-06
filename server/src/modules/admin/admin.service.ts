import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Language } from '../sentences/language.entity.js';
import { Sentence, Difficulty } from '../sentences/sentence.entity.js';
import { Word } from '../sentences/word.entity.js';
import { GrammarNote } from '../sentences/grammar-note.entity.js';
import { AppConfig } from './app-config.entity.js';
import { UpdateAppConfigDto } from './dto/update-app-config.dto.js';
import { User } from '../users/user.entity.js';
import { Subscription } from '../subscriptions/subscription.entity.js';
import { DeviceToken } from '../notifications/device-token.entity.js';
import { NotificationSettings } from '../notifications/notification-settings.entity.js';
import { PushLog } from '../notifications/push-log.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { QuizAttempt } from '../quiz/quiz-attempt.entity.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Language)
    private languageRepo: Repository<Language>,
    @InjectRepository(Sentence)
    private sentenceRepo: Repository<Sentence>,
    @InjectRepository(Word)
    private wordRepo: Repository<Word>,
    @InjectRepository(GrammarNote)
    private grammarNoteRepo: Repository<GrammarNote>,
    @InjectRepository(AppConfig)
    private appConfigRepo: Repository<AppConfig>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
    @InjectRepository(NotificationSettings)
    private notificationSettingsRepo: Repository<NotificationSettings>,
    @InjectRepository(PushLog)
    private pushLogRepo: Repository<PushLog>,
    @InjectRepository(DailyAssignment)
    private assignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(QuizAttempt)
    private quizAttemptRepo: Repository<QuizAttempt>,
  ) {}

  async getAppConfig() {
    return this.ensureAppConfig();
  }

  async getPublicAppConfig() {
    const config = await this.ensureAppConfig();
    return {
      premiumMonthlyProductId: config.premiumMonthlyProductId,
      billingEnabled: config.billingEnabled,
      iosProductGroupId: config.iosProductGroupId,
      androidBasePlanId: config.androidBasePlanId,
    };
  }

  async updateAppConfig(dto: UpdateAppConfigDto) {
    const config = await this.ensureAppConfig();
    Object.assign(config, dto);
    return this.appConfigRepo.save(config);
  }

  async renderAdminPage() {
    const config = await this.ensureAppConfig();
    const checked = config.billingEnabled ? 'checked' : '';

    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>LingoLoop Admin</title>
  <style>
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; background: #f7f2ea; color: #23180f; margin: 0; }
    .wrap { max-width: 1380px; margin: 32px auto 56px; padding: 0 20px; }
    .hero { background: linear-gradient(135deg, #f26b3a, #ffb88a); color: white; padding: 28px; border-radius: 28px; display:flex; justify-content:space-between; gap:16px; align-items:flex-end; }
    .hero small { opacity: 0.86; display:block; margin-top:8px; }
    .grid { display:grid; grid-template-columns: 1.2fr 1fr; gap: 20px; margin-top:20px; }
    .stack { display:grid; gap:20px; }
    .card { background: white; border-radius: 24px; padding: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.05); }
    .stats { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px; margin-top:20px; }
    .stat { background:#fff; border-radius:20px; padding:18px; border:1px solid #eee2d6; }
    .stat .k { color:#6b5b4b; font-size:13px; }
    .stat .v { font-size:28px; font-weight:800; margin-top:8px; }
    label { display: block; margin: 0 0 8px; font-weight: 700; }
    input, textarea { width: 100%; box-sizing: border-box; padding: 14px 16px; border-radius: 16px; border: 1px solid #e7d7c6; margin-bottom: 16px; font-size: 14px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .toggle { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
    button { background: #f26b3a; color: white; border: 0; border-radius: 16px; padding: 14px 18px; font-size: 15px; font-weight: 700; cursor: pointer; }
    .secondary { background:#fff; color:#23180f; border:1px solid #e7d7c6; }
    .meta { color: #6b5b4b; font-size: 13px; margin-top: 14px; }
    .ok { color: #2f8f5b; margin-top: 12px; display: none; }
    table { width:100%; border-collapse: collapse; font-size:14px; }
    th, td { padding: 12px 10px; text-align:left; border-bottom: 1px solid #f0e4d8; vertical-align: top; }
    th { color:#6b5b4b; font-size:12px; text-transform:uppercase; letter-spacing:0.04em; }
    .pill { display:inline-flex; align-items:center; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:700; }
    .pill.ok { display:inline-flex; color:#2f8f5b; background:#e8f5ed; }
    .pill.warn { color:#d38a18; background:#fff3da; }
    .pill.muted { color:#6b5b4b; background:#f4ece1; }
    .toolbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }
    .toolbar input { margin:0; }
    .section-title { margin:0 0 6px; }
    .subgrid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; }
    pre { white-space:pre-wrap; font-size:12px; background:#f9f4ee; padding:12px; border-radius:16px; }
    @media (max-width: 1080px) { .grid, .subgrid, .stats { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1 style="margin:0 0 10px;">LingoLoop Admin</h1>
        <div>운영 통계, 유저 상태, 최근 활동, 앱 설정을 한 화면에서 관리합니다.</div>
        <small>Public admin page for fast iteration. 운영 배포 전 인증 보호를 꼭 붙이세요.</small>
      </div>
      <button class="secondary" id="refresh-dashboard">새로고침</button>
    </div>
    <div id="stats" class="stats"></div>
    <div class="grid">
      <div class="stack">
        <div class="card">
          <div class="toolbar">
            <div>
              <h2 class="section-title">유저</h2>
              <div class="meta">가입, 구독, 디바이스, 학습 진행도를 한 번에 봅니다.</div>
            </div>
            <input id="user-search" placeholder="이메일/닉네임 검색" />
          </div>
          <div style="overflow:auto;">
            <table>
              <thead>
                <tr>
                  <th>유저</th>
                  <th>플랜</th>
                  <th>언어</th>
                  <th>디바이스</th>
                  <th>문장/완료</th>
                  <th>퀴즈</th>
                  <th>최근 활동</th>
                </tr>
              </thead>
              <tbody id="users-body"></tbody>
            </table>
          </div>
        </div>
        <div class="subgrid">
          <div class="card">
            <h2 class="section-title">최근 푸시</h2>
            <div class="meta" style="margin-bottom:16px;">최근 발송/탭 활동</div>
            <div style="overflow:auto;">
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
          <div class="card">
            <h2 class="section-title">최근 퀴즈</h2>
            <div class="meta" style="margin-bottom:16px;">최근 시도와 정오답</div>
            <div style="overflow:auto;">
              <table>
                <thead>
                  <tr>
                    <th>시간</th>
                    <th>유저</th>
                    <th>정답 여부</th>
                    <th>퀴즈 ID</th>
                  </tr>
                </thead>
                <tbody id="quiz-body"></tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <h2 class="section-title">앱 설정</h2>
          <div class="meta" style="margin-bottom:16px;">결제 상품 ID와 스토어 메타 정보를 원격으로 관리합니다.</div>
          <form id="config-form">
            <label for="premiumMonthlyProductId">Premium Monthly Product ID</label>
            <input id="premiumMonthlyProductId" name="premiumMonthlyProductId" value="${config.premiumMonthlyProductId ?? ''}" />

            <div class="toggle">
              <input id="billingEnabled" name="billingEnabled" type="checkbox" ${checked} />
              <label for="billingEnabled" style="margin:0;">빌링 사용</label>
            </div>

            <div class="row">
              <div>
                <label for="iosProductGroupId">iOS Product Group ID</label>
                <input id="iosProductGroupId" name="iosProductGroupId" value="${config.iosProductGroupId ?? ''}" />
              </div>
              <div>
                <label for="androidBasePlanId">Android Base Plan ID</label>
                <input id="androidBasePlanId" name="androidBasePlanId" value="${config.androidBasePlanId ?? ''}" />
              </div>
            </div>

            <label for="adminNote">Admin Note</label>
            <textarea id="adminNote" name="adminNote" rows="5">${config.adminNote ?? ''}</textarea>

            <button type="submit">설정 저장</button>
            <div id="ok" class="ok">저장되었습니다.</div>
            <div class="meta">앱은 /api/admin/app-config/public 값을 읽어서 상품 ID를 사용합니다.</div>
          </form>
        </div>
        <div class="card">
          <h2 class="section-title">원격 설정 미리보기</h2>
          <div class="meta" style="margin-bottom:16px;">앱이 실제로 읽는 공개 설정값입니다.</div>
          <pre id="public-config"></pre>
        </div>
      </div>
    </div>
  </div>
  <script>
    const form = document.getElementById('config-form');
    const ok = document.getElementById('ok');
    const stats = document.getElementById('stats');
    const usersBody = document.getElementById('users-body');
    const pushBody = document.getElementById('push-body');
    const quizBody = document.getElementById('quiz-body');
    const publicConfig = document.getElementById('public-config');
    const userSearch = document.getElementById('user-search');

    let userRows = [];

    function pill(label, tone='muted') {
      return '<span class="pill ' + tone + '">' + label + '</span>';
    }

    function renderUsers() {
      const q = userSearch.value.trim().toLowerCase();
      const rows = userRows.filter((row) => !q || row.search.includes(q));
      usersBody.innerHTML = rows.map((row) => row.html).join('');
    }

    async function loadDashboard() {
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();

      stats.innerHTML = [
        ['총 유저', data.summary.totalUsers],
        ['프리미엄', data.summary.premiumUsers],
        ['활성 디바이스', data.summary.activeDevices],
        ['오늘 할당', data.summary.assignedToday],
        ['오늘 완료', data.summary.completedToday],
        ['최근 7일 푸시', data.summary.pushes7d],
        ['최근 7일 탭률', data.summary.pushTapRate7d + '%'],
        ['최근 7일 퀴즈 정답률', data.summary.quizAccuracy7d + '%'],
      ].map(([k,v]) => '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>').join('');

      userRows = data.users.map((user) => {
        const plan = user.subscriptionTier === 'premium' ? pill('premium', 'ok') : pill('free', 'muted');
        const notif = user.notificationEnabled ? '알림 On' : '알림 Off';
        const html = '<tr>' +
          '<td><strong>' + (user.nickname || '-') + '</strong><br><span class="meta">' + user.email + '</span><br><span class="meta">가입 ' + user.createdAt + '</span></td>' +
          '<td>' + plan + '<br><span class="meta">' + (user.subscriptionStore || '-') + '</span></td>' +
          '<td><strong>' + user.targetLanguage + '</strong> / ' + user.nativeLanguage + '<br><span class="meta">' + notif + '</span></td>' +
          '<td>' + user.activeDevices + '대<br><span class="meta">' + (user.notificationFrequencyMinutes ? user.notificationFrequencyMinutes + '분 주기' : '-') + '</span></td>' +
          '<td>' + user.totalAssignments + ' / ' + user.completedAssignments + '<br><span class="meta">최근 ' + (user.lastAssignmentDate || '-') + '</span></td>' +
          '<td>' + user.quizAttempts + '회<br><span class="meta">정답률 ' + user.quizAccuracy + '%</span></td>' +
          '<td><span class="meta">푸시 ' + (user.lastPushAt || '-') + '</span><br><span class="meta">퀴즈 ' + (user.lastQuizAt || '-') + '</span></td>' +
        '</tr>';
        return {
          search: ((user.email || '') + ' ' + (user.nickname || '')).toLowerCase(),
          html,
        };
      });
      renderUsers();

      pushBody.innerHTML = data.recentPushes.map((item) =>
        '<tr>' +
        '<td>' + item.sentAt + '</td>' +
        '<td>' + item.userLabel + '</td>' +
        '<td>' + item.pushType + '</td>' +
        '<td>' + item.status + '</td>' +
        '<td>' + (item.tappedAt ? pill('tapped', 'ok') : pill('none')) + '</td>' +
        '</tr>'
      ).join('');

      quizBody.innerHTML = data.recentQuizAttempts.map((item) =>
        '<tr>' +
        '<td>' + item.attemptedAt + '</td>' +
        '<td>' + item.userLabel + '</td>' +
        '<td>' + (item.isCorrect ? pill('정답', 'ok') : pill('오답', 'warn')) + '</td>' +
        '<td>#' + item.quizId + '</td>' +
        '</tr>'
      ).join('');
    }

    async function loadPublicConfig() {
      const response = await fetch('/api/admin/app-config/public');
      const data = await response.json();
      publicConfig.textContent = JSON.stringify(data, null, 2);
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      ok.style.display = 'none';
      const payload = {
        premiumMonthlyProductId: form.premiumMonthlyProductId.value.trim(),
        billingEnabled: form.billingEnabled.checked,
        iosProductGroupId: form.iosProductGroupId.value.trim() || null,
        androidBasePlanId: form.androidBasePlanId.value.trim() || null,
        adminNote: form.adminNote.value.trim() || null,
      };
      const response = await fetch('/api/admin/app-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        ok.style.display = 'block';
        await loadPublicConfig();
        await loadDashboard();
      }
    });

    userSearch.addEventListener('input', renderUsers);
    document.getElementById('refresh-dashboard').addEventListener('click', async () => {
      await loadDashboard();
      await loadPublicConfig();
    });

    loadDashboard();
    loadPublicConfig();
  </script>
</body>
</html>`;
  }

  async getDashboardData() {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalUsers,
      premiumUsers,
      activeDevices,
      totalSentences,
      totalLanguages,
      assignedToday,
      completedToday,
      pushes7d,
      pushTapped7d,
      quiz7dRaw,
      users,
      subscriptions,
      devices,
      notificationSettings,
      assignments,
      attempts,
      recentPushes,
      recentQuizAttempts,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { subscriptionTier: 'premium' } }),
      this.deviceTokenRepo.count({ where: { isActive: true } }),
      this.sentenceRepo.count(),
      this.languageRepo.count({ where: { isActive: true } }),
      this.assignmentRepo.count({ where: { assignedDate: today } }),
      this.assignmentRepo.count({
        where: { assignedDate: today, isCompleted: true },
      }),
      this.pushLogRepo.count({
        where: { sentAt: Between(sevenDaysAgo, new Date()) },
      }),
      this.pushLogRepo.count({
        where: {
          sentAt: Between(sevenDaysAgo, new Date()),
          tappedAt: Between(sevenDaysAgo, new Date()),
        },
      }),
      this.quizAttemptRepo
        .createQueryBuilder('a')
        .select('COUNT(*)', 'count')
        .addSelect('SUM(CASE WHEN a.isCorrect THEN 1 ELSE 0 END)', 'correct')
        .where('a.attemptedAt >= :since', { since: sevenDaysAgo })
        .getRawOne(),
      this.userRepo.find({ order: { createdAt: 'DESC' }, take: 100 }),
      this.subscriptionRepo.find(),
      this.deviceTokenRepo.find({ where: { isActive: true } }),
      this.notificationSettingsRepo.find(),
      this.assignmentRepo.find(),
      this.quizAttemptRepo.find(),
      this.pushLogRepo.find({
        relations: ['user'],
        order: { sentAt: 'DESC' },
        take: 20,
      }),
      this.quizAttemptRepo.find({
        relations: ['user'],
        order: { attemptedAt: 'DESC' },
        take: 20,
      }),
    ]);

    const userIds = users.map((user) => user.id);
    const subscriptionMap = new Map(subscriptions.map((s) => [s.userId, s]));
    const devicesByUser = this.groupBy(devices, (item) => item.userId);
    const settingsMap = new Map(
      notificationSettings.map((item) => [item.userId, item]),
    );
    const assignmentsByUser = this.groupBy(
      assignments.filter((item) => userIds.includes(item.userId)),
      (item) => item.userId,
    );
    const attemptsByUser = this.groupBy(
      attempts.filter((item) => userIds.includes(item.userId)),
      (item) => item.userId,
    );
    const pushesByUser = this.groupBy(
      recentPushes.filter((item) => userIds.includes(item.userId)),
      (item) => item.userId,
    );

    const quizCount7d = parseInt(quiz7dRaw?.count || '0', 10);
    const quizCorrect7d = parseInt(quiz7dRaw?.correct || '0', 10);

    return {
      summary: {
        totalUsers,
        premiumUsers,
        activeDevices,
        totalSentences,
        totalLanguages,
        assignedToday,
        completedToday,
        pushes7d,
        pushTapRate7d:
          pushes7d > 0 ? Math.round((pushTapped7d / pushes7d) * 100) : 0,
        quizAccuracy7d:
          quizCount7d > 0 ? Math.round((quizCorrect7d / quizCount7d) * 100) : 0,
      },
      users: users
        .map((user) => {
          const userAssignments = assignmentsByUser.get(user.id) ?? [];
          const userAttempts = attemptsByUser.get(user.id) ?? [];
          const userPushes = pushesByUser.get(user.id) ?? [];
          const correct = userAttempts.filter((item) => item.isCorrect).length;
          const setting = settingsMap.get(user.id);
          const subscription = subscriptionMap.get(user.id);

          return {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            targetLanguage: user.targetLanguage,
            nativeLanguage: user.nativeLanguage,
            subscriptionTier: user.subscriptionTier,
            subscriptionStore: subscription?.store ?? '-',
            activeDevices: (devicesByUser.get(user.id) ?? []).length,
            notificationEnabled: setting?.isEnabled ?? false,
            notificationFrequencyMinutes: setting?.frequencyMinutes ?? null,
            totalAssignments: userAssignments.length,
            completedAssignments: userAssignments.filter(
              (item) => item.isCompleted,
            ).length,
            lastAssignmentDate:
              userAssignments
                .map((item) => item.assignedDate)
                .sort()
                .reverse()[0] ?? null,
            quizAttempts: userAttempts.length,
            quizAccuracy:
              userAttempts.length > 0
                ? Math.round((correct / userAttempts.length) * 100)
                : 0,
            lastPushAt: userPushes[0]?.sentAt ?? null,
            lastQuizAt:
              userAttempts
                .map((item) => item.attemptedAt)
                .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
            createdAt: user.createdAt,
          };
        })
        .map((user) => ({
          ...user,
          createdAt: this.formatDate(user.createdAt),
          lastPushAt: this.formatNullableDate(user.lastPushAt),
          lastQuizAt: this.formatNullableDate(user.lastQuizAt),
        })),
      recentPushes: recentPushes.map((item) => ({
        id: item.id,
        userLabel: item.user?.nickname || item.user?.email || item.userId,
        pushType: item.pushType,
        status: item.status,
        sentAt: this.formatDate(item.sentAt),
        tappedAt: this.formatNullableDate(item.tappedAt),
      })),
      recentQuizAttempts: recentQuizAttempts.map((item) => ({
        id: item.id,
        userLabel: item.user?.nickname || item.user?.email || item.userId,
        quizId: item.quizId,
        isCorrect: item.isCorrect,
        attemptedAt: this.formatDate(item.attemptedAt),
      })),
    };
  }

  async seed() {
    const existingCount = await this.sentenceRepo.count();
    if (existingCount > 0) {
      return { message: 'Data already seeded', count: existingCount };
    }

    // Create languages
    const english = await this.languageRepo.save({
      code: 'en',
      name: 'English',
      nativeName: '영어',
    });

    await this.languageRepo.save({
      code: 'ja',
      name: 'Japanese',
      nativeName: '일본어',
    });

    // Seed 30 English sentences
    const sentences = this.getEnglishSentences();
    let orderIndex = 0;

    for (const data of sentences) {
      const sentence = await this.sentenceRepo.save({
        languageId: english.id,
        text: data.text,
        translation: data.translation,
        pronunciation: data.pronunciation,
        situation: data.situation,
        difficulty: data.difficulty,
        category: data.category,
        orderIndex: orderIndex++,
      });

      // Save words
      for (let i = 0; i < data.words.length; i++) {
        await this.wordRepo.save({
          sentenceId: sentence.id,
          ...data.words[i],
          orderIndex: i,
        });
      }

      // Save grammar notes
      for (let i = 0; i < data.grammarNotes.length; i++) {
        await this.grammarNoteRepo.save({
          sentenceId: sentence.id,
          ...data.grammarNotes[i],
          orderIndex: i,
        });
      }
    }

    this.logger.log(`Seeded ${sentences.length} sentences`);
    return { message: 'Seed completed', count: sentences.length };
  }

  private getEnglishSentences() {
    return [
      {
        text: "I'd like a cup of coffee, please.",
        translation: '커피 한 잔 주세요.',
        pronunciation: '아이드 라이크 어 컵 오브 커피, 플리즈.',
        situation: '카페에서 주문할 때',
        difficulty: Difficulty.BEGINNER,
        category: 'daily',
        words: [
          {
            word: "I'd like",
            meaning: '~을 원합니다 (정중한 표현)',
            partOfSpeech: 'phrase',
          },
          { word: 'a cup of', meaning: '한 잔의', partOfSpeech: 'phrase' },
          {
            word: 'please',
            meaning: '제발, ~해주세요',
            partOfSpeech: 'adverb',
          },
        ],
        grammarNotes: [
          {
            title: "I'd like",
            explanation:
              '"I would like"의 축약형으로, "I want"보다 정중한 표현입니다.',
            example: "I'd like some water.",
          },
        ],
      },
      {
        text: 'Could you tell me where the nearest subway station is?',
        translation: '가장 가까운 지하철역이 어디인지 알려주실 수 있나요?',
        pronunciation: '쿠쥬 텔 미 웨얼 더 니어리스트 서브웨이 스테이션 이즈?',
        situation: '길을 물어볼 때',
        difficulty: Difficulty.BEGINNER,
        category: 'travel',
        words: [
          {
            word: 'Could you',
            meaning: '~해주실 수 있나요?',
            partOfSpeech: 'phrase',
          },
          {
            word: 'nearest',
            meaning: '가장 가까운',
            partOfSpeech: 'adjective',
          },
          { word: 'subway station', meaning: '지하철역', partOfSpeech: 'noun' },
        ],
        grammarNotes: [
          {
            title: '간접의문문',
            explanation:
              "'where the station is'처럼 의문사 뒤에 주어+동사 순서가 됩니다 (의문문 어순 아님).",
            example: 'Do you know where he lives?',
          },
        ],
      },
      {
        text: "I'm running late for the meeting.",
        translation: '회의에 늦고 있어요.',
        pronunciation: '아임 러닝 레이트 포 더 미팅.',
        situation: '직장에서 지각할 때',
        difficulty: Difficulty.BEGINNER,
        category: 'business',
        words: [
          {
            word: 'running late',
            meaning: '늦고 있는',
            partOfSpeech: 'phrase',
          },
          { word: 'meeting', meaning: '회의', partOfSpeech: 'noun' },
        ],
        grammarNotes: [
          {
            title: '현재진행형',
            explanation: "'be + ~ing' 형태로 지금 진행 중인 상황을 나타냅니다.",
            example: 'She is working from home.',
          },
        ],
      },
      {
        text: "It was nice meeting you. Let's keep in touch!",
        translation: '만나서 반가웠어요. 연락하고 지내요!',
        pronunciation: '잇 워즈 나이스 미팅 유. 레츠 킵 인 터치!',
        situation: '처음 만난 사람과 헤어질 때',
        difficulty: Difficulty.BEGINNER,
        category: 'social',
        words: [
          {
            word: 'nice meeting you',
            meaning: '만나서 반가워요',
            partOfSpeech: 'phrase',
          },
          {
            word: 'keep in touch',
            meaning: '연락하고 지내다',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: '동명사 주어',
            explanation: "'meeting you'가 동명사구로 주어 역할을 합니다.",
            example: 'It was great talking to you.',
          },
        ],
      },
      {
        text: 'Would you mind if I opened the window?',
        translation: '제가 창문을 열어도 괜찮을까요?',
        pronunciation: '우쥬 마인드 이프 아이 오픈드 더 윈도우?',
        situation: '실내에서 환기하고 싶을 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'daily',
        words: [
          {
            word: 'Would you mind',
            meaning: '~해도 괜찮겠습니까?',
            partOfSpeech: 'phrase',
          },
          { word: 'opened', meaning: '열다 (과거형)', partOfSpeech: 'verb' },
        ],
        grammarNotes: [
          {
            title: 'Would you mind if + 과거형',
            explanation:
              '가정법 과거를 사용하여 더 공손하게 허락을 구합니다. 현재 상황이지만 과거형을 씁니다.',
            example: 'Would you mind if I sat here?',
          },
        ],
      },
      {
        text: "I've been studying English for three years.",
        translation: '저는 3년 동안 영어를 공부하고 있어요.',
        pronunciation: '아이브 빈 스터디잉 잉글리쉬 포 쓰리 이어즈.',
        situation: '자기 소개할 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'daily',
        words: [
          {
            word: "I've been",
            meaning: '나는 ~해왔다',
            partOfSpeech: 'phrase',
          },
          { word: 'studying', meaning: '공부하는', partOfSpeech: 'verb' },
          {
            word: 'for three years',
            meaning: '3년 동안',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: '현재완료진행형',
            explanation:
              "'have been + ~ing'는 과거부터 지금까지 계속되는 행동을 나타냅니다.",
            example: "She's been working here since 2020.",
          },
        ],
      },
      {
        text: 'The weather forecast says it might rain this afternoon.',
        translation: '일기예보에 따르면 오후에 비가 올 수도 있대요.',
        pronunciation: '더 웨더 포캐스트 세즈 잇 마잇 레인 디스 애프터눈.',
        situation: '날씨에 대해 이야기할 때',
        difficulty: Difficulty.BEGINNER,
        category: 'daily',
        words: [
          {
            word: 'weather forecast',
            meaning: '일기예보',
            partOfSpeech: 'noun',
          },
          {
            word: 'might',
            meaning: '~일 수도 있다',
            partOfSpeech: 'modal verb',
          },
          {
            word: 'this afternoon',
            meaning: '오늘 오후',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: 'might (가능성)',
            explanation: "'might'는 불확실한 가능성(약 50% 이하)을 나타냅니다.",
            example: 'I might go to the gym later.',
          },
        ],
      },
      {
        text: 'Do you happen to know what time the store closes?',
        translation: '혹시 그 가게가 몇 시에 문을 닫는지 아시나요?',
        pronunciation: '두 유 해픈 투 노우 왓 타임 더 스토어 클로즈즈?',
        situation: '가게 영업시간을 물어볼 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'daily',
        words: [
          { word: 'happen to', meaning: '혹시 ~하다', partOfSpeech: 'phrase' },
          { word: 'what time', meaning: '몇 시에', partOfSpeech: 'phrase' },
          { word: 'closes', meaning: '닫다, 문을 닫다', partOfSpeech: 'verb' },
        ],
        grammarNotes: [
          {
            title: 'Do you happen to ~',
            explanation:
              "'혹시'라는 의미를 더해 더 자연스럽고 공손하게 질문합니다.",
            example: 'Do you happen to have a pen?',
          },
        ],
      },
      {
        text: "I'm looking forward to hearing from you.",
        translation: '당신의 소식을 기다리겠습니다.',
        pronunciation: '아임 루킹 포워드 투 히어링 프롬 유.',
        situation: '이메일 마무리할 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'business',
        words: [
          {
            word: 'look forward to',
            meaning: '~을 기대하다/기다리다',
            partOfSpeech: 'phrase',
          },
          {
            word: 'hearing from',
            meaning: '~로부터 소식을 듣다',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: 'look forward to + 동명사',
            explanation:
              "'to' 뒤에 동명사(-ing)가 옵니다. 부정사(to + 동사원형)가 아닙니다.",
            example: "I'm looking forward to seeing you.",
          },
        ],
      },
      {
        text: 'If I had known earlier, I would have helped you.',
        translation: '더 일찍 알았더라면, 도와줬을 텐데.',
        pronunciation: '이프 아이 해드 노운 얼리어, 아이 우드 해브 헬프드 유.',
        situation: '후회를 표현할 때',
        difficulty: Difficulty.ADVANCED,
        category: 'daily',
        words: [
          {
            word: 'had known',
            meaning: '알았더라면 (과거완료)',
            partOfSpeech: 'verb',
          },
          {
            word: 'would have helped',
            meaning: '도와줬을 텐데',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: '가정법 과거완료',
            explanation:
              "'If + had p.p., would have p.p.' 구조로 과거 사실의 반대를 가정합니다.",
            example: 'If she had studied, she would have passed.',
          },
        ],
      },
      {
        text: 'Can I get this to go?',
        translation: '이거 포장해 주실 수 있나요?',
        pronunciation: '캔 아이 겟 디스 투 고?',
        situation: '식당에서 포장 요청할 때',
        difficulty: Difficulty.BEGINNER,
        category: 'food',
        words: [
          { word: 'get', meaning: '받다, 얻다', partOfSpeech: 'verb' },
          {
            word: 'to go',
            meaning: '포장하여, 가지고 가는',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: 'to go (포장)',
            explanation:
              "미국에서 음식 포장 시 'to go'를 씁니다. 영국에서는 'takeaway'를 사용합니다.",
            example: "I'll have a latte to go.",
          },
        ],
      },
      {
        text: 'How much does this cost, including tax?',
        translation: '세금 포함해서 얼마인가요?',
        pronunciation: '하우 머치 더즈 디스 코스트, 인클루딩 택스?',
        situation: '쇼핑할 때 가격 물어보기',
        difficulty: Difficulty.BEGINNER,
        category: 'shopping',
        words: [
          { word: 'how much', meaning: '얼마', partOfSpeech: 'phrase' },
          { word: 'cost', meaning: '비용이 들다', partOfSpeech: 'verb' },
          {
            word: 'including',
            meaning: '~을 포함하여',
            partOfSpeech: 'preposition',
          },
          { word: 'tax', meaning: '세금', partOfSpeech: 'noun' },
        ],
        grammarNotes: [
          {
            title: 'How much + does',
            explanation:
              "'How much'로 가격을 물을 때 3인칭 단수 주어는 does를 사용합니다.",
            example: 'How much does a ticket cost?',
          },
        ],
      },
      {
        text: "I'm afraid I can't make it to dinner tonight.",
        translation: '죄송하지만 오늘 저녁 식사에 못 갈 것 같아요.',
        pronunciation: '아임 어프레이드 아이 캔트 메이킷 투 디너 투나잇.',
        situation: '약속을 취소해야 할 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'social',
        words: [
          {
            word: "I'm afraid",
            meaning: '죄송하지만, 유감이지만',
            partOfSpeech: 'phrase',
          },
          {
            word: "can't make it",
            meaning: '갈 수 없다, 참석 못하다',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: "I'm afraid ~",
            explanation:
              '나쁜 소식이나 거절을 부드럽게 전달할 때 사용하는 표현입니다.',
            example: "I'm afraid we're sold out.",
          },
        ],
      },
      {
        text: 'What do you recommend for a first-time visitor?',
        translation: '처음 방문하는 사람에게 뭘 추천하시나요?',
        pronunciation: '왓 두 유 레커멘드 포 어 퍼스트타임 비지터?',
        situation: '관광지나 식당에서',
        difficulty: Difficulty.BEGINNER,
        category: 'travel',
        words: [
          { word: 'recommend', meaning: '추천하다', partOfSpeech: 'verb' },
          { word: 'first-time', meaning: '처음의', partOfSpeech: 'adjective' },
          { word: 'visitor', meaning: '방문자', partOfSpeech: 'noun' },
        ],
        grammarNotes: [
          {
            title: 'What do you recommend',
            explanation: '추천을 요청하는 가장 일반적인 표현입니다.',
            example: 'What do you recommend for dessert?',
          },
        ],
      },
      {
        text: 'Let me sleep on it and get back to you tomorrow.',
        translation: '하루 생각해보고 내일 연락드릴게요.',
        pronunciation: '렛 미 슬립 온 잇 앤 겟 백 투 유 투모로우.',
        situation: '결정을 미룰 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'business',
        words: [
          {
            word: 'sleep on it',
            meaning: '하룻밤 생각해보다',
            partOfSpeech: 'idiom',
          },
          {
            word: 'get back to',
            meaning: '~에게 다시 연락하다',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: 'Let me + 동사원형',
            explanation: "'~하겠습니다' 또는 '~할게요'라는 의지를 나타냅니다.",
            example: 'Let me check and call you back.',
          },
        ],
      },
      {
        text: "You should've seen the sunset yesterday. It was breathtaking!",
        translation: '어제 일몰을 봤어야 했는데. 정말 장관이었어!',
        pronunciation: '유 슈드브 씬 더 선셋 예스터데이. 잇 워즈 브레쓰테이킹!',
        situation: '감탄을 공유할 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'daily',
        words: [
          {
            word: "should've seen",
            meaning: '봤어야 했다',
            partOfSpeech: 'phrase',
          },
          { word: 'sunset', meaning: '일몰', partOfSpeech: 'noun' },
          {
            word: 'breathtaking',
            meaning: '숨 막히게 아름다운',
            partOfSpeech: 'adjective',
          },
        ],
        grammarNotes: [
          {
            title: "should've + p.p.",
            explanation:
              '과거에 하지 못한 것에 대한 아쉬움이나 추천을 나타냅니다.',
            example: "You should've tried the pasta.",
          },
        ],
      },
      {
        text: "I'm not sure I follow. Could you explain that again?",
        translation: '잘 이해가 안 되는데, 다시 설명해 주시겠어요?',
        pronunciation: '아임 낫 슈어 아이 팔로우. 쿠쥬 익스플레인 댓 어겐?',
        situation: '대화에서 이해가 안 될 때',
        difficulty: Difficulty.BEGINNER,
        category: 'daily',
        words: [
          {
            word: 'follow',
            meaning: '이해하다, 따라가다',
            partOfSpeech: 'verb',
          },
          { word: 'explain', meaning: '설명하다', partOfSpeech: 'verb' },
        ],
        grammarNotes: [
          {
            title: "I'm not sure I follow",
            explanation:
              "'I don't understand'보다 부드럽게 이해 못함을 표현하는 방법입니다.",
            example: "I'm not sure I follow your logic.",
          },
        ],
      },
      {
        text: 'It depends on the situation.',
        translation: '상황에 따라 달라요.',
        pronunciation: '잇 디펜즈 온 더 시츄에이션.',
        situation: '명확한 답을 주기 어려울 때',
        difficulty: Difficulty.BEGINNER,
        category: 'daily',
        words: [
          {
            word: 'depends on',
            meaning: '~에 달려 있다, ~에 따르다',
            partOfSpeech: 'phrase',
          },
          { word: 'situation', meaning: '상황', partOfSpeech: 'noun' },
        ],
        grammarNotes: [
          {
            title: 'depend on',
            explanation:
              "'~에 의존하다/달려있다'라는 의미. It depends는 '그때그때 달라요'라는 뜻입니다.",
            example: 'It depends on the weather.',
          },
        ],
      },
      {
        text: 'I used to play the piano when I was a kid.',
        translation: '어렸을 때 피아노를 치곤 했어요.',
        pronunciation: '아이 유스트 투 플레이 더 피아노 웬 아이 워즈 어 키드.',
        situation: '과거 습관에 대해 이야기할 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'daily',
        words: [
          {
            word: 'used to',
            meaning: '~하곤 했다 (과거 습관)',
            partOfSpeech: 'phrase',
          },
          {
            word: 'play the piano',
            meaning: '피아노를 치다',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: 'used to + 동사원형',
            explanation:
              '과거에 규칙적으로 했지만 지금은 하지 않는 행동을 나타냅니다.',
            example: 'I used to live in Seoul.',
          },
        ],
      },
      {
        text: 'The sooner we start, the better.',
        translation: '빨리 시작할수록 좋아요.',
        pronunciation: '더 수너 위 스타트, 더 베터.',
        situation: '빠른 행동을 촉구할 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'business',
        words: [
          { word: 'the sooner', meaning: '더 빨리', partOfSpeech: 'phrase' },
          { word: 'the better', meaning: '더 좋은', partOfSpeech: 'phrase' },
        ],
        grammarNotes: [
          {
            title: 'The 비교급, the 비교급',
            explanation: "'~할수록 더 ~하다'라는 의미의 비례 구문입니다.",
            example: 'The more you practice, the better you get.',
          },
        ],
      },
      {
        text: 'Excuse me, is this seat taken?',
        translation: '실례합니다, 이 자리 있는 건가요?',
        pronunciation: '익스큐즈 미, 이즈 디스 시트 테이큰?',
        situation: '카페나 대중교통에서',
        difficulty: Difficulty.BEGINNER,
        category: 'daily',
        words: [
          { word: 'excuse me', meaning: '실례합니다', partOfSpeech: 'phrase' },
          { word: 'seat', meaning: '좌석', partOfSpeech: 'noun' },
          {
            word: 'taken',
            meaning: '사용 중인, 차지된',
            partOfSpeech: 'adjective',
          },
        ],
        grammarNotes: [
          {
            title: 'Is this seat taken?',
            explanation:
              "자리가 비어있는지 물어보는 관용 표현입니다. 'taken'은 '이미 누군가가 차지한'이라는 의미입니다.",
            example: 'Is this spot taken?',
          },
        ],
      },
      {
        text: "I can't help but wonder what would have happened.",
        translation: '어떤 일이 벌어졌을지 궁금하지 않을 수가 없어요.',
        pronunciation: '아이 캔트 헬프 벗 원더 왓 우드 해브 해펀드.',
        situation: '가정적인 상황을 이야기할 때',
        difficulty: Difficulty.ADVANCED,
        category: 'daily',
        words: [
          {
            word: "can't help but",
            meaning: '~하지 않을 수 없다',
            partOfSpeech: 'phrase',
          },
          { word: 'wonder', meaning: '궁금하다', partOfSpeech: 'verb' },
          {
            word: 'would have happened',
            meaning: '일어났을 것',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: "can't help but + 동사원형",
            explanation:
              "'~하지 않을 수 없다'는 의미로, 감정이나 행동을 억제할 수 없음을 나타냅니다.",
            example: "I can't help but smile.",
          },
        ],
      },
      {
        text: 'Feel free to reach out if you have any questions.',
        translation: '질문이 있으시면 편하게 연락하세요.',
        pronunciation: '필 프리 투 리치 아웃 이프 유 해브 애니 퀘스천즈.',
        situation: '이메일이나 메시지 마무리',
        difficulty: Difficulty.BEGINNER,
        category: 'business',
        words: [
          {
            word: 'feel free to',
            meaning: '편하게 ~하다',
            partOfSpeech: 'phrase',
          },
          { word: 'reach out', meaning: '연락하다', partOfSpeech: 'phrase' },
        ],
        grammarNotes: [
          {
            title: 'feel free to + 동사원형',
            explanation:
              "'자유롭게/편하게 ~하세요'라는 의미로 상대방에게 부담 없이 행동하라는 표현입니다.",
            example: 'Feel free to ask for help.',
          },
        ],
      },
      {
        text: "That's not what I meant. Let me rephrase.",
        translation: '제 말은 그게 아니었어요. 다시 말해볼게요.',
        pronunciation: '댓스 낫 왓 아이 멘트. 렛 미 리프레이즈.',
        situation: '오해를 정정할 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'daily',
        words: [
          {
            word: 'meant',
            meaning: '의미했다 (mean의 과거형)',
            partOfSpeech: 'verb',
          },
          { word: 'rephrase', meaning: '다시 표현하다', partOfSpeech: 'verb' },
        ],
        grammarNotes: [
          {
            title: "That's not what I meant",
            explanation:
              "'내가 의미한 것은 그게 아니다'라는 구문으로, 오해를 바로잡을 때 자주 사용됩니다.",
            example: "That's not what I said.",
          },
        ],
      },
      {
        text: 'By the time I got there, the store had already closed.',
        translation: '내가 도착했을 때는, 가게가 이미 문을 닫은 후였어요.',
        pronunciation:
          '바이 더 타임 아이 갓 데어, 더 스토어 해드 올레디 클로즈드.',
        situation: '과거 이야기를 할 때',
        difficulty: Difficulty.ADVANCED,
        category: 'daily',
        words: [
          {
            word: 'by the time',
            meaning: '~할 때쯤에는',
            partOfSpeech: 'phrase',
          },
          {
            word: 'had already closed',
            meaning: '이미 닫혀 있었다',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: '과거완료 (had + p.p.)',
            explanation:
              "과거의 특정 시점보다 더 이전에 일어난 일을 나타냅니다. 'by the time'과 자주 쓰입니다.",
            example: 'By the time she arrived, we had finished eating.',
          },
        ],
      },
      {
        text: 'I was wondering if you could give me a hand with this.',
        translation: '이것 좀 도와주실 수 있을까 해서요.',
        pronunciation:
          '아이 워즈 원더링 이프 유 쿠드 기브 미 어 핸드 위드 디스.',
        situation: '공손하게 도움을 요청할 때',
        difficulty: Difficulty.INTERMEDIATE,
        category: 'daily',
        words: [
          {
            word: 'was wondering',
            meaning: '~인지 궁금하다/부탁드리다',
            partOfSpeech: 'phrase',
          },
          {
            word: 'give me a hand',
            meaning: '도와주다',
            partOfSpeech: 'idiom',
          },
        ],
        grammarNotes: [
          {
            title: 'I was wondering if ~',
            explanation:
              "직접적인 'Can you ~?'보다 훨씬 공손한 요청 표현입니다. 과거진행형을 사용하여 부드러움을 더합니다.",
            example: 'I was wondering if you could help me move.',
          },
        ],
      },
      {
        text: "There's no point in worrying about things you can't control.",
        translation: '통제할 수 없는 일에 대해 걱정해봤자 소용없어요.',
        pronunciation: '데어즈 노 포인트 인 워리잉 어바웃 씽즈 유 캔트 컨트롤.',
        situation: '조언하거나 위로할 때',
        difficulty: Difficulty.ADVANCED,
        category: 'daily',
        words: [
          {
            word: "there's no point in",
            meaning: '~해봤자 소용없다',
            partOfSpeech: 'phrase',
          },
          {
            word: 'worrying about',
            meaning: '~에 대해 걱정하다',
            partOfSpeech: 'phrase',
          },
          { word: 'control', meaning: '통제하다', partOfSpeech: 'verb' },
        ],
        grammarNotes: [
          {
            title: "There's no point in + 동명사",
            explanation: "'~해봐야 소용없다'는 의미의 관용 표현입니다.",
            example: "There's no point in arguing.",
          },
        ],
      },
      {
        text: "I'll have what she's having.",
        translation: '저도 저 분이 드시는 것과 같은 걸로 할게요.',
        pronunciation: '아일 해브 왓 쉬즈 해빙.',
        situation: '식당에서 같은 메뉴를 주문할 때',
        difficulty: Difficulty.BEGINNER,
        category: 'food',
        words: [
          {
            word: "I'll have",
            meaning: '~으로 하겠습니다 (주문)',
            partOfSpeech: 'phrase',
          },
          {
            word: "what she's having",
            meaning: '그녀가 먹고 있는 것',
            partOfSpeech: 'clause',
          },
        ],
        grammarNotes: [
          {
            title: "I'll have ~",
            explanation:
              "식당에서 주문할 때 사용하는 표현. 'what + 주어 + is having'은 관계대명사절입니다.",
            example: "I'll have the steak, please.",
          },
        ],
      },
      {
        text: 'Not only did he apologize, but he also offered to pay for the damage.',
        translation: '그는 사과했을 뿐만 아니라, 손해 배상까지 제안했어요.',
        pronunciation:
          '낫 온리 디드 히 어폴러자이즈, 벗 히 올소 오퍼드 투 페이 포 더 대미지.',
        situation: '놀라운 상황을 설명할 때',
        difficulty: Difficulty.ADVANCED,
        category: 'daily',
        words: [
          { word: 'not only', meaning: '~뿐만 아니라', partOfSpeech: 'phrase' },
          { word: 'apologize', meaning: '사과하다', partOfSpeech: 'verb' },
          {
            word: 'offered to',
            meaning: '~하겠다고 제안하다',
            partOfSpeech: 'phrase',
          },
          { word: 'damage', meaning: '피해, 손해', partOfSpeech: 'noun' },
        ],
        grammarNotes: [
          {
            title: 'Not only ~ but also (도치)',
            explanation:
              "'Not only'가 문두에 오면 도치(조동사 + 주어)가 일어납니다.",
            example: 'Not only is she smart, but she is also kind.',
          },
        ],
      },
      {
        text: "I'm on my way. Be there in ten minutes.",
        translation: '지금 가고 있어요. 10분 내로 도착해요.',
        pronunciation: '아임 온 마이 웨이. 비 데어 인 텐 미닛츠.',
        situation: '만나기로 한 장소로 이동 중일 때',
        difficulty: Difficulty.BEGINNER,
        category: 'daily',
        words: [
          {
            word: 'on my way',
            meaning: '가는 중, 가고 있는',
            partOfSpeech: 'phrase',
          },
          {
            word: 'be there',
            meaning: '거기 도착하다',
            partOfSpeech: 'phrase',
          },
          {
            word: 'in ten minutes',
            meaning: '10분 내에',
            partOfSpeech: 'phrase',
          },
        ],
        grammarNotes: [
          {
            title: "I'm on my way",
            explanation:
              "'가는 중이다'라는 관용 표현. 주어에 따라 on my/your/his way로 변합니다.",
            example: "She's on her way to school.",
          },
        ],
      },
    ];
  }

  private async ensureAppConfig() {
    let config = await this.appConfigRepo.findOne({ where: {} });
    if (!config) {
      config = this.appConfigRepo.create({
        premiumMonthlyProductId: 'lingoloop_premium_monthly',
        billingEnabled: true,
      });
      config = await this.appConfigRepo.save(config);
    }
    return config;
  }

  private groupBy<T>(items: T[], keyGetter: (item: T) => string) {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = keyGetter(item);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }

  private formatDate(date: Date | string) {
    return new Date(date).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatNullableDate(date?: Date | string | null) {
    return date ? this.formatDate(date) : '-';
  }
}
