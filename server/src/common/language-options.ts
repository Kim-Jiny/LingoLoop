export const targetLanguages = ['en', 'ja'] as const;

export const nativeLanguages = ['ko', 'en', 'ja', 'es'] as const;

export const learningTracksByLanguage = {
  en: [
    'beginner',
    'intermediate',
    'advanced',
    'toeic',
    'toefl',
    'conversation',
  ],
  ja: [
    'beginner',
    'intermediate',
    'advanced',
    'jlpt_n5',
    'jlpt_n4',
    'jlpt_n3',
    'jlpt_n2',
    'jlpt_n1',
    'jpt',
    'conversation',
  ],
} as const satisfies Record<
  (typeof targetLanguages)[number],
  readonly string[]
>;

export const learningTracks = [
  ...new Set(Object.values(learningTracksByLanguage).flat()),
];
