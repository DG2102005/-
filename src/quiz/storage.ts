import type { QuizProgress, QuizQuestion, QuizSettings, SimulatorSave } from '../game/quizTypes';

const PREFIX = 'redcenter.quiz.';
const KEY_PROGRESS = PREFIX + 'progress';
const KEY_CUSTOM = PREFIX + 'customQuestions';
const KEY_SIMULATOR = PREFIX + 'simulator';
const KEY_SETTINGS = PREFIX + 'settings';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function generateCustomId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 36 * 36 * 36 * 36).toString(36).padStart(4, '0');
  return 'cust_' + ts + rand;
}

const defaultProgress: QuizProgress = {
  answeredIds: [],
  correctIds: [],
  wrongIds: [],
  favoriteIds: [],
  mode: 'default',
  currentIndex: 0,
  statsByCategory: {},
  updatedAt: 0,
};

export function loadProgress(): QuizProgress {
  return read<QuizProgress>(KEY_PROGRESS, { ...defaultProgress });
}

export function saveProgress(progress: QuizProgress): boolean {
  const p = { ...progress, updatedAt: Date.now() };
  return write(KEY_PROGRESS, p);
}

export function resetProgress(): boolean {
  return write(KEY_PROGRESS, { ...defaultProgress, updatedAt: Date.now() });
}

export function loadCustomQuestions(): QuizQuestion[] {
  return read<QuizQuestion[]>(KEY_CUSTOM, []);
}

export function saveCustomQuestions(questions: QuizQuestion[]): boolean {
  return write(KEY_CUSTOM, questions);
}

export function updateCustomQuestion(q: QuizQuestion): boolean {
  const list = loadCustomQuestions();
  const idx = list.findIndex((x) => x.id === q.id);
  if (idx >= 0) {
    list[idx] = { ...q, updatedAt: Date.now() };
  } else {
    list.push({ ...q, createdAt: q.createdAt ?? Date.now(), updatedAt: Date.now() });
  }
  return saveCustomQuestions(list);
}

export function deleteCustomQuestion(id: string): boolean {
  const list = loadCustomQuestions().filter((x) => x.id !== id);
  return saveCustomQuestions(list);
}

const defaultSimulator: SimulatorSave = { selectedCodes: [] };

export function loadSimulator(): SimulatorSave {
  return read<SimulatorSave>(KEY_SIMULATOR, { ...defaultSimulator });
}

export function saveSimulator(save: SimulatorSave): boolean {
  return write(KEY_SIMULATOR, save);
}

const defaultSettings: QuizSettings = { soundOn: true, autoNext: false };

export function loadSettings(): QuizSettings {
  return read<QuizSettings>(KEY_SETTINGS, { ...defaultSettings });
}

export function saveSettings(settings: QuizSettings): boolean {
  return write(KEY_SETTINGS, settings);
}
