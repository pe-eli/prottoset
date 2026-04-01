export type DailyRating = 'excellent' | 'good' | 'average' | 'bad';

export interface DailyEntry {
  id: string;
  date: string;
  week: string;
  prottocodeHours: number;
  aluraHours: number;
  dimourasHours: number;
  focus: string;
  completion: number;
  notes: string;
  rating: DailyRating;
  createdAt: string;
  updatedAt: string;
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
