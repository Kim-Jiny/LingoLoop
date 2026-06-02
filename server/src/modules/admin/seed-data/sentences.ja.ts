// Bulk Japanese sentence dataset. 트랙당 5문장씩(=50개) 시드.
//
// 트랙 매핑:
//   beginner       — 가장 기초 일상 인사·감사·사과 (히라가나 중심)
//   intermediate   — 일상 회화 표현 (기본 keigo 포함)
//   advanced       — 자연스럽고 정교한 격식 표현
//   jlpt_n5/n4/n3  — JLPT 수준별 문법·어휘
//   jlpt_n2/n1     — 고급 문법 패턴
//   jpt            — 비즈니스/실무 일본어
//   conversation   — 친구/가족 사이의 자연스러운 구어체
//
// difficulty 컬럼은 서버 enum이 beginner/intermediate/advanced 셋만 지원
// → JLPT/JPT 트랙도 컨텐츠 난이도에 맞춰 매핑함.

import type { SeedSentence } from './sentences.en.js';

/// JA 트랙은 SeedSentence.track 유니온에 없으므로 string으로 우회.
type JaSeedSentence = Omit<SeedSentence, 'track'> & { track: string };

export const japaneseSentences: JaSeedSentence[] = [
  // ════════════════════════════════════════════════════════════════
  // beginner (초급) — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: 'おはようございます。',
    translation: '좋은 아침이에요.',
    pronunciation: '오하요-고자이마스',
    situation: '아침에 만났을 때 정중한 인사',
    difficulty: 'beginner',
    track: 'beginner',
    category: 'greeting',
    words: [
      { word: 'おはよう', meaning: '아침 인사', partOfSpeech: 'noun', pronunciation: '오하요-' },
      { word: 'ございます', meaning: '있습니다(정중)', partOfSpeech: 'phrase', pronunciation: '고자이마스' },
    ],
    grammarNotes: [
      {
        title: 'ございます',
        explanation: '"있습니다"의 가장 정중한 형태. 인사·감사 표현 끝에 붙어 격식을 더해줍니다.',
        example: 'ありがとうございます。',
      },
    ],
  },
  {
    text: 'ありがとうございます。',
    translation: '감사합니다.',
    pronunciation: '아리가토-고자이마스',
    situation: '기본 감사 표현',
    difficulty: 'beginner',
    track: 'beginner',
    category: 'greeting',
    words: [
      { word: 'ありがとう', meaning: '고마워', partOfSpeech: 'phrase', pronunciation: '아리가토-' },
    ],
    grammarNotes: [
      {
        title: 'ありがとう vs ありがとうございます',
        explanation: '친근한 자리는 "ありがとう", 격식 있는 자리는 "ありがとうございます".',
      },
    ],
  },
  {
    text: 'すみません。',
    translation: '죄송합니다 / 실례합니다.',
    pronunciation: '스미마셍',
    situation: '사과하거나 주의를 끌 때',
    difficulty: 'beginner',
    track: 'beginner',
    category: 'greeting',
    words: [
      { word: 'すみません', meaning: '미안합니다/실례합니다', partOfSpeech: 'phrase', pronunciation: '스미마셍' },
    ],
    grammarNotes: [
      {
        title: 'すみません의 폭넓은 용도',
        explanation: '사과(미안합니다), 주의 끌기(저기요), 가벼운 감사(고맙습니다) 세 가지로 모두 쓰입니다.',
        example: 'すみません、水ください。 — 저기요, 물 좀 주세요.',
      },
    ],
  },
  {
    text: 'はじめまして。',
    translation: '처음 뵙겠습니다.',
    pronunciation: '하지메마시테',
    situation: '처음 만난 사람에게',
    difficulty: 'beginner',
    track: 'beginner',
    category: 'greeting',
    words: [
      { word: 'はじめまして', meaning: '처음 뵙겠습니다', partOfSpeech: 'phrase', pronunciation: '하지메마시테' },
    ],
    grammarNotes: [
      {
        title: '자기소개 패턴',
        explanation: '"はじめまして。○○です。よろしくお願いします。" 순서로 자기소개합니다.',
        example: 'はじめまして。キムです。',
      },
    ],
  },
  {
    text: 'いただきます。',
    translation: '잘 먹겠습니다.',
    pronunciation: '이타다키마스',
    situation: '식사 시작 전',
    difficulty: 'beginner',
    track: 'beginner',
    category: 'meal',
    words: [
      { word: 'いただく', meaning: '받다(겸양)', partOfSpeech: 'verb', pronunciation: '이타다쿠' },
    ],
    grammarNotes: [
      {
        title: '식사 전후 인사',
        explanation: '시작 전은 "いただきます", 식사 후는 "ごちそうさまでした"로 답합니다.',
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // intermediate (중급) — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: '今度の週末、何か予定ありますか？',
    translation: '이번 주말에 뭔가 계획 있어요?',
    pronunciation: '콘도노 슈-마츠, 나니카 요테- 아리마스카?',
    situation: '약속을 잡기 전에 일정을 물어볼 때',
    difficulty: 'intermediate',
    track: 'intermediate',
    category: 'daily',
    words: [
      { word: '今度', meaning: '이번/다음번', partOfSpeech: 'noun', pronunciation: '콘도' },
      { word: '週末', meaning: '주말', partOfSpeech: 'noun', pronunciation: '슈-마츠' },
      { word: '予定', meaning: '예정/계획', partOfSpeech: 'noun', pronunciation: '요테-' },
    ],
    grammarNotes: [
      {
        title: '何か + 명사',
        explanation: '"뭔가 ~"의 의미. "何か予定" = "뭔가 일정".',
        example: '何か質問ありますか？ — 뭔가 질문 있어요?',
      },
    ],
  },
  {
    text: 'お時間あるとき、教えてください。',
    translation: '시간 되실 때 알려주세요.',
    pronunciation: '오지캉 아루토키, 오시에테 쿠다사이',
    situation: '상대방 일정에 맞추겠다고 정중히 부탁할 때',
    difficulty: 'intermediate',
    track: 'intermediate',
    category: 'business',
    words: [
      { word: 'お時間', meaning: '시간(공손)', partOfSpeech: 'noun', pronunciation: '오지캉' },
      { word: '教える', meaning: '알려주다', partOfSpeech: 'verb', pronunciation: '오시에루' },
    ],
    grammarNotes: [
      {
        title: 'お+명사로 정중함 더하기',
        explanation: '시간(時間)에 お를 붙여 상대방의 시간을 정중히 표현합니다.',
        example: 'お名前は何ですか？ — 성함이 어떻게 되세요?',
      },
    ],
  },
  {
    text: 'ちょっと聞いてもいいですか？',
    translation: '잠깐 여쭤봐도 될까요?',
    pronunciation: '춋토 키이테모 이이데스카?',
    situation: '질문 시작 전 양해를 구할 때',
    difficulty: 'intermediate',
    track: 'intermediate',
    category: 'daily',
    words: [
      { word: 'ちょっと', meaning: '잠깐', partOfSpeech: 'adverb', pronunciation: '춋토' },
      { word: '聞く', meaning: '듣다/묻다', partOfSpeech: 'verb', pronunciation: '키쿠' },
    ],
    grammarNotes: [
      {
        title: '~てもいいですか',
        explanation: '"~해도 될까요?"라는 허락 구하기 표현. 동사 て형 + もいいですか.',
        example: '行ってもいいですか？ — 가도 될까요?',
      },
    ],
  },
  {
    text: 'お会いできてうれしいです。',
    translation: '만나서 기쁩니다.',
    pronunciation: '오아이데키테 우레시이데스',
    situation: '첫 만남이나 오랜만의 만남에서',
    difficulty: 'intermediate',
    track: 'intermediate',
    category: 'greeting',
    words: [
      { word: '会う', meaning: '만나다', partOfSpeech: 'verb', pronunciation: '아우' },
      { word: 'うれしい', meaning: '기쁘다', partOfSpeech: 'adjective', pronunciation: '우레시-' },
    ],
    grammarNotes: [
      {
        title: 'お+동사+できる',
        explanation: '겸양 표현. "만날 수 있어서"를 정중하게 "お会いできて".',
      },
    ],
  },
  {
    text: 'また連絡しますね。',
    translation: '또 연락드릴게요.',
    pronunciation: '마타 렌라쿠시마스네',
    situation: '대화/만남을 마무리할 때',
    difficulty: 'intermediate',
    track: 'intermediate',
    category: 'daily',
    words: [
      { word: 'また', meaning: '또/다시', partOfSpeech: 'adverb', pronunciation: '마타' },
      { word: '連絡', meaning: '연락', partOfSpeech: 'noun', pronunciation: '렌라쿠' },
    ],
    grammarNotes: [
      {
        title: '~ね 종조사',
        explanation: '확인이나 동의를 부드럽게 구하는 종조사. 친근함을 더합니다.',
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // advanced (고급) — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: 'お手数をおかけしますが、よろしくお願いいたします。',
    translation: '번거롭게 해드려 죄송하지만 잘 부탁드립니다.',
    pronunciation: '오테스-오 오카케시마스가, 요로시쿠 오네가이이타시마스',
    situation: '상대에게 일을 부탁하는 격식 있는 메일/대화',
    difficulty: 'advanced',
    track: 'advanced',
    category: 'business',
    words: [
      { word: 'お手数', meaning: '수고/번거로움', partOfSpeech: 'noun', pronunciation: '오테스-' },
      { word: 'おかけする', meaning: '끼치다(겸양)', partOfSpeech: 'verb', pronunciation: '오카케스루' },
      { word: 'いたします', meaning: '하겠습니다(겸양)', partOfSpeech: 'verb', pronunciation: '이타시마스' },
    ],
    grammarNotes: [
      {
        title: 'お+동사+いたします',
        explanation: '가장 정중한 겸양 표현. 비즈니스/공식 자리에서 자기 행위를 낮춰 표현.',
        example: 'ご連絡いたします。 — 연락드리겠습니다.',
      },
    ],
  },
  {
    text: 'お忙しいところ恐縮ですが、少々お時間いただけますでしょうか。',
    translation: '바쁘신데 죄송하지만 잠시 시간 주실 수 있을까요?',
    pronunciation: '오이소가시이토코로 쿄-슈쿠데스가, 쇼-쇼- 오지캉 이타다케마스데쇼-카',
    situation: '상사·고객에게 시간 요청',
    difficulty: 'advanced',
    track: 'advanced',
    category: 'business',
    words: [
      { word: '恐縮', meaning: '죄송함/송구함', partOfSpeech: 'noun', pronunciation: '쿄-슈쿠' },
      { word: '少々', meaning: '잠시/조금', partOfSpeech: 'adverb', pronunciation: '쇼-쇼-' },
    ],
    grammarNotes: [
      {
        title: '~いただけますでしょうか',
        explanation: '"~해 주실 수 있을까요"의 최상급 정중 표현. "ますでしょうか"는 추측·겸양의 이중 정중 표현.',
      },
    ],
  },
  {
    text: 'ご都合がよろしければ、ご一緒しませんか。',
    translation: '사정이 괜찮으시면 함께 가지 않으시겠어요?',
    pronunciation: '고츠고-가 요로시케레바, 고잇쇼시마셍카',
    situation: '식사/모임을 정중히 권유할 때',
    difficulty: 'advanced',
    track: 'advanced',
    category: 'business',
    words: [
      { word: 'ご都合', meaning: '사정/일정(공손)', partOfSpeech: 'noun', pronunciation: '고츠고-' },
      { word: 'ご一緒', meaning: '함께함(공손)', partOfSpeech: 'noun', pronunciation: '고잇쇼' },
    ],
    grammarNotes: [
      {
        title: 'ご + 명사',
        explanation: '한자어 명사 앞 "ご"는 "お"와 같은 정중함 첨가. 보통 한자 단어에는 ご, 고유 일본어에는 お.',
      },
    ],
  },
  {
    text: '何か行き違いがあったようで、申し訳ございません。',
    translation: '뭔가 오해가 있었던 것 같아 죄송합니다.',
    pronunciation: '나니카 이키치가이가 앗타요-데, 모-시와케 고자이마셍',
    situation: '오해/실수에 대한 격식 있는 사과',
    difficulty: 'advanced',
    track: 'advanced',
    category: 'business',
    words: [
      { word: '行き違い', meaning: '엇갈림/오해', partOfSpeech: 'noun', pronunciation: '이키치가이' },
      { word: '申し訳ない', meaning: '죄송하다', partOfSpeech: 'adjective', pronunciation: '모-시와케나이' },
    ],
    grammarNotes: [
      {
        title: '申し訳ございません',
        explanation: '"申し訳ありません"보다 더 격식 있는 사과. 비즈니스/공식 사과의 최상급.',
      },
    ],
  },
  {
    text: '念のため確認させていただきます。',
    translation: '혹시 모르니 확인 부탁드리겠습니다.',
    pronunciation: '넹노타메 카쿠닝사세테 이타다키마스',
    situation: '재확인 요청을 정중하게',
    difficulty: 'advanced',
    track: 'advanced',
    category: 'business',
    words: [
      { word: '念のため', meaning: '혹시 모르니/만약을 위해', partOfSpeech: 'phrase', pronunciation: '넹노타메' },
      { word: '確認', meaning: '확인', partOfSpeech: 'noun', pronunciation: '카쿠닝' },
    ],
    grammarNotes: [
      {
        title: '~させていただく',
        explanation: '"~하겠습니다"의 가장 정중한 겸양 표현. 자신의 행동을 상대 허락 아래 한다는 뉘앙스.',
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // jlpt_n5 — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: '私は学生です。',
    translation: '저는 학생입니다.',
    pronunciation: '와타시와 가쿠세-데스',
    situation: '자기소개 — 자신의 신분/직업 말하기',
    difficulty: 'beginner',
    track: 'jlpt_n5',
    category: 'introduction',
    words: [
      { word: '私', meaning: '나/저', partOfSpeech: 'noun', pronunciation: '와타시' },
      { word: '学生', meaning: '학생', partOfSpeech: 'noun', pronunciation: '가쿠세-' },
    ],
    grammarNotes: [
      {
        title: 'AはBです',
        explanation: '"A는 B입니다" — 가장 기본 문장 구조. は는 주제 조사, です는 정중한 단정.',
        example: '彼は先生です。 — 그는 선생님입니다.',
      },
    ],
  },
  {
    text: '今日は寒いですね。',
    translation: '오늘은 춥네요.',
    pronunciation: '쿄-와 사무이데스네',
    situation: '날씨에 대한 가벼운 대화',
    difficulty: 'beginner',
    track: 'jlpt_n5',
    category: 'daily',
    words: [
      { word: '今日', meaning: '오늘', partOfSpeech: 'noun', pronunciation: '쿄-' },
      { word: '寒い', meaning: '춥다', partOfSpeech: 'adjective', pronunciation: '사무이' },
    ],
    grammarNotes: [
      {
        title: 'い형용사 + です',
        explanation: '"춥다(寒い)" 같은 い형용사는 그대로 です를 붙여 정중하게.',
        example: '高いです。 — 비쌉니다.',
      },
    ],
  },
  {
    text: '駅はどこですか。',
    translation: '역은 어디입니까?',
    pronunciation: '에키와 도코데스카',
    situation: '길을 물을 때',
    difficulty: 'beginner',
    track: 'jlpt_n5',
    category: 'travel',
    words: [
      { word: '駅', meaning: '역', partOfSpeech: 'noun', pronunciation: '에키' },
      { word: 'どこ', meaning: '어디', partOfSpeech: 'pronoun', pronunciation: '도코' },
    ],
    grammarNotes: [
      {
        title: '의문사 + ですか',
        explanation: 'どこ(어디)·なに(무엇)·だれ(누구) 등 의문사에 ですか를 붙여 정중한 의문문.',
      },
    ],
  },
  {
    text: 'ご飯を食べました。',
    translation: '밥을 먹었습니다.',
    pronunciation: '고항오 타베마시타',
    situation: '식사를 마쳤다고 말할 때',
    difficulty: 'beginner',
    track: 'jlpt_n5',
    category: 'meal',
    words: [
      { word: 'ご飯', meaning: '밥', partOfSpeech: 'noun', pronunciation: '고항' },
      { word: '食べる', meaning: '먹다', partOfSpeech: 'verb', pronunciation: '타베루' },
    ],
    grammarNotes: [
      {
        title: '동사 ました (과거형)',
        explanation: 'ます형 → ました로 바꿔 정중한 과거형. "食べます → 食べました".',
      },
    ],
  },
  {
    text: '月曜日に学校へ行きます。',
    translation: '월요일에 학교에 갑니다.',
    pronunciation: '게츠요-비니 갓코-에 이키마스',
    situation: '요일과 행선지를 말할 때',
    difficulty: 'beginner',
    track: 'jlpt_n5',
    category: 'daily',
    words: [
      { word: '月曜日', meaning: '월요일', partOfSpeech: 'noun', pronunciation: '게츠요-비' },
      { word: '学校', meaning: '학교', partOfSpeech: 'noun', pronunciation: '갓코-' },
      { word: '行く', meaning: '가다', partOfSpeech: 'verb', pronunciation: '이쿠' },
    ],
    grammarNotes: [
      {
        title: 'に vs へ',
        explanation: '시간 표시는 に(月曜日に), 방향 표시는 へ(学校へ). へ는 "에" 발음.',
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // jlpt_n4 — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: '友だちと映画を見に行きました。',
    translation: '친구와 영화를 보러 갔습니다.',
    pronunciation: '토모다치토 에-가오 미니 이키마시타',
    situation: '주말 활동을 이야기할 때',
    difficulty: 'intermediate',
    track: 'jlpt_n4',
    category: 'daily',
    words: [
      { word: '友だち', meaning: '친구', partOfSpeech: 'noun', pronunciation: '토모다치' },
      { word: '映画', meaning: '영화', partOfSpeech: 'noun', pronunciation: '에-가' },
    ],
    grammarNotes: [
      {
        title: '동사 ます형 + に行く',
        explanation: '"~하러 가다". ます형(語幹) + に + 行く. "見ます" → "見に行く".',
        example: '勉強しに行く。 — 공부하러 가다.',
      },
    ],
  },
  {
    text: 'もし時間があれば、手伝ってください。',
    translation: '시간이 있다면 도와주세요.',
    pronunciation: '모시 지캉가 아레바, 테츠닷테 쿠다사이',
    situation: '여유 있을 때 도움을 요청',
    difficulty: 'intermediate',
    track: 'jlpt_n4',
    category: 'daily',
    words: [
      { word: 'もし', meaning: '만약', partOfSpeech: 'adverb', pronunciation: '모시' },
      { word: '手伝う', meaning: '돕다', partOfSpeech: 'verb', pronunciation: '테츠다우' },
    ],
    grammarNotes: [
      {
        title: '~ば 가정형',
        explanation: '동사 가정형 ば. ある → あれば, 行く → 行けば. もし와 함께 자주 사용.',
      },
    ],
  },
  {
    text: '漢字を読むのはむずかしいです。',
    translation: '한자를 읽는 것은 어렵습니다.',
    pronunciation: '칸지오 요무노와 무즈카시이데스',
    situation: '학습 어려움을 표현',
    difficulty: 'intermediate',
    track: 'jlpt_n4',
    category: 'study',
    words: [
      { word: '漢字', meaning: '한자', partOfSpeech: 'noun', pronunciation: '칸지' },
      { word: '読む', meaning: '읽다', partOfSpeech: 'verb', pronunciation: '요무' },
      { word: 'むずかしい', meaning: '어렵다', partOfSpeech: 'adjective', pronunciation: '무즈카시-' },
    ],
    grammarNotes: [
      {
        title: '동사 + の (명사화)',
        explanation: '동사 사전형 + の는 "~하는 것". 読む + の = "읽는 것".',
        example: '走るのが好き。 — 달리는 것을 좋아한다.',
      },
    ],
  },
  {
    text: '雨が降っているかもしれません。',
    translation: '비가 오고 있을지도 모릅니다.',
    pronunciation: '아메가 훗테이루카모시레마셍',
    situation: '추측 표현',
    difficulty: 'intermediate',
    track: 'jlpt_n4',
    category: 'weather',
    words: [
      { word: '雨', meaning: '비', partOfSpeech: 'noun', pronunciation: '아메' },
      { word: '降る', meaning: '내리다', partOfSpeech: 'verb', pronunciation: '후루' },
    ],
    grammarNotes: [
      {
        title: '~かもしれない',
        explanation: '"~일지도 모른다"라는 추측. 정중형은 "~かもしれません".',
      },
    ],
  },
  {
    text: '日本語で話せるようになりたいです。',
    translation: '일본어로 말할 수 있게 되고 싶습니다.',
    pronunciation: '니홍고데 하나세루요-니 나리타이데스',
    situation: '학습 목표 말하기',
    difficulty: 'intermediate',
    track: 'jlpt_n4',
    category: 'study',
    words: [
      { word: '日本語', meaning: '일본어', partOfSpeech: 'noun', pronunciation: '니홍고' },
      { word: '話す', meaning: '말하다', partOfSpeech: 'verb', pronunciation: '하나스' },
    ],
    grammarNotes: [
      {
        title: '~ようになる',
        explanation: '"~할 수 있게 되다" — 능력/상태 변화 표현. 가능형 + ようになる.',
        example: '泳げるようになった。 — 수영할 수 있게 되었다.',
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // jlpt_n3 — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: 'このまま続けるべきかどうか迷っています。',
    translation: '이대로 계속해야 할지 망설이고 있습니다.',
    pronunciation: '코노마마 츠즈케루베키카도-카 마욧테이마스',
    situation: '결정 못 한 고민을 토로',
    difficulty: 'intermediate',
    track: 'jlpt_n3',
    category: 'feeling',
    words: [
      { word: 'このまま', meaning: '이대로', partOfSpeech: 'phrase', pronunciation: '코노마마' },
      { word: '続ける', meaning: '계속하다', partOfSpeech: 'verb', pronunciation: '츠즈케루' },
      { word: '迷う', meaning: '망설이다', partOfSpeech: 'verb', pronunciation: '마요우' },
    ],
    grammarNotes: [
      {
        title: '~べき + かどうか',
        explanation: '"~해야 할지 어떨지". べき(당위)+かどうか(여부)로 결정의 고민 표현.',
      },
    ],
  },
  {
    text: '彼は来るはずだったのに、まだ来ていません。',
    translation: '그는 올 줄 알았는데 아직 오지 않았습니다.',
    pronunciation: '카레와 쿠루하즈닷타노니, 마다 키테이마셍',
    situation: '예정대로 안 됐을 때',
    difficulty: 'intermediate',
    track: 'jlpt_n3',
    category: 'feeling',
    words: [
      { word: 'はず', meaning: '~할 터', partOfSpeech: 'noun', pronunciation: '하즈' },
      { word: 'のに', meaning: '인데', partOfSpeech: 'particle', pronunciation: '노니' },
    ],
    grammarNotes: [
      {
        title: '~はずだった のに',
        explanation: '"~했어야 했는데". 기대와 다른 결과의 불만/실망 표현.',
      },
    ],
  },
  {
    text: '寒くなってきたので、コートが必要です。',
    translation: '추워지기 시작해서 코트가 필요합니다.',
    pronunciation: '사무쿠 낫테키타노데, 코-토가 히츠요-데스',
    situation: '계절 변화에 대해',
    difficulty: 'intermediate',
    track: 'jlpt_n3',
    category: 'weather',
    words: [
      { word: 'コート', meaning: '코트', partOfSpeech: 'noun', pronunciation: '코-토' },
      { word: '必要', meaning: '필요', partOfSpeech: 'noun', pronunciation: '히츠요-' },
    ],
    grammarNotes: [
      {
        title: '~てくる (변화)',
        explanation: '"~해지다/~해 오다" — 점진적 변화. 寒い → 寒くなってくる(추워지기 시작하다).',
      },
    ],
  },
  {
    text: '大変だったけれど、いい経験になりました。',
    translation: '힘들었지만 좋은 경험이 되었습니다.',
    pronunciation: '타이헨닷타케레도, 이이 케-켄니 나리마시타',
    situation: '어려운 일을 마친 후 회고',
    difficulty: 'intermediate',
    track: 'jlpt_n3',
    category: 'feeling',
    words: [
      { word: '大変', meaning: '힘듦/큰일', partOfSpeech: 'adjective', pronunciation: '타이헨' },
      { word: '経験', meaning: '경험', partOfSpeech: 'noun', pronunciation: '케-켄' },
    ],
    grammarNotes: [
      {
        title: '~けれど (역접)',
        explanation: '"~지만" — けど(친근)/けれど(중립)/けれども(격식)로 정중도 단계.',
      },
    ],
  },
  {
    text: '雨にもかかわらず、試合は行われました。',
    translation: '비에도 불구하고 시합은 진행되었습니다.',
    pronunciation: '아메니모 카카와라즈, 시아이와 오코나와레마시타',
    situation: '예상 외 결과를 전할 때',
    difficulty: 'intermediate',
    track: 'jlpt_n3',
    category: 'event',
    words: [
      { word: 'にもかかわらず', meaning: '~에도 불구하고', partOfSpeech: 'phrase', pronunciation: '니모카카와라즈' },
      { word: '試合', meaning: '시합', partOfSpeech: 'noun', pronunciation: '시아이' },
    ],
    grammarNotes: [
      {
        title: '명사 + にもかかわらず',
        explanation: '"~에도 불구하고". 격식 있는 역접 표현. 뉴스·문어체에 자주 등장.',
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // jlpt_n2 — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: '健康のためには、毎日運動するべきです。',
    translation: '건강을 위해서는 매일 운동해야 합니다.',
    pronunciation: '켄코-노 타메니와, 마이니치 운도-스루베키데스',
    situation: '의견·조언을 표현',
    difficulty: 'advanced',
    track: 'jlpt_n2',
    category: 'health',
    words: [
      { word: '健康', meaning: '건강', partOfSpeech: 'noun', pronunciation: '켄코-' },
      { word: '運動', meaning: '운동', partOfSpeech: 'noun', pronunciation: '운도-' },
    ],
    grammarNotes: [
      {
        title: '~ためには',
        explanation: '"~위해서는" — 목적을 강조. 명사 + のためには / 동사 사전형 + ためには.',
      },
    ],
  },
  {
    text: '努力すればするほど、結果は良くなります。',
    translation: '노력하면 할수록 결과는 좋아집니다.',
    pronunciation: '도료쿠스레바스루호도, 켓카와 요쿠 나리마스',
    situation: '격언적 표현',
    difficulty: 'advanced',
    track: 'jlpt_n2',
    category: 'opinion',
    words: [
      { word: '努力', meaning: '노력', partOfSpeech: 'noun', pronunciation: '도료쿠' },
      { word: '結果', meaning: '결과', partOfSpeech: 'noun', pronunciation: '켓카' },
    ],
    grammarNotes: [
      {
        title: '~ば~ほど',
        explanation: '"~할수록 ~". 가정형 + 사전형 + ほど. 두 사건의 비례 관계.',
        example: '読めば読むほど面白い。 — 읽으면 읽을수록 재미있다.',
      },
    ],
  },
  {
    text: '君が言うとおりにしてみるよ。',
    translation: '네가 말한 대로 해볼게.',
    pronunciation: '키미가 이우토오리니 시테미루요',
    situation: '친근한 자리에서 동의·실행 약속',
    difficulty: 'advanced',
    track: 'jlpt_n2',
    category: 'daily',
    words: [
      { word: '君', meaning: '너', partOfSpeech: 'pronoun', pronunciation: '키미' },
      { word: 'とおり', meaning: '대로', partOfSpeech: 'noun', pronunciation: '토오리' },
    ],
    grammarNotes: [
      {
        title: '~とおりに',
        explanation: '"~대로". 동사 사전형/た형 + とおりに. "言うとおり" = "말하는 대로".',
      },
    ],
  },
  {
    text: '締め切りに間に合うように頑張ります。',
    translation: '마감에 늦지 않도록 노력하겠습니다.',
    pronunciation: '시메키리니 마니아우요-니 간바리마스',
    situation: '업무 마감 약속',
    difficulty: 'advanced',
    track: 'jlpt_n2',
    category: 'business',
    words: [
      { word: '締め切り', meaning: '마감', partOfSpeech: 'noun', pronunciation: '시메키리' },
      { word: '間に合う', meaning: '시간에 맞다', partOfSpeech: 'verb', pronunciation: '마니아우' },
      { word: '頑張る', meaning: '힘내다', partOfSpeech: 'verb', pronunciation: '간바루' },
    ],
    grammarNotes: [
      {
        title: '~ように',
        explanation: '"~하도록". 동사 사전형 + ように. 목적·바람을 부드럽게 표현.',
      },
    ],
  },
  {
    text: 'このような状況では慎重に判断するべきです。',
    translation: '이런 상황에서는 신중하게 판단해야 합니다.',
    pronunciation: '코노요-나 죠-쿄-데와 신쵸-니 한단스루베키데스',
    situation: '진지한 회의·논의',
    difficulty: 'advanced',
    track: 'jlpt_n2',
    category: 'opinion',
    words: [
      { word: '状況', meaning: '상황', partOfSpeech: 'noun', pronunciation: '죠-쿄-' },
      { word: '慎重', meaning: '신중', partOfSpeech: 'noun', pronunciation: '신쵸-' },
      { word: '判断', meaning: '판단', partOfSpeech: 'noun', pronunciation: '한단' },
    ],
    grammarNotes: [
      {
        title: 'このような + 명사',
        explanation: '"이런 ~". こんな(친근) / このような(격식) / こういう(중립).',
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // jlpt_n1 — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: '諸般の事情を考慮した上で、慎重に検討させていただきます。',
    translation: '여러 사정을 고려한 위에 신중히 검토하겠습니다.',
    pronunciation: '쇼한노 지죠-오 코-료시타 우에데, 신쵸-니 켄토-사세테 이타다키마스',
    situation: '공식 발표·답변에서',
    difficulty: 'advanced',
    track: 'jlpt_n1',
    category: 'formal',
    words: [
      { word: '諸般', meaning: '여러 가지', partOfSpeech: 'noun', pronunciation: '쇼한' },
      { word: '事情', meaning: '사정', partOfSpeech: 'noun', pronunciation: '지죠-' },
      { word: '考慮', meaning: '고려', partOfSpeech: 'noun', pronunciation: '코-료' },
      { word: '検討', meaning: '검토', partOfSpeech: 'noun', pronunciation: '켄토-' },
    ],
    grammarNotes: [
      {
        title: '~た上で',
        explanation: '"~한 위에/이후에". 절차/순서를 명시할 때. 격식 있는 문어체.',
      },
    ],
  },
  {
    text: '彼の発言は誤解を招きかねない表現を含んでいた。',
    translation: '그의 발언은 오해를 불러일으킬 수 있는 표현을 포함하고 있었다.',
    pronunciation: '카레노 하츠겐와 고카이오 마네키카네나이 효-겐오 후쿤데이타',
    situation: '뉴스·기사 분석',
    difficulty: 'advanced',
    track: 'jlpt_n1',
    category: 'formal',
    words: [
      { word: '発言', meaning: '발언', partOfSpeech: 'noun', pronunciation: '하츠겐' },
      { word: '誤解', meaning: '오해', partOfSpeech: 'noun', pronunciation: '고카이' },
      { word: '招く', meaning: '초대하다/불러일으키다', partOfSpeech: 'verb', pronunciation: '마네쿠' },
    ],
    grammarNotes: [
      {
        title: '~かねない',
        explanation: '"~할 수도 있다(부정적 가능성)". ます형 + かねない. 우려·경고 뉘앙스.',
        example: '事故を起こしかねない。 — 사고를 일으킬 수도 있다.',
      },
    ],
  },
  {
    text: '経済の動向を踏まえて戦略を見直す必要がある。',
    translation: '경제 동향을 바탕으로 전략을 재검토할 필요가 있다.',
    pronunciation: '케-자이노 도-코-오 후마에테 센랴쿠오 미나오스 히츠요-가 아루',
    situation: '비즈니스 분석/전략 회의',
    difficulty: 'advanced',
    track: 'jlpt_n1',
    category: 'business',
    words: [
      { word: '動向', meaning: '동향', partOfSpeech: 'noun', pronunciation: '도-코-' },
      { word: '踏まえる', meaning: '근거로 삼다', partOfSpeech: 'verb', pronunciation: '후마에루' },
      { word: '戦略', meaning: '전략', partOfSpeech: 'noun', pronunciation: '센랴쿠' },
    ],
    grammarNotes: [
      {
        title: '~を踏まえて',
        explanation: '"~를 바탕으로/근거로". 격식 있는 인과/근거 표현.',
      },
    ],
  },
  {
    text: '一概には言えないが、長期的には改善が見込まれる。',
    translation: '단정 짓기는 어렵지만 장기적으로는 개선이 예상된다.',
    pronunciation: '이치가이니와 이에나이가, 쵸-키테키니와 카이젠가 미코마레루',
    situation: '신중한 분석·예측',
    difficulty: 'advanced',
    track: 'jlpt_n1',
    category: 'opinion',
    words: [
      { word: '一概に', meaning: '일률적으로', partOfSpeech: 'adverb', pronunciation: '이치가이니' },
      { word: '長期的', meaning: '장기적', partOfSpeech: 'adjective', pronunciation: '쵸-키테키' },
      { word: '見込む', meaning: '예상하다', partOfSpeech: 'verb', pronunciation: '미코무' },
    ],
    grammarNotes: [
      {
        title: '~が見込まれる',
        explanation: '"~가 예상된다" — 수동형으로 객관적·중립적 추측. 뉴스·보고서 어휘.',
      },
    ],
  },
  {
    text: 'やむを得ず予定を変更させていただきます。',
    translation: '부득이하게 일정을 변경하게 되었습니다.',
    pronunciation: '야무오에즈 요테-오 헨코-사세테 이타다키마스',
    situation: '공식 일정 변경 통보',
    difficulty: 'advanced',
    track: 'jlpt_n1',
    category: 'formal',
    words: [
      { word: 'やむを得ず', meaning: '부득이하게', partOfSpeech: 'phrase', pronunciation: '야무오에즈' },
      { word: '予定', meaning: '예정', partOfSpeech: 'noun', pronunciation: '요테-' },
      { word: '変更', meaning: '변경', partOfSpeech: 'noun', pronunciation: '헨코-' },
    ],
    grammarNotes: [
      {
        title: 'やむを得ず',
        explanation: '"어쩔 수 없이/부득이하게". 회의적·격식 있는 부사. 공식 통보에서 자주 사용.',
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // jpt (비즈니스 일본어) — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: 'お世話になっております。',
    translation: '신세지고 있습니다.',
    pronunciation: '오세와니 낫테 오리마스',
    situation: '거래처에 보내는 메일/전화의 첫인사',
    difficulty: 'advanced',
    track: 'jpt',
    category: 'business',
    words: [
      { word: 'お世話', meaning: '신세/도움', partOfSpeech: 'noun', pronunciation: '오세와' },
      { word: 'なる', meaning: '되다', partOfSpeech: 'verb', pronunciation: '나루' },
    ],
    grammarNotes: [
      {
        title: 'お世話になっております',
        explanation: '일본 비즈니스 표준 첫인사. 메일·전화 첫 줄에 거의 필수.',
      },
    ],
  },
  {
    text: '会議の議事録を共有させていただきます。',
    translation: '회의 의사록을 공유드리겠습니다.',
    pronunciation: '카이기노 기지로쿠오 쿄-유-사세테 이타다키마스',
    situation: '회의 후 후속 메일',
    difficulty: 'advanced',
    track: 'jpt',
    category: 'business',
    words: [
      { word: '議事録', meaning: '의사록', partOfSpeech: 'noun', pronunciation: '기지로쿠' },
      { word: '共有', meaning: '공유', partOfSpeech: 'noun', pronunciation: '쿄-유-' },
    ],
    grammarNotes: [
      {
        title: '명사 + させていただきます',
        explanation: '"~하게 해주세요"의 가장 정중한 형태. 자신의 행동을 상대 허락 아래 한다는 겸양.',
      },
    ],
  },
  {
    text: '来週中に納品予定です。',
    translation: '다음 주 중으로 납품 예정입니다.',
    pronunciation: '라이슈-츄-니 노-힝 요테-데스',
    situation: '납기 안내',
    difficulty: 'advanced',
    track: 'jpt',
    category: 'business',
    words: [
      { word: '来週', meaning: '다음 주', partOfSpeech: 'noun', pronunciation: '라이슈-' },
      { word: '納品', meaning: '납품', partOfSpeech: 'noun', pronunciation: '노-힝' },
    ],
    grammarNotes: [
      {
        title: '~中に',
        explanation: '"~중에/~안에". 기간/범위를 한정. 来週中に = 다음 주 안에.',
      },
    ],
  },
  {
    text: 'ご検討のほど、よろしくお願い申し上げます。',
    translation: '검토 잘 부탁드립니다.',
    pronunciation: '고켄토-노 호도, 요로시쿠 오네가이 모-시아게마스',
    situation: '제안/요청 메일의 마무리',
    difficulty: 'advanced',
    track: 'jpt',
    category: 'business',
    words: [
      { word: '検討', meaning: '검토', partOfSpeech: 'noun', pronunciation: '켄토-' },
      { word: '申し上げる', meaning: '말씀드리다(겸양)', partOfSpeech: 'verb', pronunciation: '모-시아게루' },
    ],
    grammarNotes: [
      {
        title: 'お願い申し上げます',
        explanation: '"부탁드립니다"의 최상급 정중 표현. 공식 메일 마무리에 자주 사용.',
      },
    ],
  },
  {
    text: '念のため、確認させていただきたい点がございます。',
    translation: '혹시 모르니 확인하고 싶은 점이 있습니다.',
    pronunciation: '넹노타메, 카쿠닝사세테 이타다키타이 텐가 고자이마스',
    situation: '추가 질문 전 양해 구하기',
    difficulty: 'advanced',
    track: 'jpt',
    category: 'business',
    words: [
      { word: '点', meaning: '점/사항', partOfSpeech: 'noun', pronunciation: '텐' },
      { word: 'ございます', meaning: '있습니다(공손)', partOfSpeech: 'verb', pronunciation: '고자이마스' },
    ],
    grammarNotes: [
      {
        title: '~たい + ございます 조합',
        explanation: '"~하고 싶은 ~가 있습니다"의 최상급 정중. ある → ございます로 격식 더해줌.',
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════
  // conversation (회화) — 5
  // ════════════════════════════════════════════════════════════════
  {
    text: 'ちょっと聞いて！すごいことあったんだよ。',
    translation: '잠깐 들어봐! 굉장한 일 있었어.',
    pronunciation: '춋토 키이테! 스고이 코토 앗탄다요',
    situation: '친구에게 흥분해서 이야기 시작',
    difficulty: 'intermediate',
    track: 'conversation',
    category: 'daily',
    words: [
      { word: 'すごい', meaning: '굉장한/대단한', partOfSpeech: 'adjective', pronunciation: '스고이' },
      { word: 'こと', meaning: '일/사건', partOfSpeech: 'noun', pronunciation: '코토' },
    ],
    grammarNotes: [
      {
        title: '~んだ (회화체)',
        explanation: '강조·설명의 のだ를 회화체로 줄인 형태. 친근한 자리에서 자주 사용.',
      },
    ],
  },
  {
    text: 'それマジ？うそでしょ！',
    translation: '그거 진짜? 거짓말이지!',
    pronunciation: '소레 마지? 우소데쇼!',
    situation: '놀라움을 표현',
    difficulty: 'intermediate',
    track: 'conversation',
    category: 'daily',
    words: [
      { word: 'マジ', meaning: '진짜', partOfSpeech: 'adverb', pronunciation: '마지' },
      { word: 'うそ', meaning: '거짓말', partOfSpeech: 'noun', pronunciation: '우소' },
    ],
    grammarNotes: [
      {
        title: 'うそでしょ',
        explanation: '"거짓말이지" — 직역과 달리 "말도 안 돼"의 놀라움 반응. 정말 거짓말이라고 비난하는 게 아님.',
      },
    ],
  },
  {
    text: '今度ご飯でも食べに行こうよ。',
    translation: '다음에 밥이라도 먹으러 가자.',
    pronunciation: '콘도 고항데모 타베니 이코-요',
    situation: '친구에게 가벼운 약속 제안',
    difficulty: 'intermediate',
    track: 'conversation',
    category: 'daily',
    words: [
      { word: '今度', meaning: '다음/이번에', partOfSpeech: 'noun', pronunciation: '콘도' },
      { word: 'でも', meaning: '~라도', partOfSpeech: 'particle', pronunciation: '데모' },
    ],
    grammarNotes: [
      {
        title: '동사 의지형 + よ',
        explanation: '"~하자"의 권유 형태. 行く → 行こう. 종조사 よ로 권유 강조.',
      },
    ],
  },
  {
    text: 'なんかちょっと疲れちゃった。',
    translation: '뭔가 좀 피곤해졌어.',
    pronunciation: '난카 춋토 츠카레챳타',
    situation: '하루 일과를 마치고 친구에게',
    difficulty: 'intermediate',
    track: 'conversation',
    category: 'feeling',
    words: [
      { word: 'なんか', meaning: '뭔가/어쩐지', partOfSpeech: 'adverb', pronunciation: '난카' },
      { word: '疲れる', meaning: '피곤하다', partOfSpeech: 'verb', pronunciation: '츠카레루' },
    ],
    grammarNotes: [
      {
        title: '~ちゃった (회화체)',
        explanation: '~てしまった의 축약. 의도치 않은 상태/결과를 가볍게 표현.',
        example: '寝ちゃった。 — 자버렸어.',
      },
    ],
  },
  {
    text: '全然気にしないで、大丈夫だよ。',
    translation: '전혀 신경 쓰지 마, 괜찮아.',
    pronunciation: '젠젠 키니시나이데, 다이죠-부다요',
    situation: '미안해하는 친구를 안심시킬 때',
    difficulty: 'intermediate',
    track: 'conversation',
    category: 'feeling',
    words: [
      { word: '全然', meaning: '전혀', partOfSpeech: 'adverb', pronunciation: '젠젠' },
      { word: '気にする', meaning: '신경 쓰다', partOfSpeech: 'verb', pronunciation: '키니스루' },
      { word: '大丈夫', meaning: '괜찮다', partOfSpeech: 'adjective', pronunciation: '다이죠-부' },
    ],
    grammarNotes: [
      {
        title: '~ないで',
        explanation: '"~하지 마". 동사 ない형 + で. 부드러운 부정 명령.',
      },
    ],
  },
];
