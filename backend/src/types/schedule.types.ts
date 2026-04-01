export type ScheduleCategory = 'prottocode' | 'alura' | 'dimouras';

export interface ScheduleRecurrence {
  type: 'weekly';
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

export interface ScheduleItem {
  id: string;
  title: string;
  category: ScheduleCategory;
  startTime: string;  // "09:00"
  endTime: string;    // "11:00"
  date?: string;      // YYYY-MM-DD — for one-time events
  recurrence?: ScheduleRecurrence;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleItemParams {
  title: string;
  category: ScheduleCategory;
  startTime: string;
  endTime: string;
  date?: string;
  recurrence?: ScheduleRecurrence;
}
