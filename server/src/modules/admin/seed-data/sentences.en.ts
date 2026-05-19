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

  // ── Batch 2 ────────────────────────────────────────────────────────────
  {
    text: 'What time do you close today?',
    translation: '오늘 몇 시에 닫나요?',
    pronunciation: '왓 타임 두 유 클로즈 투데이?',
    situation: '영업시간을 물을 때',
    difficulty: 'beginner',
    category: 'shopping',
    words: [{ word: 'close', meaning: '문을 닫다', partOfSpeech: 'verb' }],
    grammarNotes: [
      {
        title: 'What time do you ~?',
        explanation: '몇 시에 어떤 일을 하는지 묻는 기본 의문문입니다.',
        example: 'What time do you open?',
      },
    ],
  },
  {
    text: 'Is this seat taken?',
    translation: '이 자리 주인 있나요?',
    pronunciation: '이즈 디스 씨트 테이큰?',
    situation: '빈자리인지 확인할 때',
    difficulty: 'beginner',
    category: 'daily',
    words: [{ word: 'taken', meaning: '(자리가) 차 있는', partOfSpeech: 'adjective' }],
    grammarNotes: [
      {
        title: 'be taken',
        explanation: '"이미 사용 중/예약됨"을 뜻하는 수동 표현입니다.',
        example: 'Sorry, it’s taken.',
      },
    ],
  },
  {
    text: 'Could I have the menu, please?',
    translation: '메뉴판 좀 주시겠어요?',
    pronunciation: '쿠드 아이 해브 더 메뉴, 플리즈?',
    situation: '식당에서 메뉴 요청',
    difficulty: 'beginner',
    category: 'restaurant',
    words: [{ word: 'menu', meaning: '메뉴판', partOfSpeech: 'noun' }],
    grammarNotes: [
      {
        title: 'Could I have ~?',
        explanation: '정중하게 무언가를 달라고 할 때 씁니다.',
        example: 'Could I have a receipt?',
      },
    ],
  },
  {
    text: 'I’m allergic to peanuts.',
    translation: '저는 땅콩 알레르기가 있어요.',
    pronunciation: '아임 얼러직 투 피넛츠.',
    situation: '음식 알레르기를 알릴 때',
    difficulty: 'beginner',
    category: 'health',
    words: [
      { word: 'allergic to', meaning: '~에 알레르기가 있는', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'allergic to + 명사',
        explanation: '알레르기 대상을 말할 때 to 뒤에 명사를 씁니다.',
        example: 'She’s allergic to cats.',
      },
    ],
  },
  {
    text: 'Where can I exchange money?',
    translation: '환전은 어디서 하나요?',
    pronunciation: '웨어 캔 아이 익스체인지 머니?',
    situation: '공항/은행에서 환전 문의',
    difficulty: 'beginner',
    category: 'travel',
    words: [
      { word: 'exchange', meaning: '환전하다, 교환하다', partOfSpeech: 'verb' },
    ],
    grammarNotes: [
      {
        title: 'Where can I ~?',
        explanation: '어디서 무엇을 할 수 있는지 묻는 패턴입니다.',
        example: 'Where can I buy tickets?',
      },
    ],
  },
  {
    text: 'It’s on me.',
    translation: '제가 살게요.',
    pronunciation: '잇츠 온 미.',
    situation: '계산을 내가 하겠다고 할 때',
    difficulty: 'beginner',
    category: 'daily',
    words: [{ word: 'on me', meaning: '내가 낼게', partOfSpeech: 'idiom' }],
    grammarNotes: [
      {
        title: 'It’s on me',
        explanation: '"이번엔 내가 낸다"는 관용 표현입니다.',
        example: 'Lunch is on me.',
      },
    ],
  },
  {
    text: 'Can you give me a hand with this?',
    translation: '이것 좀 도와주실래요?',
    pronunciation: '캔 유 기브 미 어 핸드 위드 디스?',
    situation: '도움을 청할 때',
    difficulty: 'intermediate',
    category: 'daily',
    words: [
      { word: 'give a hand', meaning: '도와주다', partOfSpeech: 'idiom' },
    ],
    grammarNotes: [
      {
        title: 'give someone a hand',
        explanation: '"돕다"를 친근하게 말하는 관용구입니다.',
        example: 'Could you give me a hand?',
      },
    ],
  },
  {
    text: 'I’m running a bit late.',
    translation: '조금 늦을 것 같아요.',
    pronunciation: '아임 러닝 어 빗 레이트.',
    situation: '약속에 늦을 때 미리 알릴 때',
    difficulty: 'intermediate',
    category: 'daily',
    words: [
      { word: 'running late', meaning: '늦고 있는', partOfSpeech: 'phrase' },
      { word: 'a bit', meaning: '조금', partOfSpeech: 'adverb' },
    ],
    grammarNotes: [
      {
        title: 'running late',
        explanation: '"예정보다 늦어지고 있다"는 자연스러운 표현입니다.',
        example: 'Sorry, I’m running late.',
      },
    ],
  },
  {
    text: 'Let’s split the bill.',
    translation: '계산은 나눠서 하죠.',
    pronunciation: '렛츠 스플릿 더 빌.',
    situation: '식사 후 더치페이',
    difficulty: 'intermediate',
    category: 'restaurant',
    words: [
      { word: 'split the bill', meaning: '계산을 나누다', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'split the bill',
        explanation: '비용을 균등하게 나눠 내자는 표현입니다.',
        example: 'Shall we split the bill?',
      },
    ],
  },
  {
    text: 'Could you keep an eye on my bag for a second?',
    translation: '잠깐 제 가방 좀 봐주시겠어요?',
    pronunciation: '쿠쥬 킵 언 아이 온 마이 백 포 어 세컨드?',
    situation: '잠시 자리를 비울 때',
    difficulty: 'advanced',
    category: 'travel',
    words: [
      { word: 'keep an eye on', meaning: '지켜보다, 봐주다', partOfSpeech: 'idiom' },
    ],
    grammarNotes: [
      {
        title: 'keep an eye on ~',
        explanation: '무언가를 잠깐 지켜봐 달라고 부탁할 때 씁니다.',
        example: 'Keep an eye on the kids.',
      },
    ],
  },
  {
    text: 'I’d appreciate it if you could let me know by Friday.',
    translation: '금요일까지 알려주시면 감사하겠습니다.',
    pronunciation: '아이드 어프리시에잇 잇 이프 유 쿠드 렛 미 노우 바이 프라이데이.',
    situation: '정중한 업무 요청',
    difficulty: 'advanced',
    category: 'business',
    words: [
      { word: 'appreciate', meaning: '감사히 여기다', partOfSpeech: 'verb' },
      { word: 'let me know', meaning: '알려주다', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'I’d appreciate it if you could ~',
        explanation: '아주 정중하게 부탁하는 비즈니스 표현입니다.',
        example: 'I’d appreciate it if you could reply soon.',
      },
    ],
  },
  {
    text: 'Can I take a rain check?',
    translation: '다음에 하면 안 될까요?',
    pronunciation: '캔 아이 테이크 어 레인 체크?',
    situation: '제안을 다음으로 미룰 때',
    difficulty: 'advanced',
    category: 'smalltalk',
    words: [
      { word: 'rain check', meaning: '다음 기회로 미룸', partOfSpeech: 'idiom' },
    ],
    grammarNotes: [
      {
        title: 'take a rain check',
        explanation: '초대를 정중히 거절하고 다음을 기약하는 관용구입니다.',
        example: 'Can I take a rain check on dinner?',
      },
    ],
  },
  {
    text: 'How long does it take to get there?',
    translation: '거기까지 얼마나 걸리나요?',
    pronunciation: '하우 롱 더즈 잇 테이크 투 겟 데어?',
    situation: '소요 시간을 물을 때',
    difficulty: 'beginner',
    category: 'travel',
    words: [
      { word: 'take', meaning: '(시간이) 걸리다', partOfSpeech: 'verb' },
    ],
    grammarNotes: [
      {
        title: 'How long does it take to ~?',
        explanation: '어떤 일에 걸리는 시간을 묻는 표현입니다.',
        example: 'How long does it take to learn?',
      },
    ],
  },
  {
    text: 'I’ll think about it.',
    translation: '생각해 볼게요.',
    pronunciation: '아일 띵크 어바웃 잇.',
    situation: '즉답을 피하고 싶을 때',
    difficulty: 'beginner',
    category: 'daily',
    words: [
      { word: 'think about', meaning: '~에 대해 생각하다', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'think about it',
        explanation: '결정을 보류할 때 흔히 쓰는 표현입니다.',
        example: 'Let me think about it.',
      },
    ],
  },
  {
    text: 'That works for me.',
    translation: '저는 그게 좋아요(괜찮아요).',
    pronunciation: '댓 웍스 포 미.',
    situation: '제안에 동의할 때',
    difficulty: 'intermediate',
    category: 'business',
    words: [
      { word: 'work for', meaning: '~에게 괜찮다/맞다', partOfSpeech: 'phrase' },
    ],
    grammarNotes: [
      {
        title: 'That works for me',
        explanation: '일정/제안이 자신에게 맞는다고 동의하는 표현입니다.',
        example: 'Friday works for me.',
      },
    ],
  },
  {
    text: 'I’m looking forward to it.',
    translation: '기대하고 있어요.',
    pronunciation: '아임 루킹 포워드 투 잇.',
    situation: '약속/이벤트를 기대할 때',
    difficulty: 'intermediate',
    category: 'smalltalk',
    words: [
      {
        word: 'look forward to',
        meaning: '~을 기대하다',
        partOfSpeech: 'phrase',
      },
    ],
    grammarNotes: [
      {
        title: 'look forward to + 명사/-ing',
        explanation: 'to 뒤에 동사원형이 아니라 명사/동명사가 옵니다.',
        example: 'I look forward to meeting you.',
      },
    ],
  },
  {
    text: 'Could you double-check this for me?',
    translation: '이것 좀 다시 확인해 주실래요?',
    pronunciation: '쿠쥬 더블 체크 디스 포 미?',
    situation: '재확인을 부탁할 때',
    difficulty: 'intermediate',
    category: 'business',
    words: [
      { word: 'double-check', meaning: '재확인하다', partOfSpeech: 'verb' },
    ],
    grammarNotes: [
      {
        title: 'double-check',
        explanation: '"한 번 더 꼼꼼히 확인하다"라는 동사입니다.',
        example: 'Please double-check the numbers.',
      },
    ],
  },
  {
    text: 'It’s up to you.',
    translation: '당신이 결정하세요.',
    pronunciation: '잇츠 업 투 유.',
    situation: '상대에게 결정을 맡길 때',
    difficulty: 'beginner',
    category: 'daily',
    words: [
      { word: 'up to you', meaning: '너에게 달림', partOfSpeech: 'idiom' },
    ],
    grammarNotes: [
      {
        title: 'It’s up to you',
        explanation: '"네가 정하면 된다"는 관용 표현입니다.',
        example: 'Where to eat is up to you.',
      },
    ],
  },
  {
    text: 'Let me walk you through it.',
    translation: '제가 차근차근 설명해 드릴게요.',
    pronunciation: '렛 미 워크 유 쓰루 잇.',
    situation: '절차를 안내할 때',
    difficulty: 'advanced',
    category: 'business',
    words: [
      {
        word: 'walk through',
        meaning: '차근차근 설명하다',
        partOfSpeech: 'phrasal verb',
      },
    ],
    grammarNotes: [
      {
        title: 'walk someone through ~',
        explanation: '단계별로 천천히 설명/안내한다는 표현입니다.',
        example: 'Let me walk you through the setup.',
      },
    ],
  },
  {
    text: 'Do you have any vacancies tonight?',
    translation: '오늘 밤 빈방 있나요?',
    pronunciation: '두 유 해브 애니 베이컨시즈 투나잇?',
    situation: '호텔에 빈방을 문의할 때',
    difficulty: 'intermediate',
    category: 'hotel',
    words: [
      { word: 'vacancy', meaning: '빈방, 공실', partOfSpeech: 'noun' },
    ],
    grammarNotes: [
      {
        title: 'Do you have any ~?',
        explanation: '재고/여유가 있는지 물을 때 any를 씁니다.',
        example: 'Do you have any rooms left?',
      },
    ],
  },
];


