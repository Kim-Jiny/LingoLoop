// Bulk English sentence dataset. Append entries here and re-run
// `POST /api/admin/seed` — it is idempotent (only new `text` values are
// inserted), so you can grow this toward 1000+ in batches without dupes.
//
// Shape per entry:
//   text, translation, pronunciation, situation,
//   difficulty: 'beginner' | 'intermediate' | 'advanced',
//   category, words: [{ word, meaning, partOfSpeech, pronunciation?, example? }],
//   grammarNotes: [{ title, explanation, example? }]

export interface SeedWord {
  word: string;
  meaning: string;
  partOfSpeech?: string;
  pronunciation?: string;
  example?: string;
}

export interface SeedGrammarNote {
  title: string;
  explanation: string;
  example?: string;
}

export interface SeedSentence {
  text: string;
  translation: string;
  pronunciation?: string;
  situation?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  words: SeedWord[];
  grammarNotes: SeedGrammarNote[];
}

export const englishSentences: SeedSentence[] = [
  {
    text: 'Can I get the check, please?',
    translation: '계산서 좀 주시겠어요?',
    pronunciation: '캔 아이 겟 더 체크, 플리즈?',
    situation: '식당에서 계산할 때',
    difficulty: 'beginner',
    category: 'restaurant',
    words: [
      { word: 'check', meaning: '계산서', partOfSpeech: 'noun' },
      { word: 'Can I get', meaning: '~을 받을 수 있을까요', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'Can I get ~?',
        explanation: '식당/카페에서 무언가를 요청할 때 자주 쓰는 정중한 표현입니다.',
        example: 'Can I get a glass of water?',
      },
    ],
  },
  {
    text: 'I’m just looking, thank you.',
    translation: '그냥 둘러보는 거예요, 감사합니다.',
    pronunciation: '아임 저스트 루킹, 땡큐.',
    situation: '매장에서 점원이 도움을 물을 때',
    difficulty: 'beginner',
    category: 'shopping',
    words: [
      { word: 'just looking', meaning: '그냥 구경 중', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'just + -ing',
        explanation: '"그냥 ~하는 중"이라는 가벼운 현재진행 표현입니다.',
        example: 'I’m just resting.',
      },
    ],
  },
  {
    text: 'Could you speak more slowly, please?',
    translation: '조금 더 천천히 말씀해 주시겠어요?',
    pronunciation: '쿠쥬 스픽 모어 슬로울리, 플리즈?',
    situation: '상대의 말이 빨라 못 알아들었을 때',
    difficulty: 'beginner',
    category: 'daily',
    words: [
      { word: 'speak', meaning: '말하다', partOfSpeech: 'verb' },
      { word: 'slowly', meaning: '천천히', partOfSpeech: 'adverb' },
    ],
    grammarNotes: [
      {
        title: 'Could you ~?',
        explanation: '"Can you"보다 정중하게 부탁할 때 씁니다.',
        example: 'Could you help me?',
      },
    ],
  },
  {
    text: 'I think we should reschedule the meeting.',
    translation: '회의 일정을 다시 잡는 게 좋을 것 같아요.',
    pronunciation: '아이 띵크 위 슈드 리스케줄 더 미팅.',
    situation: '업무 일정 조율',
    difficulty: 'intermediate',
    category: 'business',
    words: [
      { word: 'reschedule', meaning: '일정을 다시 잡다', partOfSpeech: 'verb' },
      { word: 'should', meaning: '~하는 게 좋겠다', partOfSpeech: 'modal' },
    ],
    grammarNotes: [
      {
        title: 'I think we should ~',
        explanation: '제안을 부드럽게 할 때 쓰는 표현입니다.',
        example: 'I think we should wait.',
      },
    ],
  },
  {
    text: 'Would you mind if I opened the window?',
    translation: '창문을 열어도 괜찮을까요?',
    pronunciation: '우쥬 마인드 이프 아이 오픈드 더 윈도우?',
    situation: '정중하게 허락을 구할 때',
    difficulty: 'intermediate',
    category: 'daily',
    words: [
      { word: 'Would you mind', meaning: '~해도 괜찮을까요', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'Would you mind if + 과거형',
        explanation:
          '"Would you mind if I + 과거동사"는 정중한 허락 요청입니다. 동의는 "Not at all"로 답합니다.',
        example: 'Would you mind if I sat here?',
      },
    ],
  },
  {
    text: 'Let’s touch base early next week.',
    translation: '다음 주 초에 다시 이야기 나눠요.',
    pronunciation: '렛츠 터치 베이스 얼리 넥스트 위크.',
    situation: '업무 후속 논의 제안',
    difficulty: 'advanced',
    category: 'business',
    words: [
      {
        word: 'touch base',
        meaning: '간단히 연락/논의하다',
        partOfSpeech: 'idiom',
      },
    ],
    grammarNotes: [
      {
        title: 'touch base',
        explanation: '비즈니스에서 "짧게 상황을 공유하다"라는 관용 표현입니다.',
        example: 'Let’s touch base after lunch.',
      },
    ],
  },
];
