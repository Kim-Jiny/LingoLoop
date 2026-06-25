import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, IsNull, Repository } from 'typeorm';
import { SubscriptionEvent } from '../subscriptions/subscription-event.entity.js';
import { Language } from '../sentences/language.entity.js';
import { Sentence, Difficulty } from '../sentences/sentence.entity.js';
import { Word } from '../sentences/word.entity.js';
import { WordForm } from '../sentences/word-form.entity.js';
import { GrammarNote } from '../sentences/grammar-note.entity.js';
import { AppConfig } from './app-config.entity.js';
import { UpdateAppConfigDto } from './dto/update-app-config.dto.js';
import { User } from '../users/user.entity.js';
import { Subscription } from '../subscriptions/subscription.entity.js';
import { DeviceToken } from '../notifications/device-token.entity.js';
import { NotificationSettings } from '../notifications/notification-settings.entity.js';
import { PushLog } from '../notifications/push-log.entity.js';
import { DailyAssignment } from '../sentences/daily-assignment.entity.js';
import { Quiz, QuizType } from '../quiz/quiz.entity.js';
import { QuizAttempt } from '../quiz/quiz-attempt.entity.js';
import { englishSentences } from './seed-data/sentences.en.js';
import { japaneseSentences } from './seed-data/sentences.ja.js';
import { Inquiry } from '../inquiries/inquiry.entity.js';
import { InquiriesService } from '../inquiries/inquiries.service.js';
import { FcmService } from '../notifications/fcm.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { learningTracksByLanguage } from '../../common/language-options.js';

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly logger = new Logger(AdminService.name);

  /**
   * synchronize off in prod — AppConfig 테이블 idempotent CREATE.
   * 이게 없으면 admin web에서 빌링 설정 저장 시 ensureAppConfig가
   * 'relation "ll_app_config" does not exist'로 500. 다른 모듈들과
   * 동일 패턴 (vocabulary, inquiries, progress.achievement-unlocks).
   * createdAt/updatedAt은 TypeORM @Create/UpdateDateColumn이 entity
   * 레벨에서 set/refresh하지만, raw INSERT/UPDATE 대비 DB DEFAULT도
   * 둠.
   */
  async onModuleInit() {
    await this.appConfigRepo.query(`
      CREATE TABLE IF NOT EXISTS ll_app_config (
        id SERIAL PRIMARY KEY,
        "premiumMonthlyProductId" varchar NOT NULL DEFAULT 'lingoloop_premium_monthly',
        "billingEnabled" boolean NOT NULL DEFAULT false,
        "iosProductGroupId" varchar NULL,
        "androidBasePlanId" varchar NULL,
        "adminNote" text NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    // synchronize off — ll_word_forms 테이블도 idempotent CREATE.
    // (baseWord, language_id) unique 인덱스로 중복 import 방지.
    await this.appConfigRepo.query(`
      CREATE TABLE IF NOT EXISTS ll_word_forms (
        id SERIAL PRIMARY KEY,
        "baseWord" text NOT NULL,
        language_id int NOT NULL REFERENCES ll_languages(id) ON DELETE CASCADE,
        "partOfSpeech" text NOT NULL,
        meaning text NULL,
        forms jsonb NOT NULL DEFAULT '{}'::jsonb,
        examples jsonb NULL,
        source text NOT NULL DEFAULT 'manual',
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await this.appConfigRepo.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_ll_word_forms_word_lang
       ON ll_word_forms ("baseWord", language_id)`,
    );
    // 과거 paste된 smart quotes(U+2019/U+2018) baseWord를 ASCII '로 정규화.
    // 동일 단어의 straight 버전이 이미 존재하면 unique constraint 충돌 —
    // 그 경우 curly 행을 우선 삭제(query-side REPLACE join이 straight 행
    // 으로 join을 채워주므로 데이터 손실 아님). 첫 부팅 후 LIKE 매치 없음
    // → no-op. 보수적으로 try/catch — 실패해도 join은 SQL REPLACE로 동작.
    try {
      await this.appConfigRepo.query(
        `DELETE FROM ll_word_forms curly
         WHERE ("baseWord" LIKE '%‘%' OR "baseWord" LIKE '%’%')
           AND EXISTS (
             SELECT 1 FROM ll_word_forms straight
             WHERE straight.language_id = curly.language_id
               AND straight."baseWord" =
                 REPLACE(REPLACE(curly."baseWord", '‘', ''''), '’', '''')
           )`,
      );
      await this.appConfigRepo.query(
        `UPDATE ll_word_forms
         SET "baseWord" = REPLACE(REPLACE("baseWord", '‘', ''''), '’', '''')
         WHERE "baseWord" LIKE '%‘%' OR "baseWord" LIKE '%’%'`,
      );
    } catch (e) {
      this.logger?.warn?.(
        `smart-quote normalization skipped: ${(e as Error).message}`,
      );
    }
    // 운영자 푸시 토글 — 미설정 시 기본 true (이전 호환).
    await this.appConfigRepo.query(
      `ALTER TABLE ll_app_config
       ADD COLUMN IF NOT EXISTS "adminPushPrefs" jsonb NULL`,
    );
  }

  constructor(
    @InjectRepository(Language)
    private languageRepo: Repository<Language>,
    @InjectRepository(Sentence)
    private sentenceRepo: Repository<Sentence>,
    @InjectRepository(Word)
    private wordRepo: Repository<Word>,
    @InjectRepository(WordForm)
    private wordFormRepo: Repository<WordForm>,
    @InjectRepository(GrammarNote)
    private grammarNoteRepo: Repository<GrammarNote>,
    @InjectRepository(AppConfig)
    private appConfigRepo: Repository<AppConfig>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionEvent)
    private subscriptionEventRepo: Repository<SubscriptionEvent>,
    @InjectRepository(DeviceToken)
    private deviceTokenRepo: Repository<DeviceToken>,
    @InjectRepository(NotificationSettings)
    private notificationSettingsRepo: Repository<NotificationSettings>,
    @InjectRepository(PushLog)
    private pushLogRepo: Repository<PushLog>,
    @InjectRepository(DailyAssignment)
    private assignmentRepo: Repository<DailyAssignment>,
    @InjectRepository(Quiz)
    private quizRepo: Repository<Quiz>,
    @InjectRepository(QuizAttempt)
    private quizAttemptRepo: Repository<QuizAttempt>,
    @InjectRepository(Inquiry)
    private inquiryRepo: Repository<Inquiry>,
    private inquiriesService: InquiriesService,
    private fcmService: FcmService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * 사용자에게 silent FCM 발송 — 클라가 subscriptionStatusProvider를
   * invalidate해서 즉시 새 상태를 fetch하도록. admin grant/revoke 직후
   * 인앱 사용자도 새로고침 없이 반영됨.
   *
   * 데이터 키만 보내고 (notification 필드 X) → 사용자에게 알림으로
   * 노출되지 않음. 클라 background isolate가 type=subscription_updated
   * 보고 분기 처리.
   */
  private async pingSubscriptionUpdated(userId: string): Promise<void> {
    try {
      const tokens = await this.deviceTokenRepo.find({
        where: { userId, isActive: true },
        select: ['token'],
      });
      if (tokens.length === 0) {
        this.logger.warn(
          `pingSubscriptionUpdated: no active device tokens for ${userId}`,
        );
        return;
      }
      const result = await this.fcmService.sendSilentToMultiple(
        tokens.map((t) => t.token),
        { type: 'subscription_updated' },
      );
      this.logger.log(
        `pingSubscriptionUpdated: ${userId} → ${result.success}/${tokens.length} delivered`,
      );
      // 만료/무효 토큰은 즉시 비활성화 — 다음 cron/이벤트에서 또 보내지
      // 않도록. widget-refresh / push-scheduler / notifyAdmins와 동일 패턴.
      if (result.invalidTokens.length > 0) {
        await this.deviceTokenRepo
          .createQueryBuilder()
          .update()
          .set({ isActive: false })
          .where('token IN (:...tokens)', { tokens: result.invalidTokens })
          .execute();
        this.logger.log(
          `pingSubscriptionUpdated: deactivated ${result.invalidTokens.length} invalid token(s)`,
        );
      }
    } catch (e: any) {
      // silent 실패해도 grant/revoke 흐름은 막지 않지만 push가 안 갔다는
      // 정보는 운영 디버깅에 중요 — 다음 화면 진입 시 어차피 refresh되니
      // 사용자엔 영향 X.
      this.logger.error(
        `pingSubscriptionUpdated failed for ${userId}: ${e?.message}`,
      );
    }
  }

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

  /**
   * 운영자 푸시 토글 조회. 키 누락 = true (기본 수신).
   */
  async getAdminPushPrefs() {
    const config = await this.ensureAppConfig();
    return {
      prefs: config.adminPushPrefs ?? {},
      // 백스테이지가 어떤 키를 토글로 그릴지 화이트리스트 — 새 키 추가
      // 시 여기에만 등록하면 됨.
      knownTypes: [
        { key: 'inquiry', label: '새 문의 도착' },
        { key: 'purchase', label: '신규 구독 결제' },
        { key: 'renew', label: '자동 갱신 결제' },
        { key: 'resume', label: '재구독 / 결제 회복' },
        { key: 'fail', label: '결제 실패' },
        { key: 'cancel', label: '자동 갱신 해지' },
        { key: 'refund', label: '환불' },
        { key: 'admin_grant', label: '운영자 프리미엄 지급' },
        { key: 'admin_revoke', label: '운영자 프리미엄 회수' },
      ],
    };
  }

  async setAdminPushPrefs(prefs: Record<string, boolean>) {
    const config = await this.ensureAppConfig();
    // 값을 boolean으로 강제 normalize, 알 수 없는 키도 그대로 저장
    // (UI에서 검증, 서버는 보수적으로).
    const clean: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(prefs ?? {})) {
      // 입력이 string('true')으로 와도 boolean으로 강제.
      const truthy =
        v === true || (typeof v === 'string' && v === 'true');
      clean[String(k)] = truthy;
    }
    config.adminPushPrefs = clean;
    await this.appConfigRepo.save(config);
    return { prefs: clean };
  }

  async getDashboardData() {
    const kstToday = this.kstDateString(new Date());
    const today = kstToday;
    const todayStart = this.utcFromKstDate(kstToday);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgoKst = this.kstDateString(sevenDaysAgo);

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
      activeTodayRaw,
      active7dRaw,
      active30dRaw,
      completedAssignments7d,
      assignedAssignments7d,
      quizUsers7dRaw,
      signupsToday,
      subscriptionFunnelRaw,
    ] = await Promise.all([
      this.userRepo.count({ where: { deletedAt: IsNull() } }),
      this.userRepo.count({
        where: { subscriptionTier: 'premium', deletedAt: IsNull() },
      }),
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
      this.countActiveUsersSince(todayStart),
      this.countActiveUsersSince(sevenDaysAgo),
      this.countActiveUsersSince(thirtyDaysAgo),
      this.assignmentRepo.count({
        where: {
          assignedDate: Between(sevenDaysAgoKst, today),
          isCompleted: true,
        },
      }),
      this.assignmentRepo.count({
        where: { assignedDate: Between(sevenDaysAgoKst, today) },
      }),
      this.quizAttemptRepo
        .createQueryBuilder('a')
        .select('COUNT(DISTINCT a.userId)', 'count')
        .where('a.attemptedAt >= :since', { since: sevenDaysAgo })
        .getRawOne(),
      this.userRepo.count({
        where: {
          createdAt: Between(todayStart, new Date()),
          deletedAt: IsNull(),
        },
      }),
      this.getSubscriptionFunnel(thirtyDaysAgo),
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

    // Per-day signup + push trends (last 30 days, KST). Done in JS over
    // already-loaded data where possible; raw groupBy queries for tables
    // we don't fully load (push logs, full assignment set could be large).
    // createdAt/sentAt are `timestamp without time zone` storing UTC wall
    // clock — tag as UTC, then convert to KST (a single AT TIME ZONE on a
    // naive column reads the wrong direction).
    const signupsByDay = await this.userRepo
      .createQueryBuilder('u')
      .select(
        "to_char((u.createdAt AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')",
        'day',
      )
      .addSelect('COUNT(*)', 'count')
      .where('u.createdAt >= :since', { since: thirtyDaysAgo })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    const pushesByDayRaw = await this.pushLogRepo
      .createQueryBuilder('p')
      .select(
        "to_char((p.sentAt AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')",
        'day',
      )
      .addSelect('COUNT(*)', 'sent')
      .addSelect(
        'SUM(CASE WHEN p.tappedAt IS NOT NULL THEN 1 ELSE 0 END)',
        'tapped',
      )
      .where('p.sentAt >= :since', { since: thirtyDaysAgo })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    const pushTypeRaw = await this.pushLogRepo
      .createQueryBuilder('p')
      .select('p.pushType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('p.sentAt >= :since', { since: thirtyDaysAgo })
      .groupBy('p.pushType')
      .getRawMany();

    const pushStatusRaw = await this.pushLogRepo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('p.sentAt >= :since', { since: thirtyDaysAgo })
      .groupBy('p.status')
      .getRawMany();

    const providerRaw = await this.userRepo
      .createQueryBuilder('u')
      .select('u.provider', 'provider')
      .addSelect('COUNT(*)', 'count')
      .groupBy('u.provider')
      .getRawMany();

    const trackRaw = await this.userRepo
      .createQueryBuilder('u')
      .select("COALESCE(u.learningTrack, 'unset')", 'track')
      .addSelect('COUNT(*)', 'count')
      .groupBy('track')
      .getRawMany();

    const signups7d = signupsByDay
      .filter(
        (r) =>
          new Date(r.day) >= new Date(sevenDaysAgo.toISOString().split('T')[0]),
      )
      .reduce((acc, r) => acc + parseInt(r.count, 10), 0);
    const signups30d = signupsByDay.reduce(
      (acc, r) => acc + parseInt(r.count, 10),
      0,
    );

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
        signups7d,
        signups30d,
        signupsToday,
      },
      operating: {
        activeUsersToday: this.rawCount(activeTodayRaw),
        activeUsers7d: this.rawCount(active7dRaw),
        activeUsers30d: this.rawCount(active30dRaw),
        completionRateToday:
          assignedToday > 0
            ? Math.round((completedToday / assignedToday) * 100)
            : 0,
        completionRate7d:
          assignedAssignments7d > 0
            ? Math.round((completedAssignments7d / assignedAssignments7d) * 100)
            : 0,
        quizUsers7d: this.rawCount(quizUsers7dRaw),
        quizParticipationRate7d:
          this.rawCount(active7dRaw) > 0
            ? Math.round(
                (this.rawCount(quizUsers7dRaw) / this.rawCount(active7dRaw)) *
                  100,
              )
            : 0,
        premiumRatio:
          totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0,
      },
      subscriptionFunnel: subscriptionFunnelRaw,
      trends: {
        signupsByDay: signupsByDay.map((r) => ({
          day: r.day,
          count: parseInt(r.count, 10),
        })),
        pushesByDay: pushesByDayRaw.map((r) => ({
          day: r.day,
          sent: parseInt(r.sent, 10),
          tapped: parseInt(r.tapped || '0', 10),
        })),
      },
      breakdowns: {
        pushType: pushTypeRaw.map((r) => ({
          label: r.type ?? 'unknown',
          count: parseInt(r.count, 10),
        })),
        pushStatus: pushStatusRaw.map((r) => ({
          label: r.status ?? 'unknown',
          count: parseInt(r.count, 10),
        })),
        authProvider: providerRaw.map((r) => ({
          label: r.provider ?? 'unknown',
          count: parseInt(r.count, 10),
        })),
        learningTrack: trackRaw.map((r) => ({
          label: r.track ?? 'unset',
          count: parseInt(r.count, 10),
        })),
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
            provider: user.provider,
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

  async listUsers(params: {
    q?: string;
    provider?: string;
    track?: string;
    plan?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 30));
    const skip = (page - 1) * limit;

    const qb = this.userRepo.createQueryBuilder('u');
    if (params.q?.trim()) {
      qb.andWhere(
        "(LOWER(u.email) LIKE :q OR LOWER(COALESCE(u.nickname, '')) LIKE :q)",
        { q: `%${params.q.trim().toLowerCase()}%` },
      );
    }
    if (params.provider) {
      qb.andWhere('u.provider = :provider', { provider: params.provider });
    }
    if (params.track) {
      if (params.track === 'unset') qb.andWhere('u.learningTrack IS NULL');
      else qb.andWhere('u.learningTrack = :track', { track: params.track });
    }
    if (params.plan) {
      qb.andWhere('u.subscriptionTier = :plan', { plan: params.plan });
    }
    qb.orderBy('u.createdAt', 'DESC');

    const [users, total] = await qb.skip(skip).take(limit).getManyAndCount();
    const userIds = users.map((u) => u.id);

    const [
      subscriptions,
      devices,
      settings,
      assignments,
      quizStats,
      recentPushes,
    ] = await Promise.all([
      userIds.length
        ? this.subscriptionRepo.find({ where: { userId: In(userIds) } })
        : Promise.resolve([] as Subscription[]),
      userIds.length
        ? this.deviceTokenRepo.find({
            where: { userId: In(userIds) },
            order: { updatedAt: 'DESC' as const },
          })
        : Promise.resolve([] as DeviceToken[]),
      userIds.length
        ? this.notificationSettingsRepo.find({
            where: { userId: In(userIds) },
          })
        : Promise.resolve([] as NotificationSettings[]),
      userIds.length
        ? this.assignmentRepo.find({ where: { userId: In(userIds) } })
        : Promise.resolve([] as DailyAssignment[]),
      userIds.length
        ? this.quizAttemptRepo
            .createQueryBuilder('qz')
            .select('qz.userId', 'userId')
            .addSelect('COUNT(*)::int', 'total')
            .addSelect(
              'SUM(CASE WHEN qz.isCorrect = true THEN 1 ELSE 0 END)::int',
              'correct',
            )
            .where('qz.userId IN (:...userIds)', { userIds })
            .groupBy('qz.userId')
            .getRawMany<{
              userId: string;
              total: number;
              correct: number;
            }>()
        : Promise.resolve(
            [] as { userId: string; total: number; correct: number }[],
          ),
      userIds.length
        ? this.pushLogRepo.find({
            where: { userId: In(userIds) },
            order: { sentAt: 'DESC' as const },
            take: userIds.length * 5,
          })
        : Promise.resolve([] as PushLog[]),
    ]);
    const subMap = new Map(subscriptions.map((s) => [s.userId, s]));
    const devMap = this.groupBy(devices, (d) => d.userId);
    const setMap = new Map(settings.map((s) => [s.userId, s]));
    const asnMap = this.groupBy(assignments, (a) => a.userId);
    const quizMap = new Map(quizStats.map((s) => [s.userId, s]));
    const pushMap = this.groupBy(recentPushes, (p) => p.userId);

    return {
      items: users.map((u) => {
        const userAssignments = asnMap.get(u.id) ?? [];
        const userDevices = devMap.get(u.id) ?? [];
        const activeDevices = userDevices.filter((d) => d.isActive);
        const subscription = subMap.get(u.id);
        const notificationSettings = setMap.get(u.id);
        const quiz = quizMap.get(u.id);
        const quizTotal = Number(quiz?.total ?? 0);
        const quizCorrect = Number(quiz?.correct ?? 0);
        return {
          id: u.id,
          email: u.email,
          nickname: u.nickname,
          provider: u.provider,
          targetLanguage: u.targetLanguage,
          nativeLanguage: u.nativeLanguage,
          timezone: u.timezone,
          learningTrack: u.learningTrack,
          dailyGoal: (u as any).dailyGoal,
          isActive: u.isActive,
          deletedAt: u.deletedAt ? this.formatDate(u.deletedAt) : null,
          subscriptionTier: u.subscriptionTier,
          subscriptionStore: subscription?.store ?? null,
          subscription: subscription
            ? {
                store: subscription.store,
                productId: subscription.productId,
                plan: subscription.plan,
                isActive: subscription.isActive,
                expiresAt: subscription.expiresAt
                  ? this.formatDate(subscription.expiresAt)
                  : null,
                autoRenew: subscription.autoRenew,
                environment: subscription.environment,
                inTrial: subscription.inTrial,
                revokedAt: subscription.revokedAt
                  ? this.formatDate(subscription.revokedAt)
                  : null,
              }
            : null,
          activeDevices: activeDevices.length,
          totalDevices: userDevices.length,
          devices: userDevices.slice(0, 5).map((d) => ({
            id: d.id,
            platform: d.platform,
            isActive: d.isActive,
            // 리스트 뷰 — 식별만 가능하게 끝 8자만. 풀 토큰은 상세 페이지에서.
            token: d.token ? `…${d.token.slice(-8)}` : '',
            createdAt: this.formatDate(d.createdAt),
            updatedAt: this.formatDate(d.updatedAt),
          })),
          notificationEnabled: notificationSettings?.isEnabled ?? false,
          settings: notificationSettings
            ? {
                isEnabled: notificationSettings.isEnabled,
                frequencyMinutes: notificationSettings.frequencyMinutes,
                activeStartTime: notificationSettings.activeStartTime,
                activeEndTime: notificationSettings.activeEndTime,
                timezone: notificationSettings.timezone,
                wordPushRatio: notificationSettings.wordPushRatio,
                nextPushAt: notificationSettings.nextPushAt
                  ? this.formatDate(notificationSettings.nextPushAt)
                  : null,
                updatedAt: this.formatDate(notificationSettings.updatedAt),
              }
            : null,
          lastPlatform: u.lastPlatform,
          totalAssignments: userAssignments.length,
          completedAssignments: userAssignments.filter((a) => a.isCompleted)
            .length,
          quizAttempts: quizTotal,
          quizCorrect,
          quizAccuracy: quizTotal
            ? Math.round((quizCorrect / quizTotal) * 100)
            : 0,
          recentPushes: (pushMap.get(u.id) ?? []).slice(0, 3).map((p) => ({
            sentAt: this.formatDate(p.sentAt),
            pushType: p.pushType,
            status: p.status,
            tappedAt: p.tappedAt ? this.formatDate(p.tappedAt) : null,
          })),
          createdAt: this.formatDate(u.createdAt),
          updatedAt: this.formatDate(u.updatedAt),
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getUserDetail(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;

    const [
      subscription,
      devices,
      settings,
      assignments,
      pushes,
      quizzes,
      subscriptionEvents,
    ] = await Promise.all([
      this.subscriptionRepo.findOne({ where: { userId: id } }),
      this.deviceTokenRepo.find({
        where: { userId: id },
        order: { id: 'DESC' as const },
      }),
      this.notificationSettingsRepo.findOne({ where: { userId: id } }),
      this.assignmentRepo.find({
        where: { userId: id },
        relations: ['sentence'],
        order: { assignedDate: 'DESC' },
        take: 30,
      }),
      this.pushLogRepo.find({
        where: { userId: id },
        order: { sentAt: 'DESC' },
        take: 30,
      }),
      this.quizAttemptRepo.find({
        where: { userId: id },
        order: { attemptedAt: 'DESC' },
        take: 30,
      }),
      // Subscription audit trail: most recent 50 events for this user.
      // Powers the "결제 히스토리" timeline on the user detail page.
      this.subscriptionEventRepo.find({
        where: { userId: id },
        order: { occurredAt: 'DESC' as const },
        take: 50,
      }),
    ]);

    const [allAssignments, completedCount, totalQuiz, correctQuiz] =
      await Promise.all([
        this.assignmentRepo.count({ where: { userId: id } }),
        this.assignmentRepo.count({
          where: { userId: id, isCompleted: true },
        }),
        this.quizAttemptRepo.count({ where: { userId: id } }),
        this.quizAttemptRepo.count({ where: { userId: id, isCorrect: true } }),
      ]);

    return {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        provider: user.provider,
        targetLanguage: user.targetLanguage,
        nativeLanguage: user.nativeLanguage,
        timezone: user.timezone,
        learningTrack: user.learningTrack,
        dailyGoal: (user as any).dailyGoal,
        subscriptionTier: user.subscriptionTier,
        isActive: user.isActive,
        isAdmin: user.isAdmin,
        deletedAt: user.deletedAt ? this.formatDate(user.deletedAt) : null,
        createdAt: this.formatDate(user.createdAt),
        updatedAt: this.formatDate(user.updatedAt),
        // 인증 시점에 클라이언트가 보낸 환경 정보. 운영자가 "이 사용자가
        // 언제 마지막으로 로그인/리프레시했고 어떤 OS·앱 버전·디바이스에서
        // 쓰는지"를 한눈에 보기 위함. null이면 구버전 클라이언트.
        lastSeenAt: user.lastSeenAt ? this.formatDate(user.lastSeenAt) : null,
        lastPlatform: user.lastPlatform,
        lastOsVersion: user.lastOsVersion,
        lastAppVersion: user.lastAppVersion,
        lastAppBuild: user.lastAppBuild,
        lastDeviceModel: user.lastDeviceModel,
      },
      subscription: subscription
        ? {
            store: subscription.store,
            productId: (subscription as any).productId ?? null,
            plan: subscription.plan,
            isActive: subscription.isActive,
            expiresAt: (subscription as any).expiresAt
              ? this.formatDate((subscription as any).expiresAt)
              : null,
            expiresAtIso: (subscription as any).expiresAt
              ? new Date((subscription as any).expiresAt).toISOString()
              : null,
            revokedAt: (subscription as any).revokedAt
              ? this.formatDate((subscription as any).revokedAt)
              : null,
            autoRenew: (subscription as any).autoRenew ?? false,
            environment: subscription.environment,
            inTrial: subscription.inTrial,
          }
        : null,
      devices: devices.map((d) => ({
        id: d.id,
        platform: d.platform,
        isActive: d.isActive,
        token: d.token ?? '',
        createdAt: this.formatDate(d.createdAt),
        updatedAt: this.formatDate(d.updatedAt),
      })),
      settings: settings
        ? {
            isEnabled: settings.isEnabled,
            frequencyMinutes: settings.frequencyMinutes,
            activeStartTime: (settings as any).activeStartTime,
            activeEndTime: (settings as any).activeEndTime,
            timezone: settings.timezone,
            wordPushRatio: settings.wordPushRatio,
            nextPushAt: settings.nextPushAt
              ? this.formatDate(settings.nextPushAt)
              : null,
            updatedAt: this.formatDate(settings.updatedAt),
          }
        : null,
      stats: {
        totalAssignments: allAssignments,
        completedAssignments: completedCount,
        quizAttempts: totalQuiz,
        quizAccuracy: totalQuiz
          ? Math.round((correctQuiz / totalQuiz) * 100)
          : 0,
      },
      recentAssignments: assignments.map((a) => ({
        assignedDate: a.assignedDate,
        isCompleted: a.isCompleted,
        status: a.status,
        sentenceId: a.sentenceId,
        sentenceText: a.sentence?.text ?? '',
        sentenceTranslation: a.sentence?.translation ?? '',
        completedAt: a.completedAt ? this.formatDate(a.completedAt) : null,
        createdAt: this.formatDate(a.createdAt),
      })),
      recentPushes: pushes.map((p) => ({
        sentAt: this.formatDate(p.sentAt),
        pushType: p.pushType,
        status: p.status,
        tappedAt: p.tappedAt ? this.formatDate(p.tappedAt) : null,
      })),
      recentQuizzes: quizzes.map((q) => ({
        attemptedAt: this.formatDate(q.attemptedAt),
        quizId: q.quizId,
        isCorrect: q.isCorrect,
      })),
      subscriptionEvents: subscriptionEvents.map((e) => ({
        occurredAt: this.formatDate(e.occurredAt),
        source: e.source,
        eventType: e.eventType,
        outcome: e.outcome,
        outcomeReason: e.outcomeReason,
        productId: e.productId,
        // Trim originalTransactionId / purchaseToken to last 8 chars so
        // the UI doesn't leak full tokens but support can still match
        // against store dashboards.
        txnIdTail: e.originalTransactionId
          ? e.originalTransactionId.slice(-8)
          : null,
        payload: e.payload,
      })),
    };
  }

  // 언어별 지원 트랙 — UI에서 같은 순서로 노출.
  static readonly TRACKS_BY_LANG: Record<string, readonly string[]> =
    learningTracksByLanguage;

  /// 후방 호환: 옛 클라이언트가 TRACKS를 직접 참조하면 영어 트랙 fallback.
  static readonly TRACKS = AdminService.TRACKS_BY_LANG.en;

  async getTrackCounts(languageCode = 'en') {
    const tracks = AdminService.TRACKS_BY_LANG[languageCode] ?? [];
    const language = await this.languageRepo.findOne({
      where: { code: languageCode },
    });
    if (!language) return tracks.map((t) => ({ track: t, count: 0 }));
    const rows = await this.sentenceRepo
      .createQueryBuilder('s')
      .select("COALESCE(s.track, 'unset')", 'track')
      .addSelect('COUNT(*)', 'count')
      .where('s.isActive = true')
      .andWhere('s.languageId = :lid', { lid: language.id })
      .groupBy('track')
      .getRawMany();
    const map = new Map(rows.map((r) => [r.track, parseInt(r.count, 10)]));
    return tracks.map((t) => ({
      track: t,
      count: map.get(t) ?? 0,
    }));
  }

  async listSentences(params: {
    track?: string;
    q?: string;
    page?: number;
    limit?: number;
    languageCode?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const qb = this.sentenceRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.language', 'l');
    if (params.languageCode) {
      qb.andWhere('l.code = :code', { code: params.languageCode });
    }
    if (params.track) qb.andWhere('s.track = :track', { track: params.track });
    if (params.q?.trim()) {
      qb.andWhere(
        "(LOWER(s.text) LIKE :q OR LOWER(COALESCE(s.translation, '')) LIKE :q)",
        { q: `%${params.q.trim().toLowerCase()}%` },
      );
    }
    qb.orderBy('s.id', 'DESC');
    const [rows, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      items: rows.map((s) => ({
        id: s.id,
        text: s.text,
        translation: s.translation,
        pronunciation: s.pronunciation,
        situation: s.situation,
        difficulty: s.difficulty,
        category: s.category,
        track: s.track,
        languageCode: s.language?.code ?? null,
        isActive: s.isActive,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getSentenceForEdit(id: number) {
    const s = await this.sentenceRepo.findOne({ where: { id } });
    if (!s) return null;
    return {
      id: s.id,
      text: s.text,
      translation: s.translation,
      pronunciation: s.pronunciation,
      situation: s.situation,
      difficulty: s.difficulty,
      category: s.category,
      track: s.track,
      isActive: s.isActive,
    };
  }

  async createSentence(input: {
    text: string;
    translation: string;
    track: string;
    languageCode?: string;
    pronunciation?: string | null;
    situation?: string | null;
    difficulty?: string | null;
    category?: string | null;
    words?:
      | string
      | Array<{ w?: string; m?: string; word?: string; meaning?: string }>;
  }) {
    if (!input.text?.trim() || !input.translation?.trim()) {
      throw new Error('text and translation are required');
    }
    const code = input.languageCode || 'en';
    const language = await this.languageRepo.findOne({
      where: { code },
    });
    if (!language) throw new Error(`Language row missing: ${code}`);

    const existing = await this.sentenceRepo.findOne({
      where: { languageId: language.id, text: input.text.trim() },
    });
    if (existing) {
      return { ...existing, created: false };
    }

    const created = await this.sentenceRepo.save({
      languageId: language.id,
      text: input.text.trim(),
      translation: input.translation.trim(),
      pronunciation: input.pronunciation?.trim() || undefined,
      situation: input.situation?.trim() || undefined,
      difficulty: (input.difficulty as Difficulty) || Difficulty.BEGINNER,
      category: input.category?.trim() || undefined,
      track: input.track,
      isActive: true,
    });
    const words = this.parseWordList(input.words);
    for (let i = 0; i < words.length; i++) {
      await this.wordRepo.save({
        sentenceId: created.id,
        word: words[i].word,
        meaning: words[i].meaning,
        orderIndex: i,
      });
    }
    return { ...created, created: true, wordsAdded: words.length };
  }

  async updateSentence(
    id: number,
    patch: {
      text?: string;
      translation?: string;
      pronunciation?: string | null;
      situation?: string | null;
      difficulty?: string | null;
      category?: string | null;
      track?: string;
      isActive?: boolean;
    },
  ) {
    const s = await this.sentenceRepo.findOne({ where: { id } });
    if (!s) return null;
    Object.assign(s, {
      ...(patch.text !== undefined && { text: patch.text }),
      ...(patch.translation !== undefined && {
        translation: patch.translation,
      }),
      ...(patch.pronunciation !== undefined && {
        pronunciation: patch.pronunciation,
      }),
      ...(patch.situation !== undefined && { situation: patch.situation }),
      ...(patch.difficulty !== undefined && {
        difficulty: patch.difficulty as Difficulty,
      }),
      ...(patch.category !== undefined && { category: patch.category }),
      ...(patch.track !== undefined && { track: patch.track }),
      ...(patch.isActive !== undefined && { isActive: patch.isActive }),
    });
    return this.sentenceRepo.save(s);
  }

  async deleteSentence(id: number) {
    // Soft delete: keep history but pull from rotations. Daily assignments
    // / learning progress still reference this row, so the audit trail is
    // preserved.
    const s = await this.sentenceRepo.findOne({ where: { id } });
    if (!s) return null;
    s.isActive = false;
    return this.sentenceRepo.save(s);
  }

  /**
   * Hard-delete a sentence and all dependent learning history. Wrapped
   * in a transaction so a partial failure doesn't leave orphans. Words /
   * grammar notes / quiz rows go via ON DELETE CASCADE; daily_assignment
   * and learning_progress need explicit deletes because their FKs are
   * RESTRICT (we never wanted them disappearing silently).
   */
  async hardDeleteSentence(id: number) {
    const exists = await this.sentenceRepo.findOne({ where: { id } });
    if (!exists) return { deleted: false };
    await this.sentenceRepo.manager.transaction(async (tx) => {
      await tx.query(
        'DELETE FROM ll_learning_progress WHERE sentence_id = $1',
        [id],
      );
      await tx.query(
        'DELETE FROM ll_daily_assignments WHERE sentence_id = $1',
        [id],
      );
      await tx.query('DELETE FROM ll_sentences WHERE id = $1', [id]);
    });
    return { deleted: true };
  }

  /**
   * Bulk-insert a list of sentence rows. Idempotent: rows whose `text`
   * is already in the language pool are skipped. Used by the CSV
   * uploader on the admin page.
   *
   * Optional `words` field on each row carries the per-sentence word
   * cards. Two encodings are accepted:
   *   - JSON string: '[{"w":"bus","m":"버스"},{"w":"stop","m":"정류장"}]'
   *   - JSON array (already parsed): same shape
   * Unparseable values are ignored silently so a malformed words cell
   * never blocks the sentence itself from being inserted.
   */
  async bulkCreateSentences(
    track: string,
    rows: Array<{
      text: string;
      translation: string;
      pronunciation?: string | null;
      situation?: string | null;
      difficulty?: string | null;
      category?: string | null;
      words?:
        | string
        | Array<{ w?: string; m?: string; word?: string; meaning?: string }>;
    }>,
    languageCode = 'en',
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { inserted: 0, skipped: 0, errors: 0 };
    }
    const language = await this.languageRepo.findOne({
      where: { code: languageCode },
    });
    if (!language) throw new Error(`Language row missing: ${languageCode}`);

    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    let wordsAdded = 0;

    for (const row of rows) {
      try {
        if (!row.text?.trim() || !row.translation?.trim()) {
          errors += 1;
          continue;
        }
        const existing = await this.sentenceRepo.findOne({
          where: { languageId: language.id, text: row.text.trim() },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        const saved = await this.sentenceRepo.save({
          languageId: language.id,
          text: row.text.trim(),
          translation: row.translation.trim(),
          pronunciation: row.pronunciation?.trim() || undefined,
          situation: row.situation?.trim() || undefined,
          difficulty: (row.difficulty as Difficulty) || Difficulty.BEGINNER,
          category: row.category?.trim() || undefined,
          track,
          isActive: true,
        });

        const words = this.parseWordList(row.words);
        for (let i = 0; i < words.length; i++) {
          await this.wordRepo.save({
            sentenceId: saved.id,
            word: words[i].word,
            meaning: words[i].meaning,
            orderIndex: i,
          });
          wordsAdded += 1;
        }
        inserted += 1;
      } catch {
        errors += 1;
      }
    }
    return { inserted, skipped, errors, total: rows.length, wordsAdded };
  }

  private parseWordList(
    raw:
      | string
      | undefined
      | null
      | Array<{ w?: string; m?: string; word?: string; meaning?: string }>,
  ): Array<{ word: string; meaning: string }> {
    if (!raw) return [];
    let arr: any[];
    if (Array.isArray(raw)) {
      arr = raw;
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      try {
        arr = JSON.parse(trimmed);
      } catch {
        return [];
      }
      if (!Array.isArray(arr)) return [];
    } else {
      return [];
    }
    const out: Array<{ word: string; meaning: string }> = [];
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const word = String(item.w ?? item.word ?? '').trim();
      const meaning = String(item.m ?? item.meaning ?? '').trim();
      if (!word || !meaning) continue;
      out.push({ word, meaning });
    }
    return out;
  }

  // ───────────────────────── 퀴즈 문제 풀 (구독자 전용) ────────────────────
  //
  // 운영자가 문장별로 다양한 문제를 손으로 추가하는 흐름. 단어 활용형과
  // 같은 패턴: 문장 N개를 뽑아 AI 프롬프트를 만들어주고, 응답 JSON
  // (sentenceId/type/question/answer 배열)을 붙여넣어 origin='admin'으로
  // 일괄 저장. 저장된 문제는 프리미엄 일일/복습 퀴즈 풀에 섞여 랜덤 출제.

  private static readonly QUIZ_TYPES = [
    'fill_blank',
    'word_order',
    'translation',
    'multiple_choice',
  ];

  /**
   * 트랙/언어로 문장을 뽑아 AI 프롬프트를 생성. onlyMissing=true면 아직
   * admin 문제 풀이 없는 문장만 — 커버리지 채우기용.
   */
  async getQuizPromptBatch(params: {
    track?: string;
    languageCode?: string;
    limit?: number;
    onlyMissing?: boolean;
  }) {
    const languageCode = params.languageCode ?? 'en';
    const language = await this.languageRepo.findOne({
      where: { code: languageCode },
    });
    if (!language) {
      throw new BadRequestException(`Language row missing: ${languageCode}`);
    }
    const limit = Math.min(Math.max(params.limit ?? 10, 1), 40);

    // 커버리지: 이 언어/트랙의 전체 문장 중 운영자 추가 문제(origin=admin)가
    // 들어간 문장 수 vs 아직 없는 문장 수. limit/onlyMissing과 무관하게
    // 전체 기준으로 센다.
    const coverageBase = () => {
      const qb = this.sentenceRepo
        .createQueryBuilder('s')
        .where('s.languageId = :lid', { lid: language.id })
        .andWhere('s.isActive = true');
      if (params.track) qb.andWhere('s.track = :track', { track: params.track });
      return qb;
    };
    const total = await coverageBase().getCount();
    const withAdmin = await coverageBase()
      .andWhere(
        `EXISTS (SELECT 1 FROM ll_quizzes q WHERE q.sentence_id = s.id AND q.origin = 'admin')`,
      )
      .getCount();
    const coverage = { total, withAdmin, missing: total - withAdmin };

    // 1:N(words) 조인 + LIMIT은 TypeORM 페이지네이션 함정이라 id만 먼저
    // 뽑고 words는 별도 로드.
    const idQb = this.sentenceRepo
      .createQueryBuilder('s')
      .select('s.id', 'id')
      .where('s.languageId = :lid', { lid: language.id })
      .andWhere('s.isActive = true');
    if (params.track) idQb.andWhere('s.track = :track', { track: params.track });
    if (params.onlyMissing) {
      idQb.andWhere(
        `NOT EXISTS (SELECT 1 FROM ll_quizzes q WHERE q.sentence_id = s.id AND q.origin = 'admin')`,
      );
    }
    const idRows = await idQb
      .orderBy('s.orderIndex', 'ASC')
      .addOrderBy('s.id', 'ASC')
      .limit(limit)
      .getRawMany();
    const ids = idRows.map((r) => Number(r.id));
    if (ids.length === 0) {
      return {
        count: 0,
        languageCode,
        track: params.track ?? null,
        prompt: '',
        coverage,
      };
    }
    const sentences = await this.sentenceRepo.find({
      where: { id: In(ids) },
      relations: ['words'],
    });
    const byId = new Map(sentences.map((s) => [s.id, s]));
    const items = ids
      .map((id) => byId.get(id))
      .filter((s): s is Sentence => !!s)
      .map((s) => ({
        sentenceId: s.id,
        text: s.text,
        translation: s.translation,
        words: (s.words ?? [])
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((w) => ({ w: w.word, m: w.meaning })),
      }));

    return {
      count: items.length,
      languageCode,
      track: params.track ?? null,
      prompt: this.buildQuizPrompt(items, languageCode),
      coverage,
    };
  }

  private buildQuizPrompt(
    items: Array<{
      sentenceId: number;
      text: string;
      translation: string;
      words: Array<{ w: string; m: string }>;
    }>,
    languageCode: string,
  ): string {
    const langLabel = languageCode === 'ja' ? '일본어' : '영어';
    const data = JSON.stringify(items, null, 2);
    return `당신은 ${langLabel} 학습 앱의 퀴즈 출제자입니다.
아래 [문장 목록]의 각 문장에 대해, 학습자가 풀 **다양한** 퀴즈 문제를 만들어 주세요.
★출제 규칙: 각 문장마다 **4개 type(fill_blank·word_order·translation·multiple_choice)을 모두**,
**type별로 정확히 2문제씩 = 한 문장당 총 8문제**를 만드세요. type이 빠지거나 개수가 어긋나면 안 됩니다.

출력은 **JSON 배열 하나만** (설명/마크다운 없이). 각 원소 형식:
{
  "sentenceId": <문장의 sentenceId 숫자 그대로>,
  "type": "fill_blank" | "word_order" | "translation" | "multiple_choice",
  "question": { ... },   // type별 형식 아래 참고
  "answer": { ... }      // type별 형식 아래 참고
}

[type별 question/answer 형식]  (아래 예시는 영어 기준 — 실제로는 위 문장의 언어(${langLabel})로 작성)

1) fill_blank (빈칸 채우기) — 문장에서 핵심 단어 1개를 빈칸으로 가림
   question: { "sentence": "She was _____ to see you", "hint": "<가린 단어의 뜻>", "translation": "<문장의 모국어 번역>" }
   answer:   { "word": "<가린 단어 1개>", "fullSentence": "<원문 전체>" }
   · ★필수: question.sentence는 원문에서 answer.word를 **반드시 ASCII 밑줄 5개 \`_____\`로 치환**한 문자열.
     - sentence 안에 \`_____\`(밑줄)가 **반드시 1곳 이상** 있어야 함. 빠뜨리면 무효.
     - 가린 단어(answer.word)를 sentence에 그대로 남겨두지 말 것(이미 \`_____\`로 바뀌어 있어야 함).
     - 밑줄은 일반 ASCII \`_\` 만. 전각(＿)·대괄호([ ])·점(...)·중괄호 같은 다른 기호 금지.
   · answer.word는 그 빈칸에 들어갈 단어 하나(대소문자 무관 채점), 원문에 실제로 등장하는 단어여야 함.

2) word_order (단어 배열) — 토큰을 섞어 제시, 학습자가 순서를 맞춤
   question: { "words": ["happy","She","was"], "translation": "<모국어 번역>" }   // correctOrder를 섞은 것
   answer:   { "correctOrder": ["She","was","happy"], "fullSentence": "<원문 전체>" }
   · ★가장 중요: words는 correctOrder와 "완전히 같은 토큰 묶음"을 순서만 바꾼 것이어야 함
     — 토큰 개수·철자 동일, 추가/누락/구두점 차이 금지. 어기면 학습자가 정답을 만들 수 없음.
   · correctOrder = 원문을 구두점 없이 공백으로 나눈 순서. 정답 순서가 하나로 정해지는 문장만 사용.
   · 토큰 2개 이상.

3) translation (번역) — 모국어 번역을 보고 ${langLabel} 문장 입력
   question: { "translation": "<모국어 번역>" }
   answer:   { "text": "<해당 문장의 원문 그대로>", "acceptableVariations": ["<허용 소문자 변형들>"] }
   · text는 위 목록의 원문(text)을 사용. 대소문자·구두점·사소한 오타는 채점 시 허용됨.

4) multiple_choice (단어 뜻 고르기) — 보기 4개 중 정답 1개
   question: { "word": "<대상 단어>", "context": "<원문 문장>", "options": ["<뜻1>","<뜻2>","<뜻3>","<뜻4>"] }
   answer:   { "correctIndex": 0, "correctMeaning": "<정답 뜻>" }
   · options는 모두 "모국어 뜻". 정답 1개 + 그럴듯하지만 명백히 틀린 오답 3개.
   · correctIndex = options에서 정답의 위치(0부터 숫자). correctMeaning = options[correctIndex].

규칙:
- 출력은 JSON 배열 하나만. 코드펜스/설명/주석 없이, 유효한 JSON(끝 콤마 금지).
- sentenceId·correctIndex는 따옴표 없는 숫자. type은 위 4개 snake_case 문자열 그대로.
- sentenceId는 아래 목록의 값만 사용(새로 만들지 말 것).
- 한 문장당 4개 type × 2문제씩 = 정확히 8문제. type별 2문제는 서로 다른 단어/빈칸/보기로 구성(중복 금지).

[문장 목록]
${data}`;
  }

  /**
   * AI가 만든 문제 배열을 origin='admin'으로 일괄 저장. 잘못된 형식은
   * 건너뛰고 사유를 errorDetails로 반환. 같은 문장+type+question(JSON
   * 동일)인 기존 admin 문제는 skip(재붙여넣기 멱등성).
   */
  async bulkCreateQuizProblems(
    rows: Array<{
      sentenceId?: number;
      type?: string;
      question?: any;
      answer?: any;
    }>,
    dryRun = false,
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return {
        inserted: 0,
        skipped: 0,
        errors: 0,
        total: 0,
        errorDetails: [],
        dryRun,
      };
    }
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails: Array<{
      index: number;
      reason: string;
      sentenceId?: number;
    }> = [];

    const sentenceCache = new Map<number, boolean>();
    const sentenceExists = async (id: number): Promise<boolean> => {
      if (sentenceCache.has(id)) return sentenceCache.get(id)!;
      const cnt = await this.sentenceRepo.count({ where: { id } });
      const exists = cnt > 0;
      sentenceCache.set(id, exists);
      return exists;
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const sentenceId = Number(row?.sentenceId);
        if (!Number.isInteger(sentenceId) || sentenceId <= 0) {
          errors += 1;
          errorDetails.push({ index: i, reason: 'sentenceId 누락/형식 오류' });
          continue;
        }
        const type = String(row?.type ?? '');
        if (!AdminService.QUIZ_TYPES.includes(type)) {
          errors += 1;
          errorDetails.push({ index: i, sentenceId, reason: `알 수 없는 type: ${type}` });
          continue;
        }
        if (!(await sentenceExists(sentenceId))) {
          errors += 1;
          errorDetails.push({
            index: i,
            sentenceId,
            reason: `존재하지 않는 sentenceId: ${sentenceId}`,
          });
          continue;
        }
        const validation = this.validateQuizPayload(
          type,
          row.question,
          row.answer,
        );
        if (!validation.ok) {
          errors += 1;
          errorDetails.push({ index: i, sentenceId, reason: validation.reason });
          continue;
        }

        const existing = await this.quizRepo.find({
          where: { sentenceId, type: type as QuizType, origin: 'admin' },
        });
        const sig = JSON.stringify(validation.question);
        if (existing.some((q) => JSON.stringify(q.question) === sig)) {
          skipped += 1;
          continue;
        }

        // dryRun(검증)일 때는 저장하지 않고 "입력될 예정"으로만 카운트.
        if (!dryRun) {
          await this.quizRepo.save({
            sentenceId,
            type: type as QuizType,
            question: validation.question,
            answer: validation.answer,
            origin: 'admin',
          });
        }
        inserted += 1;
      } catch (e) {
        errors += 1;
        errorDetails.push({
          index: i,
          sentenceId: Number(row?.sentenceId) || undefined,
          reason: (e as Error)?.message ?? '알 수 없는 오류',
        });
      }
    }
    return { inserted, skipped, errors, total: rows.length, errorDetails, dryRun };
  }

  /** type별 question/answer 최소 형식 검증 + 정규화. */
  private validateQuizPayload(
    type: string,
    question: any,
    answer: any,
  ):
    | { ok: true; question: Record<string, any>; answer: Record<string, any> }
    | { ok: false; reason: string } {
    const isObj = (v: any) =>
      v && typeof v === 'object' && !Array.isArray(v);
    if (!isObj(question)) return { ok: false, reason: 'question 객체 누락' };
    if (!isObj(answer)) return { ok: false, reason: 'answer 객체 누락' };

    switch (type) {
      case 'fill_blank': {
        if (typeof answer.word !== 'string' || !answer.word.trim()) {
          return { ok: false, reason: 'fill_blank: answer.word 필요' };
        }
        const BLANK = '_____';
        const rawSentence =
          typeof question.sentence === 'string' ? question.sentence : '';
        const fullSentence =
          typeof answer.fullSentence === 'string' ? answer.fullSentence : '';
        if (!rawSentence.trim() && !fullSentence.trim()) {
          return { ok: false, reason: 'fill_blank: question.sentence 필요' };
        }

        // 1) 이미 빈칸류 마커가 있으면 표준 _____ 로 정규화. 밑줄 2개+,
        //    전각 밑줄(＿), 빈 (대)괄호 등 AI가 흔히 쓰는 변형을 모두 수용.
        const blankRe = /_{2,}|＿{2,}|\[\s*\]|\(\s*\)|（\s*）/;
        if (blankRe.test(rawSentence)) {
          return {
            ok: true,
            question: { ...question, sentence: rawSentence.replace(blankRe, BLANK) },
            answer,
          };
        }

        // 2) 마커가 없으면 answer.word를 직접 가린다. question.sentence →
        //    answer.fullSentence 순으로 시도(둘 중 단어가 있는 쪽 사용).
        const w = answer.word.trim();
        const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reWord = new RegExp(`\\b${esc}\\b`, 'i'); // 라틴어 단어경계
        const reLoose = new RegExp(esc, 'i'); // 일본어 등 비라틴 폴백
        for (const src of [rawSentence, fullSentence]) {
          if (!src) continue;
          if (reWord.test(src)) {
            return {
              ok: true,
              question: { ...question, sentence: src.replace(reWord, BLANK) },
              answer,
            };
          }
          if (src.toLowerCase().includes(w.toLowerCase())) {
            return {
              ok: true,
              question: { ...question, sentence: src.replace(reLoose, BLANK) },
              answer,
            };
          }
        }
        return {
          ok: false,
          reason: `fill_blank: 빈칸 마커도 없고 answer.word("${w}")가 문장/원문에 없어 자동 보정 불가`,
        };
      }
      case 'word_order': {
        if (!Array.isArray(question.words) || question.words.length < 2) {
          return { ok: false, reason: 'word_order: question.words(2개+) 필요' };
        }
        if (!Array.isArray(answer.correctOrder) || answer.correctOrder.length < 2) {
          return { ok: false, reason: 'word_order: answer.correctOrder 필요' };
        }
        // 앱은 question.words 칩만 재배열해 제출하므로, words가 correctOrder의
        // 순열(같은 토큰, 순서만 다름)이 아니면 학습자가 절대 정답을 못 만든다.
        // 채점 grader도 정확 일치라 여기서 막아야 함.
        const norm = (a: any[]) =>
          a.map((x) => String(x).toLowerCase()).sort();
        const wTokens = norm(question.words);
        const cTokens = norm(answer.correctOrder);
        if (
          wTokens.length !== cTokens.length ||
          wTokens.some((x, i) => x !== cTokens[i])
        ) {
          return {
            ok: false,
            reason:
              'word_order: question.words가 answer.correctOrder의 순서만 바꾼 토큰이 아님(개수/철자 불일치)',
          };
        }
        return { ok: true, question, answer };
      }
      case 'translation': {
        if (typeof question.translation !== 'string' || !question.translation.trim()) {
          return { ok: false, reason: 'translation: question.translation 필요' };
        }
        if (typeof answer.text !== 'string' || !answer.text.trim()) {
          return { ok: false, reason: 'translation: answer.text 필요' };
        }
        if (!Array.isArray(answer.acceptableVariations)) {
          answer.acceptableVariations = [answer.text.toLowerCase()];
        }
        return { ok: true, question, answer };
      }
      case 'multiple_choice': {
        if (!Array.isArray(question.options) || question.options.length < 2) {
          return { ok: false, reason: 'multiple_choice: question.options(2개+) 필요' };
        }
        const ci = answer.correctIndex;
        if (!Number.isInteger(ci) || ci < 0 || ci >= question.options.length) {
          return { ok: false, reason: 'multiple_choice: answer.correctIndex 범위 오류' };
        }
        return { ok: true, question, answer };
      }
      default:
        return { ok: false, reason: `알 수 없는 type: ${type}` };
    }
  }

  // ───────────────────────── 단어 활용형 (word forms) ─────────────────────
  //
  // backstage 단어 페이지가 사용. ll_words(콘텐츠 카드)에서 distinct
  // (word, language)를 모아 ll_word_forms 커버리지와 join. 운영자가 빈
  // 칸을 보면 "데이터 채우기"로 AI에 보낼 프롬프트를 만들어주고, 응답
  // JSON을 받아 bulkUpsert로 일괄 import. MVP는 100% 수동 워크플로우.

  /**
   * ll_words의 distinct (word, language)를 페이지네이션해서 반환, 각
   * 행에 forms 채워졌는지 여부와 등장 횟수 포함.
   */
  async listWordFormCoverage(params: {
    q?: string;
    coverage?: 'all' | 'missing' | 'filled';
    page?: number;
    limit?: number;
  }) {
    // NaN/음수 방어 — controller에서 parseInt가 실패하면 NaN이 들어옴.
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(500, Math.max(10, Number(params.limit) || 50));
    const offset = (page - 1) * limit;
    const coverage = params.coverage ?? 'all';
    const q = (params.q ?? '').trim();

    // ll_words에서 DISTINCT (LOWER(word), language_id) + occurrences COUNT
    // + ll_word_forms LEFT JOIN으로 hasForm 판단. LOWER 정규화 — "Run"과
    // "run"이 따로 잡히지 않게.
    const whereParts: string[] = ['s."isActive" = true'];
    const bind: any[] = [];
    if (q) {
      bind.push(`%${q.toLowerCase()}%`);
      whereParts.push(`LOWER(w.word) ILIKE $${bind.length}`);
    }
    let coverageHaving = '';
    if (coverage === 'missing') coverageHaving = 'HAVING MAX(wf.id) IS NULL';
    else if (coverage === 'filled')
      coverageHaving = 'HAVING MAX(wf.id) IS NOT NULL';

    const sql = `
      SELECT
        LOWER(w.word) AS "baseWord",
        s.language_id AS "languageId",
        l.code AS "languageCode",
        COUNT(*)::int AS "occurrences",
        MAX(wf.id) AS "wordFormId",
        MAX(wf."partOfSpeech") AS "partOfSpeech",
        MAX(wf.meaning) AS "meaning"
      FROM ll_words w
      JOIN ll_sentences s ON w.sentence_id = s.id
      JOIN ll_languages l ON s.language_id = l.id
      LEFT JOIN ll_word_forms wf
        ON REPLACE(REPLACE(wf."baseWord", '‘', ''''), '’', '''') = REPLACE(REPLACE(LOWER(w.word), '‘', ''''), '’', '''') AND wf.language_id = s.language_id
      WHERE ${whereParts.join(' AND ')}
      GROUP BY LOWER(w.word), s.language_id, l.code
      ${coverageHaving}
      ORDER BY "occurrences" DESC, "baseWord" ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const totalSql = `
      SELECT COUNT(*)::int AS total FROM (
        SELECT 1
        FROM ll_words w
        JOIN ll_sentences s ON w.sentence_id = s.id
        LEFT JOIN ll_word_forms wf
          ON REPLACE(REPLACE(wf."baseWord", '‘', ''''), '’', '''') = REPLACE(REPLACE(LOWER(w.word), '‘', ''''), '’', '''') AND wf.language_id = s.language_id
        WHERE ${whereParts.join(' AND ')}
        GROUP BY LOWER(w.word), s.language_id
        ${coverageHaving}
      ) t
    `;
    const items = await this.wordRepo.query(sql, bind);
    const [{ total }] = await this.wordRepo.query(totalSql, bind);

    return {
      items: items.map((r: any) => ({
        baseWord: r.baseWord,
        languageId: r.languageId,
        languageCode: r.languageCode,
        occurrences: r.occurrences,
        hasForm: r.wordFormId != null,
        partOfSpeech: r.partOfSpeech ?? null,
        meaning: r.meaning ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * 단어 활용형 사전 1건 상세. (baseWord, languageCode) 키. examples는
   * { en, ko } 형태로 정규화 — 구버전 string도 ko 빈 칸으로 변환해
   * backstage UI가 단일 분기로 렌더.
   *
   * 등장 횟수(occurrences)도 같이 반환 — "이 단어가 콘텐츠에 N회
   * 쓰이고 있어요"를 detail 화면에서 안내.
   */
  async getWordFormDetail(baseWord: string, languageCode = 'en') {
    const base = String(baseWord ?? '')
      .trim()
      .toLowerCase();
    if (!base) return null;
    const lang = await this.languageRepo.findOne({
      where: { code: languageCode.toLowerCase() },
    });
    if (!lang) return null;
    const wf = await this.wordFormRepo.findOne({
      where: { baseWord: base, languageId: lang.id },
    });

    // 등장 횟수는 wf가 없어도 의미 있음 — 미생성 단어 detail에서도
    // "이 단어는 콘텐츠에 N번 쓰임" 안내.
    const occRows: Array<{ count: number }> = await this.wordRepo.query(
      `SELECT COUNT(*)::int AS count
       FROM ll_words w JOIN ll_sentences s ON w.sentence_id = s.id
       WHERE LOWER(w.word) = $1 AND s.language_id = $2`,
      [base, lang.id],
    );
    const occurrences = occRows[0]?.count ?? 0;

    // examples 정규화 — 구버전 string도 { en, ko='' }로 변환.
    let examples: Record<string, { en: string; ko: string }> | null = null;
    if (wf?.examples) {
      examples = {};
      for (const [k, raw] of Object.entries(wf.examples)) {
        if (raw == null) continue;
        if (typeof raw === 'string') {
          if (raw.trim()) examples[k] = { en: raw.trim(), ko: '' };
        } else if (typeof raw === 'object') {
          const en = String((raw as any).en ?? '').trim();
          const ko = String((raw as any).ko ?? '').trim();
          if (en) examples[k] = { en, ko };
        }
      }
      if (Object.keys(examples).length === 0) examples = null;
    }

    // 노이즈 제거: noun인데 base와 singular surface가 동일하면 base 키
    // 제거 (예전 프롬프트로 채워진 데이터가 둘 다 가지고 있어 detail
    // 모달에 '원형' 카드가 중복으로 떴음).
    let forms = wf?.forms ?? null;
    if (
      forms &&
      wf?.partOfSpeech === 'noun' &&
      forms.base &&
      forms.singular &&
      String(forms.base).toLowerCase() ===
        String(forms.singular).toLowerCase()
    ) {
      const { base: _base, ...rest } = forms;
      forms = rest;
      if (examples?.base) {
        const { base: _ex, ...exRest } = examples;
        examples = Object.keys(exRest).length ? exRest : null;
      }
    }

    return {
      baseWord: base,
      languageCode: lang.code,
      occurrences,
      // wf가 없으면 forms/examples만 null. UI는 "아직 데이터 없음" 안내.
      hasForm: wf != null,
      partOfSpeech: wf?.partOfSpeech ?? null,
      meaning: wf?.meaning ?? null,
      forms,
      examples,
      source: wf?.source ?? null,
      updatedAt: wf?.updatedAt ?? null,
    };
  }

  /**
   * 다음 batch의 forms 미생성 단어들 + AI에 그대로 붙여넣을 수 있는
   * 표준 프롬프트를 반환. backstage "데이터 채우기" 버튼이 호출.
   */
  async getWordFormBatch(limit: number, languageCode = 'en') {
    // 100개 batch는 AI 응답 토큰 한도를 초과해 JSON이 중간에 잘림.
    // 한영 예문까지 들어가니까 단어당 응답 부피가 크고, 10개가 안전한
    // sweet spot. 운영자가 빠르게 여러 번 돌려 채우는 패턴이 더 robust.
    const cap = Math.min(30, Math.max(1, limit || 10));
    // 다언어 — 특정 언어의 미존재 활용형만. 클라가 EN/JA 탭으로 전환.
    const rows: Array<{
      baseWord: string;
      languageCode: string;
      occurrences: number;
    }> = await this.wordRepo.query(
      `
      SELECT
        LOWER(w.word) AS "baseWord",
        l.code AS "languageCode",
        COUNT(*)::int AS "occurrences"
      FROM ll_words w
      JOIN ll_sentences s ON w.sentence_id = s.id
      JOIN ll_languages l ON s.language_id = l.id
      LEFT JOIN ll_word_forms wf
        ON REPLACE(REPLACE(wf."baseWord", '‘', ''''), '’', '''') = REPLACE(REPLACE(LOWER(w.word), '‘', ''''), '’', '''') AND wf.language_id = s.language_id
      WHERE s."isActive" = true AND wf.id IS NULL AND l.code = $2
      GROUP BY LOWER(w.word), l.code
      ORDER BY COUNT(*) DESC, LOWER(w.word) ASC
      LIMIT $1
      `,
      [cap, languageCode],
    );

    return {
      count: rows.length,
      words: rows,
      languageCode,
      prompt:
        languageCode === 'ja'
          ? this.buildJaWordFormPrompt(rows)
          : this.buildWordFormPrompt(rows),
    };
  }

  /**
   * 일본어 단어 활용형 프롬프트. 영어 동사 시제(past/pastParticiple/etc.)
   * 대신 일본어 활용 5종(辞書형·과거た·て형·부정ない·정중ます)으로 매핑.
   * 예문은 일본어로 작성, 한국어 번역 동반.
   */
  private buildJaWordFormPrompt(
    rows: Array<{ baseWord: string; languageCode: string }>,
  ): string {
    const wordList = rows.map((r) => r.baseWord).join(', ');
    return `다음 일본어 단어들의 활용형과 예문을 JSON 배열로 출력해줘. 한국인 일본어
학습자가 단어장에서 보는 사전이므로, 모든 출력은 정확하고 자연스러워야 함.

# 작성 규칙

1. **품사 판별**: "verb" | "i_adjective" | "na_adjective" | "noun" | "adverb" | "other"
   - 다의어(예: いる(있다/필요하다), かける(걸다/곱하다), とる(잡다/찍다))는
     **가장 흔한 일상 의미** 하나만 기준으로 품사·뜻·예문 작성.
   - 동사는 사전형(辞書形). 食べる, 行く, する, 来る 등
   - **명사+する 복합동사**(勉強する, 練習する, 説明する)는 verb로 분류하고
     5종 모두 채움 (勉強する/勉強した/勉強して/勉強しない/勉強します).
   - "い"로 끝나는 형용사 → "i_adjective" (寒い, 大きい, 楽しい)
   - "な"로 활용되는 형용사 → "na_adjective" (静か, 元気, 便利)
     ※ base에는 어간만 (な 빼고). "静かな"가 아니라 "静か".
   - 명사는 "noun" (学校, 本, 新聞).
     **카타카나 외래어**(コーヒー, テレビ, パソコン)와 **고유명사**
     (東京, 日本, 田中)도 noun으로 분류 (forms는 { base }만).
   - 부사는 "adverb" (とても, すぐ, ちょっと)
   - 관용표현/그 외는 "other", forms는 { "base": 그대로 }

2. **활용형 (forms)** — 일본어는 영어와 달리 5종 활용이 핵심.
   - verb: { base, past, te, negative, polite }
     · base       : 사전형 (食べる, 行く, する)
     · past       : た형 (食べた, 行った, した)
     · te         : て형 (食べて, 行って, して)
     · negative   : ない형 (食べない, 行かない, しない)
     · polite     : ます형 (食べます, 行きます, します)
     - 5단동사/1단동사/불규칙(する·来る) 모두 정확히. "行きった" 같은
       오류 절대 금지. 「来る」→「来た/来て/来ない/来ます」, 「する」→
       「した/して/しない/します」 같은 불규칙 활용 그대로 사용.
   - i_adjective: { base, past, te, negative, polite }
     · 寒い: base="寒い", past="寒かった", te="寒くて",
       negative="寒くない", polite="寒いです"
     - te형은 매우 빈번 ("寒くて眠れない", "おいしくて止まらない")이라
       반드시 채울 것.
   - na_adjective: { base, past, negative, polite }
     · 静か: base="静か", past="静かだった",
       negative="静かじゃない", polite="静かです"
     - 어간(base)에 な 붙이지 말 것. "きれいな"가 아니라 "きれい".
   - noun: { base } (일본어는 단복수 구분 없음)
   - adverb: { base }
   - other: { base }

3. **예문 (examples)** — forms 각 키마다 { en, ko } 한 쌍씩.
   - **en 필드에는 자연스러운 일본어 예문** (시스템 통일 위해 키 이름은
     en/ko로 유지하되, en에는 일본어 문장).
   - 8~15자 정도, 일상에서 자주 듣는 자연스러운 표현.
   - 동사라면 활용형이 실제로 그 모양으로 사용되는 자연스러운 문맥.
   - **주어를 다양하게** — 「私/彼/彼女/田中さん/うちの子/友達/部長」 등
     골고루. 「私は…」로만 시작하지 말 것.
   - **단순 정의문 금지** — 「X は Y です」 같은 사전식 문장 피하기.
   - 좋은 예: "公園で犬と走っています。"
   - 나쁜 예: "私は走る。" (너무 형식적), "走るは英語でrunです。" (정의문)
   - **ko**: 그 일본어 예문의 자연스러운 한국어 번역. 직역 X, 의역으로
     실제 상황에서 한국어 화자가 쓸 법한 문장.

4. **meaning**: 한국어 뜻 1~3단어. 가장 흔한 의미 하나만.
   (예: "食べる" → "먹다", "学校" → "학교", "寒い" → "춥다", "静か" → "조용한")

5. **languageCode**: 모두 "ja"

# 출력 형식

마크다운/주석/코드블록 없이 순수 JSON 배열만:

[
  {
    "baseWord": "食べる",
    "languageCode": "ja",
    "partOfSpeech": "verb",
    "meaning": "먹다",
    "forms": {
      "base": "食べる",
      "past": "食べた",
      "te": "食べて",
      "negative": "食べない",
      "polite": "食べます"
    },
    "examples": {
      "base": { "en": "毎日朝ごはんを食べる。", "ko": "매일 아침을 먹어요." },
      "past": { "en": "昨日友達とラーメンを食べた。", "ko": "어제 친구랑 라멘 먹었어요." },
      "te": { "en": "ご飯を食べて出かけた。", "ko": "밥 먹고 외출했어요." },
      "negative": { "en": "うちの子は野菜を食べない。", "ko": "우리 애는 채소를 안 먹어요." },
      "polite": { "en": "私はパンを食べます。", "ko": "저는 빵을 먹습니다." }
    }
  },
  {
    "baseWord": "寒い",
    "languageCode": "ja",
    "partOfSpeech": "i_adjective",
    "meaning": "춥다",
    "forms": {
      "base": "寒い",
      "past": "寒かった",
      "te": "寒くて",
      "negative": "寒くない",
      "polite": "寒いです"
    },
    "examples": {
      "base": { "en": "今日は本当に寒い。", "ko": "오늘은 정말 추워요." },
      "past": { "en": "昨日の夜はかなり寒かった。", "ko": "어젯밤은 꽤 추웠어요." },
      "te": { "en": "寒くてなかなか眠れない。", "ko": "추워서 좀처럼 잠이 안 와요." },
      "negative": { "en": "思ったほど寒くないね。", "ko": "생각만큼 안 춥네요." },
      "polite": { "en": "外は少し寒いです。", "ko": "밖은 조금 춥습니다." }
    }
  },
  {
    "baseWord": "静か",
    "languageCode": "ja",
    "partOfSpeech": "na_adjective",
    "meaning": "조용한",
    "forms": {
      "base": "静か",
      "past": "静かだった",
      "negative": "静かじゃない",
      "polite": "静かです"
    },
    "examples": {
      "base": { "en": "ここはいつも静かな場所だ。", "ko": "여기는 항상 조용한 곳이에요." },
      "past": { "en": "昨日の図書館は静かだった。", "ko": "어제 도서관은 조용했어요." },
      "negative": { "en": "週末のカフェは静かじゃない。", "ko": "주말 카페는 조용하지 않아요." },
      "polite": { "en": "この公園は朝が静かです。", "ko": "이 공원은 아침이 조용해요." }
    }
  },
  {
    "baseWord": "学校",
    "languageCode": "ja",
    "partOfSpeech": "noun",
    "meaning": "학교",
    "forms": { "base": "学校" },
    "examples": {
      "base": { "en": "学校までバスで行きます。", "ko": "학교까지 버스로 갑니다." }
    }
  }
]

# 단어 리스트 (${rows.length}개)
${wordList}`;
  }

  /**
   * AI에 한 번에 입력할 표준 프롬프트. 출력은 순수 JSON 배열만 받도록
   * 강제 — 마크다운/설명 포함되면 bulkUpsert 파싱에서 실패함.
   *
   * 한국 학습자가 단어장에서 보는 사전이라 품질이 중요. 다의어 가이드,
   * 불규칙 활용형 안전망, 자연스러움 기준, 세 가지 품사 예시를
   * 모두 명시해 textbook-stiff한 영어가 나오지 않도록 함.
   */
  private buildWordFormPrompt(
    rows: Array<{ baseWord: string; languageCode: string }>,
  ): string {
    const wordList = rows.map((r) => r.baseWord).join(', ');
    return `다음 영어 단어들의 활용형과 예문을 JSON 배열로 출력해줘. 한국인 영어
학습자가 단어장에서 보는 사전이므로, 모든 출력은 정확하고 자연스러워야 함.

# 작성 규칙

1. **품사 판별**: "verb" | "noun" | "adjective" | "adverb" | "other"
   - 다의어(예: run, book, light)는 **가장 흔한 일상 의미** 기준
   - 고유명사(이름·지명·브랜드)는 "other", forms는 { "base": 그대로 }
   - phrasal verb("run out"처럼 공백 포함)는 "other", forms는 { "base": 그대로 }

2. **활용형 (forms)**
   - verb: { base, past, pastParticiple, presentParticiple, thirdPersonSingular }
     - 불규칙 동사 주의: go→went/gone, eat→ate/eaten, buy→bought
     - "runned", "goed" 같은 가짜 형태는 절대 금지
   - noun: { singular, plural } — base 키는 넣지 말 것 (singular와 동일해
     중복). 단수형이 그대로 원형 역할.
     - 불가산 명사(information, advice, water)는 plural을 null
     - 불규칙 복수(child→children, mouse→mice) 정확히
   - adjective: { base, comparative, superlative }
     - 음절 많은 형용사는 "more X", "most X" 그대로 사용
   - adverb: { base } (비교급 있으면 comparative/superlative 추가)
   - other: { base }

3. **예문 (examples)** — forms 각 키마다 { en, ko } 한 쌍씩
   - **자연스러운 일상 영어 (en)**. 교과서 같은 딱딱한 문장 금지.
   - 5~12단어. 너무 짧지도 길지도 않게.
   - 주어를 다양하게 (I/she/he/we/the kids/my friend 등 골고루)
   - 단순 정의문 ("X means Y") 금지
   - 좋은 예: "She's been running late all week."
   - 나쁜 예: "I am running.", "Running is good."
   - **ko**: 그 영어 예문의 자연스러운 한국어 번역. 직역 X, 의역으로
     실제 상황에서 한국어 화자가 쓸 법한 문장. 학습자가 단어 뜻과
     문맥을 같이 이해하도록.

4. **meaning**: 한국어 뜻 1~3단어. 가장 흔한 의미 하나만.
   (예: "run" → "달리다", "apple" → "사과", "beautiful" → "아름다운")

5. **languageCode**: 모두 "en"

# 출력 형식

마크다운/주석/코드블록 없이 순수 JSON 배열만:

[
  {
    "baseWord": "run",
    "languageCode": "en",
    "partOfSpeech": "verb",
    "meaning": "달리다",
    "forms": {
      "base": "run",
      "past": "ran",
      "pastParticiple": "run",
      "presentParticiple": "running",
      "thirdPersonSingular": "runs"
    },
    "examples": {
      "base": { "en": "I run every morning before work.", "ko": "나는 매일 아침 출근 전에 달려요." },
      "past": { "en": "She ran into her ex at the cafe.", "ko": "그녀는 카페에서 전 남친을 우연히 마주쳤어요." },
      "pastParticiple": { "en": "He has run that route many times.", "ko": "그는 그 코스를 여러 번 달려봤어요." },
      "presentParticiple": { "en": "The kids are running around the yard.", "ko": "아이들이 마당에서 뛰어다니고 있어요." },
      "thirdPersonSingular": { "en": "My dog runs faster than yours.", "ko": "우리 강아지가 너희 집보다 빨라요." }
    }
  },
  {
    "baseWord": "apple",
    "languageCode": "en",
    "partOfSpeech": "noun",
    "meaning": "사과",
    "forms": { "singular": "apple", "plural": "apples" },
    "examples": {
      "singular": { "en": "I packed an apple for lunch.", "ko": "점심으로 사과 하나 챙겼어요." },
      "plural": { "en": "These apples are from my grandma's garden.", "ko": "이 사과들 할머니 텃밭에서 가져온 거예요." }
    }
  },
  {
    "baseWord": "beautiful",
    "languageCode": "en",
    "partOfSpeech": "adjective",
    "meaning": "아름다운",
    "forms": {
      "base": "beautiful",
      "comparative": "more beautiful",
      "superlative": "most beautiful"
    },
    "examples": {
      "base": { "en": "That's a beautiful sunset.", "ko": "저 노을 정말 아름답네요." },
      "comparative": { "en": "Her dress is more beautiful than mine.", "ko": "그녀 드레스가 제 것보다 더 예뻐요." },
      "superlative": { "en": "It was the most beautiful day of the trip.", "ko": "여행 중 제일 좋은 날이었어요." }
    }
  }
]

# 단어 리스트 (${rows.length}개)
${wordList}`;
  }

  /**
   * AI 응답 JSON을 받아 일괄 upsert. (baseWord, languageId) 충돌 시
   * 갱신. 행 단위 실패는 errors 카운트만 올리고 다음 행 계속 처리.
   */
  async bulkUpsertWordForms(
    rows: Array<{
      baseWord?: string;
      languageCode?: string;
      partOfSpeech?: string;
      meaning?: string | null;
      forms?: Record<string, string | null>;
      // 신규: { en, ko } per key. 구버전: 'string' (영어만) — 둘 다 허용.
      examples?: Record<
        string,
        { en?: string | null; ko?: string | null } | string | null
      > | null;
      source?: string;
    }>,
    defaultSource = 'manual',
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { inserted: 0, updated: 0, errors: 0, errorDetails: [] };
    }

    // language 사전 캐싱 — 같은 코드 반복 조회 방지.
    const langCache = new Map<string, number>();
    const resolveLang = async (code: string): Promise<number | null> => {
      const c = (code || 'en').toLowerCase();
      if (langCache.has(c)) return langCache.get(c)!;
      const row = await this.languageRepo.findOne({ where: { code: c } });
      if (!row) return null;
      langCache.set(c, row.id);
      return row.id;
    };

    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: Array<{ index: number; reason: string }> = [];
    // 다언어 — JA 프롬프트(buildJaWordFormPrompt)가 'i_adjective'/'na_adjective'
    // 로 출력하므로 화이트리스트에 포함. 'adjective'는 EN 호환 유지.
    const allowedPOS = new Set([
      'verb',
      'noun',
      'adjective',
      'adverb',
      'other',
      'i_adjective',
      'na_adjective',
    ]);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        // curly 아포스트로피(U+2019/U+2018)를 ASCII U+0027로 정규화.
        // AI/사용자 paste가 smart quotes로 들어오면 ll_words.word(보통
        // straight)와 JOIN이 안 잡혀 admin 페이지에서 "누락"으로만 보임.
        const base = String(r.baseWord ?? '')
          .replace(/[‘’]/g, "'")
          .trim()
          .toLowerCase();
        const pos = String(r.partOfSpeech ?? '')
          .trim()
          .toLowerCase();
        if (!base) throw new Error('baseWord 비어 있음');
        if (!allowedPOS.has(pos))
          throw new Error(`partOfSpeech 무효: "${pos}"`);
        if (!r.forms || typeof r.forms !== 'object' || Array.isArray(r.forms))
          throw new Error('forms가 object가 아님');

        const langId = await resolveLang(r.languageCode ?? 'en');
        if (!langId)
          throw new Error(`알 수 없는 languageCode: "${r.languageCode}"`);

        // forms / examples null 키 제거 (DB에 null 박지 않음). forms 값에도
        // smart quotes가 박혀있으면 클라 inverse 검색(jsonb_each_text)이
        // 어긋나므로 동일하게 ASCII '로 정규화.
        const cleanForms: Record<string, string> = {};
        for (const [k, v] of Object.entries(r.forms)) {
          if (v != null && String(v).trim()) {
            cleanForms[k] = String(v).replace(/[‘’]/g, "'").trim();
          }
        }
        if (Object.keys(cleanForms).length === 0)
          throw new Error('forms이 비어 있음 (유효한 키 없음)');
        // 예문은 신규 { en, ko } 또는 구버전 string 둘 다 허용. DB엔 항상
        // { en, ko } 형태로 저장 (ko 없으면 빈 문자열). 클라에서 단일
        // 분기로 읽을 수 있게 정규화.
        let cleanExamples:
          | Record<string, { en: string; ko: string }>
          | null = null;
        if (
          r.examples &&
          typeof r.examples === 'object' &&
          !Array.isArray(r.examples)
        ) {
          cleanExamples = {};
          for (const [k, raw] of Object.entries(r.examples)) {
            if (raw == null) continue;
            let en = '';
            let ko = '';
            if (typeof raw === 'string') {
              en = raw.trim();
            } else if (typeof raw === 'object' && !Array.isArray(raw)) {
              en = String(raw.en ?? '').trim();
              ko = String(raw.ko ?? '').trim();
            }
            if (en) cleanExamples[k] = { en, ko };
          }
          if (Object.keys(cleanExamples).length === 0) cleanExamples = null;
        }

        const existing = await this.wordFormRepo.findOne({
          where: { baseWord: base, languageId: langId },
        });
        if (existing) {
          existing.partOfSpeech = pos;
          existing.meaning = r.meaning?.trim() || null;
          existing.forms = cleanForms;
          existing.examples = cleanExamples;
          existing.source = r.source || defaultSource;
          await this.wordFormRepo.save(existing);
          updated += 1;
        } else {
          await this.wordFormRepo.save({
            baseWord: base,
            languageId: langId,
            partOfSpeech: pos,
            meaning: r.meaning?.trim() || null,
            forms: cleanForms,
            examples: cleanExamples,
            source: r.source || defaultSource,
          });
          inserted += 1;
        }
      } catch (e) {
        errors += 1;
        errorDetails.push({
          index: i,
          reason: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return {
      inserted,
      updated,
      errors,
      total: rows.length,
      errorDetails: errorDetails.slice(0, 20),
    };
  }

  async listPushes(params: {
    type?: string;
    status?: string;
    userId?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const qb = this.pushLogRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'u');

    if (params.type) qb.andWhere('p.pushType = :type', { type: params.type });
    if (params.status) qb.andWhere('p.status = :s', { s: params.status });
    if (params.userId) qb.andWhere('p.userId = :uid', { uid: params.userId });
    if (params.q?.trim()) {
      qb.andWhere(
        "(LOWER(u.email) LIKE :q OR LOWER(COALESCE(u.nickname, '')) LIKE :q)",
        { q: `%${params.q.trim().toLowerCase()}%` },
      );
    }
    qb.orderBy('p.sentAt', 'DESC');

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return {
      items: items.map((p) => ({
        id: p.id,
        userId: p.userId,
        userLabel: p.user?.nickname || p.user?.email || p.userId,
        pushType: p.pushType,
        title: p.title,
        body: p.body,
        status: p.status,
        sentAt: this.formatDate(p.sentAt),
        tappedAt: p.tappedAt ? this.formatDate(p.tappedAt) : null,
        contentId: p.contentId,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async listInquiries(params: {
    category?: string;
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(200, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const qb = this.inquiryRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.user', 'u')
      .orderBy('i.createdAt', 'DESC');

    if (params.category) {
      qb.andWhere('i.category = :category', { category: params.category });
    }
    if (params.status) {
      qb.andWhere('i.status = :status', { status: params.status });
    }
    if (params.q?.trim()) {
      qb.andWhere(
        `(
          LOWER(COALESCE(i.email, '')) LIKE :q OR
          LOWER(i.message) LIKE :q OR
          LOWER(COALESCE(u.email, '')) LIKE :q OR
          LOWER(COALESCE(u.nickname, '')) LIKE :q
        )`,
        { q: `%${params.q.trim().toLowerCase()}%` },
      );
    }

    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    const userIds = items
      .map((i) => i.userId)
      .filter((id): id is string => Boolean(id));
    const [subscriptions, devices, settings, assignmentStats, quizStats] =
      userIds.length
        ? await Promise.all([
            this.subscriptionRepo.find({ where: { userId: In(userIds) } }),
            this.deviceTokenRepo.find({
              where: { userId: In(userIds) },
              order: { updatedAt: 'DESC' as const },
            }),
            this.notificationSettingsRepo.find({
              where: { userId: In(userIds) },
            }),
            this.assignmentRepo
              .createQueryBuilder('a')
              .select('a.userId', 'userId')
              .addSelect('COUNT(*)::int', 'total')
              .addSelect(
                'SUM(CASE WHEN a.isCompleted = true THEN 1 ELSE 0 END)::int',
                'completed',
              )
              .where('a.userId IN (:...userIds)', { userIds })
              .groupBy('a.userId')
              .getRawMany<{
                userId: string;
                total: number;
                completed: number;
              }>(),
            this.quizAttemptRepo
              .createQueryBuilder('qz')
              .select('qz.userId', 'userId')
              .addSelect('COUNT(*)::int', 'total')
              .addSelect(
                'SUM(CASE WHEN qz.isCorrect = true THEN 1 ELSE 0 END)::int',
                'correct',
              )
              .where('qz.userId IN (:...userIds)', { userIds })
              .groupBy('qz.userId')
              .getRawMany<{
                userId: string;
                total: number;
                correct: number;
              }>(),
          ])
        : await Promise.resolve([
            [] as Subscription[],
            [] as DeviceToken[],
            [] as NotificationSettings[],
            [] as { userId: string; total: number; completed: number }[],
            [] as { userId: string; total: number; correct: number }[],
          ]);
    const subscriptionMap = new Map(subscriptions.map((s) => [s.userId, s]));
    const devicesByUser = this.groupBy(devices, (d) => d.userId);
    const settingsMap = new Map(settings.map((s) => [s.userId, s]));
    const assignmentMap = new Map(assignmentStats.map((s) => [s.userId, s]));
    const quizMap = new Map(quizStats.map((s) => [s.userId, s]));

    return {
      items: items.map((i) => ({
        ...this.serializeInquiryForAdmin(
          i,
          subscriptionMap.get(i.userId ?? ''),
          devicesByUser.get(i.userId ?? '') ?? [],
          settingsMap.get(i.userId ?? ''),
          assignmentMap.get(i.userId ?? ''),
          quizMap.get(i.userId ?? ''),
        ),
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Admin이 문의에 답변 작성. inquiriesService에 위임 — 거기서
   * status 업데이트 + 답변 사용자에게 푸시까지 한 번에 처리.
   */
  async replyToInquiry(
    adminUsername: string,
    inquiryId: number,
    reply: string,
  ) {
    return this.inquiriesService.addReply(inquiryId, reply, adminUsername);
  }

  private serializeInquiryForAdmin(
    i: Inquiry,
    subscription?: Subscription,
    devices: DeviceToken[] = [],
    settings?: NotificationSettings,
    assignmentStats?: { total: number; completed: number },
    quizStats?: { total: number; correct: number },
  ) {
    const quizTotal = Number(quizStats?.total ?? 0);
    const quizCorrect = Number(quizStats?.correct ?? 0);
    return {
      id: i.id,
      userId: i.userId,
      userLabel:
        i.user?.nickname || i.user?.email || i.email || i.userId || '-',
      category: i.category,
      status: i.status,
      email: i.email,
      message: i.message,
      ipAddress: i.ipAddress,
      userAgent: i.userAgent,
      reply: i.reply,
      repliedAt: i.repliedAt ? this.formatDate(i.repliedAt) : null,
      repliedBy: i.repliedBy,
      userReadAt: i.userReadAt ? this.formatDate(i.userReadAt) : null,
      createdAt: this.formatDate(i.createdAt),
      user: i.user
        ? {
            id: i.user.id,
            email: i.user.email,
            nickname: i.user.nickname,
            provider: i.user.provider,
            targetLanguage: i.user.targetLanguage,
            nativeLanguage: i.user.nativeLanguage,
            timezone: i.user.timezone,
            learningTrack: i.user.learningTrack,
            dailyGoal: (i.user as any).dailyGoal,
            subscriptionTier: i.user.subscriptionTier,
            isActive: i.user.isActive,
            deletedAt: i.user.deletedAt
              ? this.formatDate(i.user.deletedAt)
              : null,
            createdAt: this.formatDate(i.user.createdAt),
          }
        : null,
      subscription: subscription
        ? {
            store: subscription.store,
            productId: subscription.productId,
            plan: subscription.plan,
            isActive: subscription.isActive,
            expiresAt: subscription.expiresAt
              ? this.formatDate(subscription.expiresAt)
              : null,
            autoRenew: subscription.autoRenew,
            environment: subscription.environment,
            inTrial: subscription.inTrial,
            revokedAt: subscription.revokedAt
              ? this.formatDate(subscription.revokedAt)
              : null,
          }
        : null,
      settings: settings
        ? {
            isEnabled: settings.isEnabled,
            frequencyMinutes: settings.frequencyMinutes,
            activeStartTime: settings.activeStartTime,
            activeEndTime: settings.activeEndTime,
            timezone: settings.timezone,
            wordPushRatio: settings.wordPushRatio,
            nextPushAt: settings.nextPushAt
              ? this.formatDate(settings.nextPushAt)
              : null,
            updatedAt: this.formatDate(settings.updatedAt),
          }
        : null,
      devices: devices.map((d) => ({
        id: d.id,
        platform: d.platform,
        isActive: d.isActive,
        // 문의 리스트의 부가정보 — 식별만 가능하게 끝 8자.
        token: d.token ? `…${d.token.slice(-8)}` : '',
        createdAt: this.formatDate(d.createdAt),
        updatedAt: this.formatDate(d.updatedAt),
      })),
      stats: {
        totalAssignments: Number(assignmentStats?.total ?? 0),
        completedAssignments: Number(assignmentStats?.completed ?? 0),
        quizAttempts: quizTotal,
        quizCorrect,
        quizAccuracy: quizTotal
          ? Math.round((quizCorrect / quizTotal) * 100)
          : 0,
      },
    };
  }

  /**
   * Idempotent: upserts languages and inserts only sentences whose `text`
   * is not already present. Append to `englishSentences` (seed-data file)
   * and re-run `POST /api/admin/seed` to grow the pool toward 1000+.
   */
  async seed() {
    // Upsert languages (don't duplicate on re-run).
    let english = await this.languageRepo.findOne({ where: { code: 'en' } });
    if (!english) {
      english = await this.languageRepo.save({
        code: 'en',
        name: 'English',
        nativeName: '영어',
      });
    }
    let japanese = await this.languageRepo.findOne({ where: { code: 'ja' } });
    if (!japanese) {
      japanese = await this.languageRepo.save({
        code: 'ja',
        name: 'Japanese',
        nativeName: '일본어',
      });
    }

    // 언어별 dataset 분리 — 같은 sentence repo지만 language_id가 달라서
    // 같은 텍스트가 다른 언어로 동시에 들어가는 건 허용(보통 안 발생하지만
    // 영문 표현 일부가 JA seed에 차용된 케이스 등). 중복 체크는 같은 언어
    // 내에서만 본다.
    const enData = [...this.getEnglishSentences(), ...englishSentences];
    const jaData = japaneseSentences;
    const enSeen = new Set<string>();
    const enDataset = enData.filter((s) => {
      const key = s.text.trim();
      if (enSeen.has(key)) return false;
      enSeen.add(key);
      return true;
    });
    const jaSeen = new Set<string>();
    const jaDataset = jaData.filter((s) => {
      const key = s.text.trim();
      if (jaSeen.has(key)) return false;
      jaSeen.add(key);
      return true;
    });

    // Skip texts already in the DB so re-runs only add new ones —
    // 언어별로 따로 (같은 text가 EN/JA 양쪽에 있을 수 있으니).
    const existing = await this.sentenceRepo.find({
      select: ['text', 'languageId'],
    });
    const existingByLang = new Map<number, Set<string>>();
    for (const s of existing) {
      if (!existingByLang.has(s.languageId)) {
        existingByLang.set(s.languageId, new Set());
      }
      existingByLang.get(s.languageId)!.add(s.text.trim());
    }
    const enExisting = existingByLang.get(english.id) ?? new Set<string>();
    const jaExisting = existingByLang.get(japanese.id) ?? new Set<string>();

    const maxOrder = await this.sentenceRepo
      .createQueryBuilder('s')
      .select('COALESCE(MAX(s.orderIndex), -1)', 'max')
      .getRawOne();
    let orderIndex = parseInt(maxOrder?.max ?? '-1', 10) + 1;

    let addedEn = 0;
    let addedJa = 0;
    const seedOne = async (
      data: any,
      langId: number,
      existingSet: Set<string>,
    ): Promise<boolean> => {
      if (existingSet.has(data.text.trim())) return false;
      const sentence = await this.sentenceRepo.save({
        languageId: langId,
        text: data.text,
        translation: data.translation,
        pronunciation: data.pronunciation,
        situation: data.situation,
        difficulty: data.difficulty as Difficulty,
        category: data.category,
        track: data.track ?? data.difficulty,
        orderIndex: orderIndex++,
      });
      for (let i = 0; i < (data.words?.length ?? 0); i++) {
        await this.wordRepo.save({
          sentenceId: sentence.id,
          ...data.words[i],
          orderIndex: i,
        });
      }
      for (let i = 0; i < (data.grammarNotes?.length ?? 0); i++) {
        await this.grammarNoteRepo.save({
          sentenceId: sentence.id,
          ...data.grammarNotes[i],
          orderIndex: i,
        });
      }
      return true;
    };

    for (const data of enDataset) {
      if (await seedOne(data, english.id, enExisting)) addedEn++;
    }
    for (const data of jaDataset) {
      if (await seedOne(data, japanese.id, jaExisting)) addedJa++;
    }

    const total = await this.sentenceRepo.count();
    const added = addedEn + addedJa;
    this.logger.log(
      `Seed: +${added} new sentences (en=${addedEn}, ja=${addedJa}, total ${total})`,
    );
    return {
      message: 'Seed completed',
      added,
      addedByLanguage: { en: addedEn, ja: addedJa },
      total,
    };
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
        billingEnabled: false,
      });
      config = await this.appConfigRepo.save(config);
    }
    return config;
  }

  /**
   * Aggregate dashboard for the /backstage/subscriptions page.
   * Pulls everything in parallel from ll_subscriptions + ll_subscription_events
   * so the page renders with one round trip.
   *
   * Revenue is an estimate at the headline price (₩3,900) — store
   * payouts in the Apple/Play consoles are authoritative, this view
   * is for product/growth gut-checking.
   */
  async getSubscriptionDashboard(
    envFilter: 'production' | 'sandbox' | 'all' = 'production',
  ) {
    const MONTHLY_KRW = 3900;
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const dayMs = 86_400_000;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * dayMs);

    // env-filter clause for raw queries that JOIN ll_subscriptions.
    // `all` skips the filter (NULL match included so legacy rows with
    // no env survive). All event-based counts need this so sandbox
    // testing doesn't pollute production numbers.
    const envClause =
      envFilter === 'all'
        ? ''
        : envFilter === 'sandbox'
          ? `AND s.environment = 'sandbox'`
          : `AND (s.environment = 'production' OR s.environment IS NULL)`;

    const [
      activeRow,
      trialRow,
      newThisMonthRow,
      refundsThisMonthRow,
      timelineRows,
      recentEvents,
      breakdownByStore,
    ] = await Promise.all([
      // Active premium = users currently paying. Counted via the
      // subscription row (not user.subscriptionTier) so we can filter
      // by environment — user table doesn't carry env info.
      // Note: PG lowercases unquoted identifiers; camelCase columns
      // (subscriptionTier, isActive, deletedAt) need double quotes.
      this.subscriptionRepo.query(
        `SELECT COUNT(DISTINCT u.id)::int AS n
           FROM ll_users u
           INNER JOIN ll_subscriptions s ON s.user_id = u.id
          WHERE u."subscriptionTier" = 'premium'
            AND u."deletedAt" IS NULL
            AND u."isActive" = true
            AND s."isActive" = true
            ${envClause}`,
      ),

      this.subscriptionRepo.query(
        `SELECT COUNT(*)::int AS n
           FROM ll_subscriptions s
          WHERE s."isActive" = true
            AND s.in_trial = true
            ${envClause}`,
      ),

      // "신규" = distinct subscriptions whose FIRST verify event landed
      // this month. /verify is called on every purchase + restore + app
      // launch retry, so counting raw events overcounts massively.
      // JOIN with ll_subscriptions to filter by environment so sandbox
      // testing doesn't pollute production numbers.
      this.subscriptionEventRepo.query(
        `SELECT COUNT(*)::int AS n FROM (
            SELECT e.subscription_id, MIN(e.occurred_at) AS first_at
            FROM ll_subscription_events e
            INNER JOIN ll_subscriptions s ON s.id = e.subscription_id
            WHERE e.outcome = 'applied'
              AND e.source IN ('apple_verify','play_verify')
              AND e.subscription_id IS NOT NULL
              ${envClause}
            GROUP BY e.subscription_id
          ) t WHERE t.first_at >= $1`,
        [monthStart],
      ),

      // Refunds: dedupe per subscription per environment.
      this.subscriptionEventRepo.query(
        `SELECT COUNT(DISTINCT e.subscription_id)::int AS n
           FROM ll_subscription_events e
           INNER JOIN ll_subscriptions s ON s.id = e.subscription_id
          WHERE e.outcome = 'applied'
            AND e.occurred_at >= $1
            AND e.subscription_id IS NOT NULL
            AND (e.source = 'google_voided'
                 OR e.event_type LIKE 'REFUND%'
                 OR e.event_type LIKE 'REVOKE%')
            ${envClause}`,
        [monthStart],
      ),

      // 30-day timeline (KST day). Each metric dedupes per
      // subscription per day + filters by env so sandbox can be
      // toggled separately.
      this.subscriptionEventRepo.query(
        `WITH ev AS (
           SELECT
             to_char((e.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day,
             e.subscription_id,
             e.outcome,
             e.source,
             e.event_type,
             e.occurred_at,
             s.environment
           FROM ll_subscription_events e
           INNER JOIN ll_subscriptions s ON s.id = e.subscription_id
           WHERE e.occurred_at >= $1
             ${envClause}
         ),
         first_verify AS (
           SELECT e.subscription_id, MIN(e.occurred_at) AS first_at
           FROM ll_subscription_events e
           INNER JOIN ll_subscriptions s ON s.id = e.subscription_id
           WHERE e.outcome='applied'
             AND e.source IN ('apple_verify','play_verify')
             AND e.subscription_id IS NOT NULL
             ${envClause}
           GROUP BY e.subscription_id
         ),
         days AS (
           SELECT DISTINCT day FROM ev
         )
         SELECT
           d.day,
           (SELECT COUNT(DISTINCT fv.subscription_id)::int
              FROM first_verify fv
             WHERE to_char((fv.first_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') = d.day
           ) AS new_count,
           (SELECT COUNT(DISTINCT subscription_id)::int FROM ev
             WHERE day = d.day
               AND outcome='applied'
               AND subscription_id IS NOT NULL
               AND (event_type = 'DID_RENEW' OR event_type LIKE 'DID_RENEW/%' OR (source='google_webhook' AND event_type = '2'))
           ) AS renew_count,
           (SELECT COUNT(DISTINCT subscription_id)::int FROM ev
             WHERE day = d.day
               AND outcome='applied'
               AND subscription_id IS NOT NULL
               AND (event_type LIKE 'REFUND%' OR event_type LIKE 'REVOKE%' OR source='google_voided')
           ) AS refund_count
         FROM days d
         ORDER BY d.day ASC`,
        [thirtyDaysAgo],
      ),

      // Recent events feed — JOIN to pull environment so the UI can
      // label each row. Filter by env so production view doesn't show
      // sandbox events (which were the bulk of "47 신규" noise).
      this.subscriptionEventRepo.query(
        `SELECT e.id, e.user_id, e.source, e.event_type, e.outcome,
                e.outcome_reason, e.product_id, e.original_transaction_id,
                e.occurred_at, s.environment
           FROM ll_subscription_events e
           LEFT JOIN ll_subscriptions s ON s.id = e.subscription_id
          WHERE 1=1 ${envClause.replace(/^AND/, 'AND')}
          ORDER BY e.occurred_at DESC
          LIMIT 50`,
      ),

      this.subscriptionRepo.query(
        `SELECT s.store, COUNT(*)::int AS count
           FROM ll_subscriptions s
          WHERE s."isActive" = true
            ${envClause}
          GROUP BY s.store`,
      ),
    ]);

    // All count queries return [{n: number}] from raw SQL; unwrap.
    const unwrap = (row: any) =>
      Number((row as Array<{ n: number }>)?.[0]?.n ?? 0);
    const activePremium = unwrap(activeRow);
    const inTrial = unwrap(trialRow);
    const newThisMonth = unwrap(newThisMonthRow);
    const refundsThisMonth = unwrap(refundsThisMonthRow);
    const grossRevenueKrw = newThisMonth * MONTHLY_KRW;
    const refundedKrw = refundsThisMonth * MONTHLY_KRW;
    const netRevenueKrw = grossRevenueKrw - refundedKrw;

    return {
      envFilter,
      kpi: {
        activePremium,
        inTrial,
        newThisMonth,
        refundsThisMonth,
        grossRevenueKrw,
        refundedKrw,
        netRevenueKrw,
      },
      timeline: (timelineRows ?? []).map((r: any) => ({
        day: r.day,
        new: Number(r.new_count),
        renew: Number(r.renew_count),
        refund: Number(r.refund_count),
      })),
      breakdownByStore: (breakdownByStore ?? []).map((r: any) => ({
        store: r.store,
        count: Number(r.count),
      })),
      // recentEvents now comes from a raw query (snake_case fields)
      // so we can include environment per row.
      recentEvents: (recentEvents ?? []).map((e: any) => ({
        occurredAt: this.formatDate(e.occurred_at),
        userId: e.user_id,
        source: e.source,
        eventType: e.event_type,
        outcome: e.outcome,
        outcomeReason: e.outcome_reason,
        productId: e.product_id,
        environment: e.environment,
        txnIdTail: e.original_transaction_id
          ? String(e.original_transaction_id).slice(-8)
          : null,
      })),
    };
  }

  /**
   * Paginated verification log — events with outcome != 'applied' so
   * ops can quickly spot stuck verifications, unknown tokens, past-
   * cycle refunds, etc. Default filter is "everything not applied".
   */
  async getVerificationLog(
    page = 1,
    limit = 50,
    outcomeFilter?: string,
    sourceFilter?: string,
  ) {
    const qb = this.subscriptionEventRepo
      .createQueryBuilder('e')
      .orderBy('e.occurredAt', 'DESC');

    if (outcomeFilter) {
      qb.andWhere('e.outcome = :outcome', { outcome: outcomeFilter });
    } else {
      qb.andWhere(`e.outcome != 'applied'`);
    }
    if (sourceFilter) {
      qb.andWhere('e.source = :source', { source: sourceFilter });
    }

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items: items.map((e) => ({
        id: e.id,
        occurredAt: this.formatDate(e.occurredAt),
        userId: e.userId,
        source: e.source,
        eventType: e.eventType,
        outcome: e.outcome,
        outcomeReason: e.outcomeReason,
        notificationUuid: e.notificationUuid,
        productId: e.productId,
        txnIdTail: e.originalTransactionId
          ? e.originalTransactionId.slice(-8)
          : null,
        payload: e.payload,
      })),
    };
  }

  /**
   * Manually extend (or create) a user's premium subscription by `days`.
   * Used by support to compensate for incidents or honour external
   * promotions. Stacks on top of any existing expiry — if the user
   * already has 5 days left and admin grants 30, new expiry is now+35d
   * (not now+30d), so we never accidentally shorten a paid sub.
   *
   * If the user is currently subscribed via app_store/play_store, we
   * keep the store column unchanged and just bump expiresAt. The
   * provider webhook will continue to update store-specific fields
   * (autoRenew, productId) as usual. If there's no existing row, we
   * create one with store='admin_grant'.
   */
  async grantPremium(
    adminUsername: string,
    userId: string,
    days: number,
    reason?: string,
  ) {
    if (!Number.isFinite(days) || days <= 0 || days > 3650) {
      throw new BadRequestException(
        'days는 1 이상 3650 이하의 숫자여야 합니다.',
      );
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('대상 유저를 찾을 수 없습니다.');
    }

    const existing = await this.subscriptionRepo.findOne({
      where: { userId },
    });

    const now = new Date();
    const base =
      existing?.expiresAt && existing.expiresAt.getTime() > now.getTime()
        ? existing.expiresAt
        : now;
    const newExpiry = new Date(base.getTime() + days * 86_400_000);

    let subscription: Subscription;
    if (!existing) {
      subscription = this.subscriptionRepo.create({
        userId,
        plan: 'premium',
        store: 'admin_grant',
        productId: 'lingoloop_premium_monthly',
        expiresAt: newExpiry,
        isActive: true,
        autoRenew: false,
        environment: 'production',
        inTrial: false,
        revokedAt: null,
      });
      subscription = await this.subscriptionRepo.save(subscription);
    } else {
      // Preserve real store/productId so the provider webhook keeps
      // updating correctly. Only fill in if the row was a placeholder.
      const storeIsPlaceholder =
        !existing.store ||
        existing.store === 'none' ||
        existing.store === 'mock';
      await this.subscriptionRepo.update(
        { id: existing.id },
        {
          plan: 'premium',
          expiresAt: newExpiry,
          isActive: true,
          revokedAt: null,
          ...(storeIsPlaceholder
            ? {
                store: 'admin_grant',
                productId: existing.productId ?? 'lingoloop_premium_monthly',
              }
            : {}),
        },
      );
      subscription = (await this.subscriptionRepo.findOne({
        where: { id: existing.id },
      }))!;
    }

    await this.userRepo.update(
      { id: userId, deletedAt: IsNull(), isActive: true },
      { subscriptionTier: 'premium' },
    );

    await this.subscriptionEventRepo.insert({
      userId,
      subscriptionId: subscription.id,
      source: 'admin_grant',
      eventType: 'admin_grant',
      productId: subscription.productId,
      outcome: 'applied',
      outcomeReason: reason ?? null,
      payload: {
        admin: adminUsername,
        days,
        previousExpiresAt: existing?.expiresAt?.toISOString() ?? null,
        newExpiresAt: newExpiry.toISOString(),
        store: subscription.store,
      } as any,
    });

    this.logger.log(
      `Admin grant: ${adminUsername} gave ${days}d premium to ${userId} → ${newExpiry.toISOString()}`,
    );

    // 인앱 사용자에게도 즉시 반영되도록 silent push.
    await this.pingSubscriptionUpdated(userId);

    // 다른 admin들에게도 운영 이벤트 알림. adminUsername은 push 본문엔
    // 노출하지 않고 data(extra)로만 전달 — 운영자 트레이에 누가 했는지
    // 같은 admin 사이에서만 보이는 정보가 노출되는 걸 피하기 위함.
    const userLabel = user.nickname?.trim() || user.email || userId;
    await this.notificationsService.notifyAdmins({
      title: '운영자 프리미엄 지급',
      body: `${userLabel} 회원에게 프리미엄 ${days}일이 지급되었습니다.`,
      eventType: 'admin_grant',
      extra: { userId, days: String(days), grantedBy: adminUsername },
    });

    return {
      subscription: {
        plan: subscription.plan,
        store: subscription.store,
        productId: subscription.productId,
        expiresAt: this.formatDate(subscription.expiresAt!),
        expiresAtIso: subscription.expiresAt!.toISOString(),
        isActive: subscription.isActive,
        autoRenew: subscription.autoRenew,
      },
    };
  }

  /**
   * Immediately ends a user's premium — sets expiresAt=now,
   * revokedAt=now, isActive=false, plan='free', user.subscriptionTier
   * ='free'. Used for refunds processed outside the store (e.g. a
   * chargeback we honoured manually) or to undo a mistaken grant.
   *
   * For genuine store refunds, prefer letting the webhook handle it —
   * this manual path doesn't notify the store and so won't propagate
   * to billing.
   */
  async revokePremium(adminUsername: string, userId: string, reason?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('대상 유저를 찾을 수 없습니다.');
    }

    const existing = await this.subscriptionRepo.findOne({
      where: { userId },
    });
    if (!existing) {
      throw new BadRequestException('해당 유저에게 구독 정보가 없습니다.');
    }

    const now = new Date();
    await this.subscriptionRepo.update(
      { id: existing.id },
      {
        expiresAt: now,
        revokedAt: now,
        isActive: false,
        plan: 'free',
        autoRenew: false,
      },
    );

    await this.userRepo.update(
      { id: userId, deletedAt: IsNull() },
      { subscriptionTier: 'free' },
    );

    await this.subscriptionEventRepo.insert({
      userId,
      subscriptionId: existing.id,
      source: 'admin_revoke',
      eventType: 'admin_revoke',
      productId: existing.productId,
      outcome: 'applied',
      outcomeReason: reason ?? null,
      payload: {
        admin: adminUsername,
        previousExpiresAt: existing.expiresAt?.toISOString() ?? null,
        previousStore: existing.store,
      } as any,
    });

    this.logger.log(
      `Admin revoke: ${adminUsername} revoked premium from ${userId} (reason: ${reason ?? '-'})`,
    );
    await this.pingSubscriptionUpdated(userId);

    const userLabel = user.nickname?.trim() || user.email || userId;
    await this.notificationsService.notifyAdmins({
      title: '운영자 프리미엄 회수',
      body: `${userLabel} 회원의 프리미엄이 회수되었습니다.${reason ? ` (${reason})` : ''}`,
      eventType: 'admin_revoke',
      extra: { userId, revokedBy: adminUsername },
    });

    return { revoked: true };
  }

  /**
   * 일반 user에 운영자 권한 부여/해제. isAdmin=true인 user는 신규
   * 문의/결제/환불/취소 이벤트가 발생할 때 본인 device token으로
   * 알림 받음 (NotificationsService.notifyAdmins). 일반 LingoLoop
   * 앱으로 로그인된 token을 그대로 활용 — 별도 admin 앱 없음.
   */
  async setAdminRole(adminUsername: string, userId: string, isAdmin: boolean) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('대상 유저를 찾을 수 없습니다.');
    }
    if (user.isAdmin === isAdmin) {
      // 이미 같은 상태면 no-op + 현재 값 반환.
      return { userId, isAdmin: user.isAdmin };
    }
    await this.userRepo.update({ id: userId }, { isAdmin });
    this.logger.log(
      `Admin role: ${adminUsername} set isAdmin=${isAdmin} on ${userId}`,
    );
    return { userId, isAdmin };
  }

  private groupBy<T>(items: T[], keyGetter: (item: T) => string) {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = keyGetter(item);
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }

  private rawCount(row: any): number {
    return parseInt(row?.count ?? '0', 10);
  }

  private kstDateString(date: Date): string {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split('T')[0];
  }

  private utcFromKstDate(date: string): Date {
    return new Date(`${date}T00:00:00+09:00`);
  }

  private async countActiveUsersSince(since: Date) {
    const [row] = await this.assignmentRepo.query(
      `
      SELECT COUNT(DISTINCT user_id)::int AS count
      FROM (
        SELECT user_id FROM ll_daily_assignments
          WHERE "createdAt" >= $1 OR completed_at >= $1
        UNION
        SELECT user_id FROM ll_quiz_attempts
          WHERE "attemptedAt" >= $1
        UNION
        SELECT user_id FROM ll_push_logs
          WHERE "tappedAt" >= $1
      ) active_users
      `,
      [since],
    );
    return row;
  }

  private async getSubscriptionFunnel(since: Date) {
    const sources = ['apple_verify', 'play_verify'];
    const [
      signupsRaw,
      verifyAttemptsRaw,
      verifyAttemptUsersRaw,
      verifyAppliedRaw,
      verifyAppliedUsersRaw,
      verifyProblemRaw,
      activePremiumRaw,
    ] = await Promise.all([
      this.userRepo
        .createQueryBuilder('u')
        .select('COUNT(*)', 'count')
        .where('u.createdAt >= :since', { since })
        .andWhere('u.deletedAt IS NULL')
        .getRawOne(),
      this.subscriptionEventRepo
        .createQueryBuilder('e')
        .select('COUNT(*)', 'count')
        .where('e.occurredAt >= :since', { since })
        .andWhere('e.source IN (:...sources)', { sources })
        .andWhere('e.eventType = :eventType', { eventType: 'verify' })
        .getRawOne(),
      this.subscriptionEventRepo
        .createQueryBuilder('e')
        .select('COUNT(DISTINCT e.userId)', 'count')
        .where('e.occurredAt >= :since', { since })
        .andWhere('e.source IN (:...sources)', { sources })
        .andWhere('e.eventType = :eventType', { eventType: 'verify' })
        .andWhere('e.userId IS NOT NULL')
        .getRawOne(),
      this.subscriptionEventRepo
        .createQueryBuilder('e')
        .select('COUNT(*)', 'count')
        .where('e.occurredAt >= :since', { since })
        .andWhere('e.source IN (:...sources)', { sources })
        .andWhere('e.eventType = :eventType', { eventType: 'verify' })
        .andWhere('e.outcome = :outcome', { outcome: 'applied' })
        .getRawOne(),
      this.subscriptionEventRepo
        .createQueryBuilder('e')
        .select('COUNT(DISTINCT e.userId)', 'count')
        .where('e.occurredAt >= :since', { since })
        .andWhere('e.source IN (:...sources)', { sources })
        .andWhere('e.eventType = :eventType', { eventType: 'verify' })
        .andWhere('e.outcome = :outcome', { outcome: 'applied' })
        .andWhere('e.userId IS NOT NULL')
        .getRawOne(),
      this.subscriptionEventRepo
        .createQueryBuilder('e')
        .select('COUNT(*)', 'count')
        .where('e.occurredAt >= :since', { since })
        .andWhere('e.source IN (:...sources)', { sources })
        .andWhere('e.eventType = :eventType', { eventType: 'verify' })
        .andWhere('e.outcome != :outcome', { outcome: 'applied' })
        .getRawOne(),
      this.subscriptionRepo
        .createQueryBuilder('s')
        .select('COUNT(*)', 'count')
        .where('s.isActive = true')
        .andWhere('s.plan = :plan', { plan: 'premium' })
        .getRawOne(),
    ]);

    const signups = this.rawCount(signupsRaw);
    const verifyAttempts = this.rawCount(verifyAttemptsRaw);
    const verifyAttemptUsers = this.rawCount(verifyAttemptUsersRaw);
    const verifyApplied = this.rawCount(verifyAppliedRaw);
    const verifyAppliedUsers = this.rawCount(verifyAppliedUsersRaw);
    const verifyProblem = this.rawCount(verifyProblemRaw);
    const activePremium = this.rawCount(activePremiumRaw);

    return {
      windowDays: 30,
      signups,
      verifyAttempts,
      verifyAttemptUsers,
      verifyApplied,
      verifyAppliedUsers,
      verifyProblem,
      activePremium,
      signupToVerifyRate:
        signups > 0 ? Math.round((verifyAttemptUsers / signups) * 100) : 0,
      verifySuccessRate:
        verifyAttempts > 0
          ? Math.round((verifyApplied / verifyAttempts) * 100)
          : 0,
      signupToPremiumRate:
        signups > 0 ? Math.round((verifyAppliedUsers / signups) * 100) : 0,
    };
  }

  /**
   * 통계 페이지(/backstage/stats) 백킹 데이터.
   *
   * 세 섹션 한 번에 묶음 — 페이지 로드 시 한 번의 fetch로 끝나고, SQL은
   * 각각 가벼움. 무거워지면 분리해도 됨.
   *
   * 1) OS별 가입자 — user.lastPlatform 기준. 신규 가입 후 한 번도 로그인
   *    재시도 안 한 유저는 null (대부분 'unknown'으로 모임).
   * 2) 트랙별 학습자 — 트랙 미선택(null) 제외하고 언어×트랙 cross 집계.
   *    JA 런칭 직후 트랙 분포 모니터링 핵심 시그널.
   * 3) 연속학습 TOP — 어제 또는 오늘까지 살아있는 streak만 (이미 끊긴
   *    과거 streak는 제외). gaps-and-islands SQL.
   */
  async getStats(): Promise<{
    byOs: Array<{ platform: string; count: number }>;
    byTrack: Array<{
      languageCode: string;
      track: string;
      count: number;
    }>;
    topStreaks: Array<{
      userId: string;
      email: string;
      nickname: string | null;
      streak: number;
      lastDate: string;
    }>;
  }> {
    const byOsRaw: Array<{ platform: string | null; count: string }> =
      await this.userRepo.query(
        `SELECT "lastPlatform" AS platform, COUNT(*) AS count
         FROM ll_users
         WHERE "deletedAt" IS NULL
         GROUP BY "lastPlatform"
         ORDER BY count DESC`,
      );
    const byOs = byOsRaw.map((r) => ({
      platform: r.platform ?? 'unknown',
      count: Number(r.count),
    }));

    const byTrackRaw: Array<{
      target: string | null;
      track: string;
      count: string;
    }> = await this.userRepo.query(
      `SELECT "targetLanguage" AS target, "learningTrack" AS track, COUNT(*) AS count
       FROM ll_users
       WHERE "deletedAt" IS NULL AND "learningTrack" IS NOT NULL
       GROUP BY "targetLanguage", "learningTrack"
       ORDER BY count DESC`,
    );
    const byTrack = byTrackRaw.map((r) => ({
      languageCode: r.target ?? 'en',
      track: r.track,
      count: Number(r.count),
    }));

    // gaps-and-islands — 사용자별 연속 완료일을 그룹화하고 마지막 그룹이
    // 어제/오늘에 닿아 있으면 "살아있는 streak". 사용자 timezone 존중.
    const topStreaksRaw: Array<{
      user_id: string;
      email: string;
      nickname: string | null;
      streak: string;
      last_date: string;
    }> = await this.userRepo.query(
      `WITH user_dates AS (
         SELECT DISTINCT
           a.user_id,
           (DATE_TRUNC('day', (a.completed_at AT TIME ZONE 'UTC')
              AT TIME ZONE COALESCE(u.timezone, 'Asia/Seoul')))::date AS local_date
         FROM ll_daily_assignments a
         JOIN ll_users u ON u.id = a.user_id
         WHERE a.status = 'completed'
           AND a.completed_at IS NOT NULL
           AND u."deletedAt" IS NULL
       ),
       gapped AS (
         SELECT
           user_id,
           local_date,
           local_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY local_date))::int AS grp
         FROM user_dates
       ),
       runs AS (
         SELECT user_id, grp,
                COUNT(*)::int AS streak,
                MAX(local_date) AS last_date
         FROM gapped
         GROUP BY user_id, grp
       ),
       latest AS (
         SELECT user_id, streak, last_date,
                ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY last_date DESC) AS rn
         FROM runs
       )
       SELECT
         l.user_id, u.email, u.nickname,
         l.streak::int AS streak,
         l.last_date::text AS last_date
       FROM latest l
       JOIN ll_users u ON u.id = l.user_id
       WHERE l.rn = 1
         AND l.last_date >= (CURRENT_DATE - INTERVAL '1 day')::date
       ORDER BY l.streak DESC, l.last_date DESC
       LIMIT 50`,
    );
    const topStreaks = topStreaksRaw.map((r) => ({
      userId: r.user_id,
      email: r.email,
      nickname: r.nickname,
      streak: Number(r.streak),
      lastDate: r.last_date,
    }));

    return { byOs, byTrack, topStreaks };
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
