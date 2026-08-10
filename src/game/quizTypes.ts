export type QuizCategory = '搭子取舍' | '听牌选择' | '红中运用' | '对子处理' | '金张判断' | '综合复杂';
export type Difficulty = 'easy' | 'medium' | 'hard';
export interface QuizQuestion {
  id: string;
  title?: string;
  category: QuizCategory | string;
  difficulty: Difficulty;
  handCodes: string[];
  meldCount: number;
  question: string;
  optionCodes: string[];
  answerIndex: 0 | 1 | 2 | 3;
  explanation: string;
  discardsPool?: string[];
  tags?: string[];
  version: number;
  createdAt?: number;
  updatedAt?: number;
}
export interface QuizStats { correct: number; answered: number; }
export interface QuizProgress {
  answeredIds: string[]; correctIds: string[]; wrongIds: string[]; favoriteIds: string[];
  mode: string; currentIndex: number; statsByCategory: Record<string, QuizStats>; updatedAt: number;
}
export interface QuizSettings { soundOn: boolean; autoNext: boolean; }
export interface SimulatorSave { selectedCodes: string[]; selectedDiscardCode?: string; }
