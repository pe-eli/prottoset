import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import type {
  ScheduleItem, CalendarEvent, ScheduleCategory, DayHoursSummary,
} from '../features/schedule/schedule.types';

dayjs.extend(isoWeek);

// ─── Time Parsing ────────────────────────────────────────────

/** Parse "HH:mm" to total minutes from midnight */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Minutes from midnight → "HH:mm" */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Duration in hours between two time strings */
export function timeDurationHours(startTime: string, endTime: string): number {
  const diff = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Math.max(0, diff / 60);
}

// ─── Calendar Position ───────────────────────────────────────

const CALENDAR_START_HOUR = 6;   // 06:00
const CALENDAR_END_HOUR = 23;    // 23:00
const CALENDAR_TOTAL_MINUTES = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60;

/** Convert a time to a CSS percentage offset from calendar top */
export function timeToTopPercent(time: string): number {
  const mins = timeToMinutes(time) - CALENDAR_START_HOUR * 60;
  return Math.max(0, Math.min(100, (mins / CALENDAR_TOTAL_MINUTES) * 100));
}

/** Duration of a block as a CSS percentage height */
export function durationToHeightPercent(startTime: string, endTime: string): number {
  const dur = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Math.max(0, Math.min(100, (dur / CALENDAR_TOTAL_MINUTES) * 100));
}

export { CALENDAR_START_HOUR, CALENDAR_END_HOUR };

// ─── Week Generation ─────────────────────────────────────────

/** Get the 7 dates (Mon→Sun) for the week containing the given date */
export function getWeekDates(referenceDate: string): string[] {
  const d = dayjs(referenceDate).startOf('isoWeek'); // Monday
  return Array.from({ length: 7 }, (_, i) => d.add(i, 'day').format('YYYY-MM-DD'));
}

/** Navigate weeks  */
export function shiftWeek(referenceDate: string, offset: number): string {
  return dayjs(referenceDate).add(offset, 'week').format('YYYY-MM-DD');
}

// ─── Recurrence Expansion ────────────────────────────────────

/** Expand all ScheduleItems into CalendarEvents for a given week */
export function expandEventsForWeek(
  items: ScheduleItem[],
  weekDates: string[]
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const item of items) {
    if (item.recurrence) {
      // Recurring — place on every matching day in the week
      for (const dateStr of weekDates) {
        const dow = dayjs(dateStr).day(); // 0 = Sun
        if (dow === item.recurrence.dayOfWeek) {
          events.push({
            id: `${item.id}_${dateStr}`,
            sourceId: item.id,
            title: item.title,
            category: item.category,
            startTime: item.startTime,
            endTime: item.endTime,
            date: dateStr,
            isRecurring: true,
          });
        }
      }
    } else if (item.date) {
      // One-time — only if date falls in this week
      if (weekDates.includes(item.date)) {
        events.push({
          id: item.id,
          sourceId: item.id,
          title: item.title,
          category: item.category,
          startTime: item.startTime,
          endTime: item.endTime,
          date: item.date,
          isRecurring: false,
        });
      }
    }
  }

  return events;
}

// ─── Planned Hours Summary ───────────────────────────────────

export function getPlannedHoursForDates(
  events: CalendarEvent[],
  dates: string[]
): DayHoursSummary[] {
  return dates.map((date) => {
    const dayEvents = events.filter((e) => e.date === date);
    const byCategory = { prottocode: 0, alura: 0, dimouras: 0 };
    for (const ev of dayEvents) {
      byCategory[ev.category] += timeDurationHours(ev.startTime, ev.endTime);
    }
    return {
      date,
      prottocode: Math.round(byCategory.prottocode * 10) / 10,
      alura: Math.round(byCategory.alura * 10) / 10,
      dimouras: Math.round(byCategory.dimouras * 10) / 10,
      total: Math.round((byCategory.prottocode + byCategory.alura + byCategory.dimouras) * 10) / 10,
    };
  });
}

export function getWeekPlannedTotals(summaries: DayHoursSummary[]) {
  return {
    prottocode: Math.round(summaries.reduce((s, d) => s + d.prottocode, 0) * 10) / 10,
    alura: Math.round(summaries.reduce((s, d) => s + d.alura, 0) * 10) / 10,
    dimouras: Math.round(summaries.reduce((s, d) => s + d.dimouras, 0) * 10) / 10,
    total: Math.round(summaries.reduce((s, d) => s + d.total, 0) * 10) / 10,
  };
}

// ─── Category Colors ─────────────────────────────────────────

export const CATEGORY_CONFIG: Record<ScheduleCategory, {
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}> = {
  prottocode: {
    label: 'Prottocode',
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  alura: {
    label: 'Alura',
    bg: 'bg-violet-50',
    border: 'border-violet-400',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
  },
  dimouras: {
    label: 'Dimouras',
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
};

// ─── Day Labels ──────────────────────────────────────────────

const DAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function getDayLabel(dateStr: string): string {
  return DAY_LABELS_SHORT[dayjs(dateStr).day()];
}

/** Generate hours array for the time column */
export function getCalendarHours(): number[] {
  return Array.from(
    { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
    (_, i) => CALENDAR_START_HOUR + i
  );
}
