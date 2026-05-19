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

  // ── Batch 1 ────────────────────────────────────────────────────────────
  {
    text: 'How do I get to the airport from here?',
    translation: '여기서 공항까지 어떻게 가나요?',
    pronunciation: '하우 두 아이 겟 투 디 에어포트 프롬 히어?',
    situation: '길/교통편을 물을 때',
    difficulty: 'beginner',
    category: 'travel',
    words: [
      { word: 'get to', meaning: '~에 도착하다', partOfSpeech: 'phrase' },
      { word: 'from here', meaning: '여기서부터', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'How do I get to ~?',
        explanation: '목적지까지 가는 방법을 묻는 가장 기본 표현입니다.',
        example: 'How do I get to the station?',
      },
    ],
  },
  {
    text: 'Do you have this in a smaller size?',
    translation: '이거 더 작은 사이즈 있나요?',
    pronunciation: '두 유 해브 디스 인 어 스몰러 사이즈?',
    situation: '옷가게에서 사이즈를 물을 때',
    difficulty: 'beginner',
    category: 'shopping',
    words: [
      { word: 'smaller', meaning: '더 작은', partOfSpeech: 'adjective' },
      { word: 'size', meaning: '치수, 크기', partOfSpeech: 'noun' },
    ],
    grammarNotes: [
      {
        title: 'Do you have ~ in ~?',
        explanation: '특정 조건(색/사이즈)의 상품이 있는지 물을 때 씁니다.',
        example: 'Do you have this in black?',
      },
    ],
  },
  {
    text: 'I’d like to check in, please.',
    translation: '체크인하고 싶어요.',
    pronunciation: '아이드 라이크 투 체크 인, 플리즈.',
    situation: '호텔 체크인',
    difficulty: 'beginner',
    category: 'hotel',
    words: [
      { word: 'check in', meaning: '체크인하다', partOfSpeech: 'phrasal verb' },
    ],
    grammarNotes: [
      {
        title: 'I’d like to + 동사',
        explanation: '정중하게 하고 싶은 것을 말하는 표현입니다.',
        example: 'I’d like to order now.',
      },
    ],
  },
  {
    text: 'Could you recommend something popular here?',
    translation: '여기서 인기 있는 메뉴 추천해 주실래요?',
    pronunciation: '쿠쥬 레코멘드 썸띵 파퓰러 히어?',
    situation: '식당에서 메뉴를 고를 때',
    difficulty: 'intermediate',
    category: 'restaurant',
    words: [
      { word: 'recommend', meaning: '추천하다', partOfSpeech: 'verb' },
      { word: 'popular', meaning: '인기 있는', partOfSpeech: 'adjective' },
    ],
    grammarNotes: [
      {
        title: 'Could you recommend ~?',
        explanation: '추천을 정중히 요청할 때 쓰는 패턴입니다.',
        example: 'Could you recommend a good hotel?',
      },
    ],
  },
  {
    text: 'I’m not sure I follow what you mean.',
    translation: '말씀하신 게 잘 이해되지 않아요.',
    pronunciation: '아임 낫 슈어 아이 팔로우 왓 유 민.',
    situation: '상대 말을 이해 못 했을 때',
    difficulty: 'intermediate',
    category: 'daily',
    words: [
      { word: 'follow', meaning: '(말을) 이해하다', partOfSpeech: 'verb' },
      { word: 'I’m not sure', meaning: '잘 모르겠어요', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'follow = 이해하다',
        explanation: '"follow"는 대화에서 "(논리를) 따라가다 = 이해하다"로 자주 쓰입니다.',
        example: 'Sorry, I don’t follow.',
      },
    ],
  },
  {
    text: 'Let me get back to you on that.',
    translation: '그건 다시 알려드릴게요.',
    pronunciation: '렛 미 겟 백 투 유 온 댓.',
    situation: '즉답하기 어려울 때',
    difficulty: 'intermediate',
    category: 'business',
    words: [
      {
        word: 'get back to',
        meaning: '~에게 나중에 다시 연락하다',
        partOfSpeech: 'phrase',
      },
    ],
    grammarNotes: [
      {
        title: 'get back to someone',
        explanation: '나중에 답을 주겠다는 비즈니스 표현입니다.',
        example: 'I’ll get back to you tomorrow.',
      },
    ],
  },
  {
    text: 'It completely slipped my mind.',
    translation: '완전히 깜빡했어요.',
    pronunciation: '잇 컴플리틀리 슬립트 마이 마인드.',
    situation: '약속/할 일을 잊었을 때',
    difficulty: 'advanced',
    category: 'daily',
    words: [
      {
        word: 'slip one’s mind',
        meaning: '깜빡 잊다',
        partOfSpeech: 'idiom',
      },
    ],
    grammarNotes: [
      {
        title: 'slip one’s mind',
        explanation: '"잊어버리다"를 자연스럽게 표현하는 관용구입니다.',
        example: 'Her birthday slipped my mind.',
      },
    ],
  },
  {
    text: 'Would it be possible to get a refund?',
    translation: '환불받을 수 있을까요?',
    pronunciation: '우드 잇 비 파서블 투 겟 어 리펀드?',
    situation: '환불을 요청할 때',
    difficulty: 'intermediate',
    category: 'shopping',
    words: [
      { word: 'refund', meaning: '환불', partOfSpeech: 'noun' },
      {
        word: 'Would it be possible to',
        meaning: '~하는 게 가능할까요',
        partOfSpeech: 'phrase',
      },
    ],
    grammarNotes: [
      {
        title: 'Would it be possible to ~?',
        explanation: '매우 정중하게 가능 여부를 묻는 표현입니다.',
        example: 'Would it be possible to change my seat?',
      },
    ],
  },
  {
    text: 'My flight got delayed by two hours.',
    translation: '제 비행기가 두 시간 지연됐어요.',
    pronunciation: '마이 플라이트 갓 딜레이드 바이 투 아워스.',
    situation: '공항에서 지연 상황을 말할 때',
    difficulty: 'intermediate',
    category: 'airport',
    words: [
      { word: 'delayed', meaning: '지연된', partOfSpeech: 'adjective' },
      { word: 'flight', meaning: '항공편', partOfSpeech: 'noun' },
    ],
    grammarNotes: [
      {
        title: 'get + 과거분사 (수동)',
        explanation: '"get delayed"처럼 get + p.p.는 어떤 일이 "당하다"를 뜻합니다.',
        example: 'The package got lost.',
      },
    ],
  },
  {
    text: 'Can you put me through to the manager?',
    translation: '매니저에게 연결해 주시겠어요?',
    pronunciation: '캔 유 풋 미 쓰루 투 더 매니저?',
    situation: '전화에서 담당자 연결 요청',
    difficulty: 'advanced',
    category: 'phone',
    words: [
      {
        word: 'put through',
        meaning: '전화를 연결해 주다',
        partOfSpeech: 'phrasal verb',
      },
    ],
    grammarNotes: [
      {
        title: 'put someone through to ~',
        explanation: '전화 통화에서 다른 사람에게 연결해 달라고 할 때 씁니다.',
        example: 'Could you put me through to sales?',
      },
    ],
  },
  {
    text: 'I’ll take it.',
    translation: '이걸로 할게요.',
    pronunciation: '아일 테이크 잇.',
    situation: '구매를 결정했을 때',
    difficulty: 'beginner',
    category: 'shopping',
    words: [
      { word: 'take', meaning: '(사기로) 선택하다', partOfSpeech: 'verb' },
    ],
    grammarNotes: [
      {
        title: 'I’ll take it',
        explanation: '"이걸 사겠다"는 결정을 표현하는 정형 표현입니다.',
        example: 'I’ll take two, please.',
      },
    ],
  },
  {
    text: 'Sorry to keep you waiting.',
    translation: '기다리게 해서 죄송해요.',
    pronunciation: '쏘리 투 킵 유 웨이팅.',
    situation: '상대를 기다리게 했을 때',
    difficulty: 'beginner',
    category: 'daily',
    words: [
      {
        word: 'keep ~ waiting',
        meaning: '~를 계속 기다리게 하다',
        partOfSpeech: 'phrase',
      },
    ],
    grammarNotes: [
      {
        title: 'keep + 목적어 + -ing',
        explanation: '"~를 계속 …하게 하다"라는 사역적 표현입니다.',
        example: 'Don’t keep me waiting.',
      },
    ],
  },
];

