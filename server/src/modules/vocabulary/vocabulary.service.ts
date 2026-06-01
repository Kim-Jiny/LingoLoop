import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vocabulary } from './vocabulary.entity.js';
import { AddVocabularyDto } from './dto/add-vocabulary.dto.js';
import { UpdateVocabularyDto } from './dto/update-vocabulary.dto.js';
import { Word } from '../sentences/word.entity.js';
import { WordForm } from '../sentences/word-form.entity.js';
import { Language } from '../sentences/language.entity.js';

@Injectable()
export class VocabularyService implements OnModuleInit {
  constructor(
    @InjectRepository(Vocabulary)
    private vocabRepo: Repository<Vocabulary>,
    @InjectRepository(Word)
    private wordRepo: Repository<Word>,
    @InjectRepository(WordForm)
    private wordFormRepo: Repository<WordForm>,
    @InjectRepository(Language)
    private languageRepo: Repository<Language>,
  ) {}

  /**
   * The project runs with `synchronize` disabled outside development, so the
   * table for this newly added entity is created idempotently on boot. This
   * keeps the feature self-contained and avoids a manual migration step.
   */
  async onModuleInit() {
    await this.vocabRepo.query(`
      CREATE TABLE IF NOT EXISTS ll_vocabulary (
        id SERIAL PRIMARY KEY,
        user_id uuid NOT NULL REFERENCES ll_users(id) ON DELETE CASCADE,
        word text NOT NULL,
        meaning text,
        context text,
        sentence_id int REFERENCES ll_sentences(id) ON DELETE SET NULL,
        status varchar NOT NULL DEFAULT 'learning',
        "createdAt" timestamp NOT NULL DEFAULT now()
      );
    `);
    // Idempotent column add for tables created before the status field.
    await this.vocabRepo.query(
      `ALTER TABLE ll_vocabulary
       ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'learning';`,
    );
    // 활용형/품사 메타. 사용자가 "ran"을 북마크하면 baseWord="run",
    // form="past", partOfSpeech="verb" — 단어장에서 "run의 과거형" 라벨
    // 노출 + ll_word_forms join 키. nullable이라 기존 row는 그대로.
    await this.vocabRepo.query(
      `ALTER TABLE ll_vocabulary
       ADD COLUMN IF NOT EXISTS "baseWord" text,
       ADD COLUMN IF NOT EXISTS "form" text,
       ADD COLUMN IF NOT EXISTS "partOfSpeech" text;`,
    );
    await this.vocabRepo.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_ll_vocabulary_user_word
       ON ll_vocabulary (user_id, word);`,
    );

    // ── 다언어 지원 (1.2 phase 1) ───────────────────────────────────────
    // language_id 컬럼 — 기존 row는 NULL로 들어가니 user.targetLanguage
    // 기반으로 backfill 후 NOT NULL 적용. 기존 unique (user_id, word)는
    // (user_id, language_id, word) 복합으로 교체.
    await this.vocabRepo.query(
      `ALTER TABLE ll_vocabulary
       ADD COLUMN IF NOT EXISTS language_id int`,
    );
    // 1단계: user.targetLanguage 매칭되는 row 채움.
    await this.vocabRepo.query(
      `UPDATE ll_vocabulary v
       SET language_id = l.id
       FROM ll_users u, ll_languages l
       WHERE v.user_id = u.id
         AND l.code = u."targetLanguage"
         AND v.language_id IS NULL`,
    );
    // 2단계: 그래도 NULL인 row(언어 매칭 실패 등) — 'en' fallback.
    await this.vocabRepo.query(
      `UPDATE ll_vocabulary
       SET language_id = (SELECT id FROM ll_languages WHERE code = 'en')
       WHERE language_id IS NULL`,
    );
    // 3단계: NOT NULL 적용 (모두 채워졌으므로 안전).
    await this.vocabRepo.query(
      `ALTER TABLE ll_vocabulary
       ALTER COLUMN language_id SET NOT NULL`,
    );
    // 4단계: 신규 복합 unique index 생성 후 옛 단일 인덱스 제거.
    // 순서 중요 — 신규 만들기 전에 구를 지우면 중복 row 들어올 윈도가
    // 생김.
    await this.vocabRepo.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_ll_vocabulary_user_lang_word
       ON ll_vocabulary (user_id, language_id, word)`,
    );
    await this.vocabRepo.query(
      `DROP INDEX IF EXISTS idx_ll_vocabulary_user_word`,
    );
  }

  async list(userId: string, status?: string, languageCode?: string) {
    // 다언어 — languageCode 지정 시 해당 언어 row만. 명시 안 하면 전체.
    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (languageCode) {
      const lang = await this.languageRepo.findOne({
        where: { code: languageCode },
      });
      if (lang) where.languageId = lang.id;
    }
    const items = await this.vocabRepo.find({
      where,
      relations: ['sentence'],
      order: { createdAt: 'DESC' },
    });

    return {
      items: items.map((v) => this.serialize(v)),
      total: items.length,
    };
  }

  async updateStatus(userId: string, id: number, dto: UpdateVocabularyDto) {
    const entry = await this.vocabRepo.findOne({ where: { id, userId } });
    if (!entry) {
      throw new NotFoundException(`Vocabulary #${id} not found`);
    }
    entry.status = dto.status;
    const saved = await this.vocabRepo.save(entry);
    return this.serialize(saved);
  }

  async add(userId: string, dto: AddVocabularyDto, languageCode = 'en') {
    const word = dto.word.trim();
    // 다언어 — 같은 word가 EN과 JA에서 별도 row로 존재할 수 있음.
    // unique index가 (user_id, language_id, word) 복합이라 lookup도 그대로.
    const lang = await this.languageRepo.findOne({
      where: { code: languageCode },
    });
    const languageId = lang?.id ?? 0;
    if (!languageId) {
      throw new NotFoundException(
        `Unknown language code: "${languageCode}"`,
      );
    }
    let entry = await this.vocabRepo.findOne({
      where: { userId, word, languageId },
    });

    // 1) sentenceId 있으면 ll_words에서 같은 단어 row 조회 → baseWord/
    //    form/partOfSpeech 우선 채움. AI fill이 끝난 단어 카드는 이게
    //    채워져 있어 즉시 정확한 메타 얻음.
    // 2) ll_words에 정보 없거나 sentenceId 없으면 ll_word_forms에서
    //    fallback 검색 — 표면형(word)이 어떤 활용형인지 inverse lookup.
    //    "ran" → forms.past=='ran' 매치 → run/past/verb 회수.
    const meta = await this.resolveWordMeta(word, dto.sentenceId ?? null);

    if (entry) {
      entry.meaning = dto.meaning ?? entry.meaning;
      entry.context = dto.context ?? entry.context;
      entry.sentenceId = dto.sentenceId ?? entry.sentenceId;
      // 메타는 새로 알아낸 값으로 덮어쓰기 — 이전에 null이면 채우고,
      // 이미 있으면 같은 단어니까 동일한 값이 들어옴.
      if (meta.baseWord != null) entry.baseWord = meta.baseWord;
      if (meta.form != null) entry.form = meta.form;
      if (meta.partOfSpeech != null) entry.partOfSpeech = meta.partOfSpeech;
    } else {
      entry = this.vocabRepo.create({
        userId,
        languageId,
        word,
        meaning: dto.meaning ?? null,
        context: dto.context ?? null,
        sentenceId: dto.sentenceId ?? null,
        baseWord: meta.baseWord,
        form: meta.form,
        partOfSpeech: meta.partOfSpeech,
      });
    }

    const saved = await this.vocabRepo.save(entry);
    return this.serialize(saved);
  }

  /**
   * (word, sentenceId)로 활용형 메타 추론. ll_words 우선, fallback으로
   * ll_word_forms 표면형 역검색. 둘 다 실패하면 모두 null — vocab에는
   * literal word만 저장됨 (기존 동작과 동일).
   */
  private async resolveWordMeta(
    word: string,
    sentenceId: number | null,
  ): Promise<{
    baseWord: string | null;
    form: string | null;
    partOfSpeech: string | null;
  }> {
    const lc = word.toLowerCase();

    // 1) ll_words — 문장 컨텍스트가 가장 정확.
    if (sentenceId != null) {
      const card = await this.wordRepo
        .createQueryBuilder('w')
        .where('w.sentence_id = :sid', { sid: sentenceId })
        .andWhere('LOWER(w.word) = :w', { w: lc })
        .getOne();
      if (card) {
        const base = card.baseWord?.trim() || null;
        const f = card.form?.trim() || null;
        const pos = card.partOfSpeech?.trim() || null;
        // 모두 있으면 그대로 반환. 일부만 있으면 word_forms 보강 시도.
        if (base && f && pos) return { baseWord: base, form: f, partOfSpeech: pos };
        const wf = base ? await this.findWordFormByBase(base) : null;
        if (wf) {
          return {
            baseWord: base ?? wf.baseWord,
            form: f ?? this.matchFormKey(wf, lc),
            partOfSpeech: pos ?? wf.partOfSpeech,
          };
        }
        return { baseWord: base, form: f, partOfSpeech: pos };
      }
    }

    // 2) ll_word_forms inverse lookup — forms JSONB에서 표면형 매칭.
    const wf = await this.findWordFormByAnyForm(lc);
    if (wf) {
      return {
        baseWord: wf.baseWord,
        form: this.matchFormKey(wf, lc),
        partOfSpeech: wf.partOfSpeech,
      };
    }

    return { baseWord: null, form: null, partOfSpeech: null };
  }

  private async findWordFormByBase(base: string): Promise<WordForm | null> {
    return this.wordFormRepo
      .createQueryBuilder('wf')
      .where('LOWER(wf."baseWord") = :b', { b: base.toLowerCase() })
      .getOne();
  }

  /**
   * ll_word_forms의 forms JSONB 값들 중 surface와 일치하는 row 찾기.
   * Postgres jsonb_each_text로 모든 값 풀어서 LOWER 비교 — 동음이의어
   * 가능성 있으면 첫 매치만 (운영상 거의 없음).
   */
  private async findWordFormByAnyForm(
    surface: string,
  ): Promise<WordForm | null> {
    const row = await this.wordFormRepo
      .createQueryBuilder('wf')
      .where(
        `EXISTS (
          SELECT 1 FROM jsonb_each_text(wf.forms) AS f(key, value)
          WHERE LOWER(
            REPLACE(REPLACE(f.value, '‘', ''''), '’', '''')
          ) = :s
        )`,
        { s: surface },
      )
      .getOne();
    return row ?? null;
  }

  /** 주어진 surface가 wf.forms 어떤 key의 값과 일치하는지 반환. */
  private matchFormKey(wf: WordForm, surface: string): string | null {
    for (const [k, v] of Object.entries(wf.forms ?? {})) {
      if (String(v).toLowerCase() === surface) return k;
    }
    return null;
  }

  /**
   * 단어 사전 조회. baseWord 정확 일치를 먼저 시도하고, 없으면 surface
   * inverse 검색. 응답에 examples를 신규 { en, ko } shape으로 정규화 —
   * DB에 구버전 string이 남아있어도 클라는 한 가지 분기만 처리.
   * languageCode는 ll_languages.code로 lookup.
   */
  async getWordForms(word: string, languageCode = 'en') {
    // smart quotes (U+2019/U+2018)를 ASCII로 정규화 — DB에는 항상 straight
    // 아포스트로피로 저장되도록 admin/bulkUpsert에서 강제. 클라가 어떤
    // 인코딩으로 검색해도 같은 row를 찾도록.
    const surface = word.replace(/[‘’]/g, "'").trim();
    if (!surface) return null;
    const lc = surface.toLowerCase();

    let wf = await this.findWordFormByBase(lc);
    if (!wf) wf = await this.findWordFormByAnyForm(lc);
    if (!wf) return null;

    // 노이즈 제거: noun인데 base/singular 둘 다 있고 surface가 동일하면
    // base 키 제거. 이전 프롬프트로 채워진 데이터가 두 key를 모두
    // 가지고 있어 '원형' 카드가 중복으로 떴음. 같은 정규화를 admin
    // detail에서도 함.
    let forms = wf.forms;
    let examples = this.normalizeExamples(wf.examples);
    if (
      forms &&
      wf.partOfSpeech === 'noun' &&
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
      baseWord: wf.baseWord,
      partOfSpeech: wf.partOfSpeech,
      meaning: wf.meaning,
      forms,
      examples,
      // 사용자가 검색한 단어가 어떤 form 인지 알려줌 — vocab detail에서
      // "현재 표시 중: 과거형" 강조에 활용.
      matchedForm: this.matchFormKey(wf, lc),
    };
  }

  /**
   * examples를 { en, ko } 균일 shape로 변환. 구버전 string은 ko 빈
   * 칸으로. null/잘못된 값은 skip.
   */
  private normalizeExamples(
    examples: Record<string, { en: string; ko: string } | string> | null,
  ): Record<string, { en: string; ko: string }> | null {
    if (!examples || typeof examples !== 'object') return null;
    const out: Record<string, { en: string; ko: string }> = {};
    for (const [k, raw] of Object.entries(examples)) {
      if (raw == null) continue;
      if (typeof raw === 'string') {
        const en = raw.trim();
        if (en) out[k] = { en, ko: '' };
      } else if (typeof raw === 'object') {
        const en = String((raw as any).en ?? '').trim();
        const ko = String((raw as any).ko ?? '').trim();
        if (en) out[k] = { en, ko };
      }
    }
    return Object.keys(out).length ? out : null;
  }

  async remove(userId: string, id: number) {
    const entry = await this.vocabRepo.findOne({ where: { id, userId } });
    if (!entry) {
      throw new NotFoundException(`Vocabulary #${id} not found`);
    }
    await this.vocabRepo.remove(entry);
    return { success: true, id };
  }

  private serialize(v: Vocabulary) {
    return {
      id: v.id,
      word: v.word,
      baseWord: v.baseWord,
      form: v.form,
      partOfSpeech: v.partOfSpeech,
      meaning: v.meaning,
      context: v.context,
      sentenceId: v.sentenceId,
      sentenceText: v.sentence?.text ?? null,
      sentenceTranslation: v.sentence?.translation ?? null,
      status: v.status ?? 'learning',
      createdAt: v.createdAt,
    };
  }
}
