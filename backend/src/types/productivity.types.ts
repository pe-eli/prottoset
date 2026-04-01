export type DailyRating = 'excellent' | 'good' | 'average' | 'bad';

export interface DailyEntry {
  id: string;
  date: string;           // ISO date string (YYYY-MM-DD)
  week: string;           // e.g. "2026-W14"
  prottocodeHours: number;
  aluraHours: number;
  dimourasHours: number;
  focus: string;
  completion: number;     // 0-100
  notes: string;
  rating: DailyRating;
  createdAt: string;      // ISO datetime
  updatedAt: string;      // ISO datetime
}

export interface CreateDailyEntryParams {
  date: string;
  prottocodeHours: number;
  aluraHours: number;
  dimourasHours: number;
  focus: string;
  completion: number;
  notes: string;
  rating: DailyRating;
}

export interface WeeklySummary {
  week: string;
  totalProttocodeHours: number;
  totalAluraHours: number;
  totalDimourasHours: number;
  totalHours: number;
  productivityScore: number;
  averageCompletion: number;
  bestDay: DailyEntry | null;
  entries: DailyEntry[];
}
