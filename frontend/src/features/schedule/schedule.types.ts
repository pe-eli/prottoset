export type ScheduleCategory = 'prottocode' | 'alura' | 'dimouras';

export interface ScheduleRecurrence {
  type: 'weekly';
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
}

export interface ScheduleItem {
  id: string;
  title: string;
  category: ScheduleCategory;
  startTime: string;  // "09:00"
  endTime: string;    // "11:00"
  date?: string;      // YYYY-MM-DD for one-time events
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

/** A resolved event placed on a specific date (for display in the calendar) */
export interface CalendarEvent {
  id: string;
  sourceId: string;   // ScheduleItem.id
  title: string;
  category: ScheduleCategory;
  startTime: string;
  endTime: string;
  date: string;        // resolved date YYYY-MM-DD
  isRecurring: boolean;
}

export interface DayHoursSummary {
  date: string;
  prottocode: number;
  alura: number;
  dimouras: number;
  total: number;
}
