import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import type { DailyEntry, WeeklySummary } from '../features/productivity/productivity.types';

dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);

export function getWeekString(dateStr: string): string {
  const d = dayjs(dateStr);
  return `${d.isoWeekYear()}-W${String(d.isoWeek()).padStart(2, '0')}`;
}

export function calculateProductivityScore(
  prottocodeHours: number,
  aluraHours: number,
  dimourasHours: number
): number {
  return Math.round((prottocodeHours * 0.6 + aluraHours * 0.2 + dimourasHours * 0.2) * 10) / 10;
}

export function getTotalHours(entry: DailyEntry): number {
  return entry.prottocodeHours + entry.aluraHours + entry.dimourasHours;
}

export function groupByWeek(entries: DailyEntry[]): WeeklySummary[] {
  const weekMap = new Map<string, DailyEntry[]>();

  for (const entry of entries) {
    const week = entry.week || getWeekString(entry.date);
    if (!weekMap.has(week)) weekMap.set(week, []);
    weekMap.get(week)!.push(entry);
  }

  const summaries: WeeklySummary[] = [];

  for (const [week, weekEntries] of weekMap) {
    const sorted = [...weekEntries].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

    const totalProttocodeHours = sorted.reduce((s, e) => s + e.prottocodeHours, 0);
    const totalAluraHours = sorted.reduce((s, e) => s + e.aluraHours, 0);
    const totalDimourasHours = sorted.reduce((s, e) => s + e.dimourasHours, 0);
    const totalHours = totalProttocodeHours + totalAluraHours + totalDimourasHours;
    const averageCompletion = sorted.length
      ? Math.round(sorted.reduce((s, e) => s + e.completion, 0) / sorted.length)
      : 0;
    const productivityScore = calculateProductivityScore(
      totalProttocodeHours,
      totalAluraHours,
      totalDimourasHours
    );

    let bestDay: DailyEntry | null = null;
    let bestTotal = -1;
    for (const e of sorted) {
      const t = getTotalHours(e);
      if (t > bestTotal) {
        bestTotal = t;
        bestDay = e;
      }
    }

    summaries.push({
      week,
      totalProttocodeHours,
      totalAluraHours,
      totalDimourasHours,
      totalHours,
      productivityScore,
      averageCompletion,
      bestDay,
      entries: sorted,
    });
  }

  return summaries.sort((a, b) => (b.week ?? '').localeCompare(a.week ?? ''));
}

export function formatWeekLabel(week: string): string {
  // "2026-W14" -> "Semana 14, 2026"
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return week;
  return `Semana ${parseInt(match[2])}, ${match[1]}`;
}

export function getRatingColor(rating: string): string {
  switch (rating) {
    case 'excellent': return 'text-emerald-600 bg-emerald-50';
    case 'good': return 'text-blue-600 bg-blue-50';
    case 'average': return 'text-amber-600 bg-amber-50';
    case 'bad': return 'text-red-600 bg-red-50';
    default: return 'text-brand-400 bg-brand-50';
  }
}

export function getRatingLabel(rating: string): string {
  switch (rating) {
    case 'excellent': return 'Excelente';
    case 'good': return 'Bom';
    case 'average': return 'Médio';
    case 'bad': return 'Ruim';
    default: return rating;
  }
}

export function getDayOfWeekLabel(dateStr: string): string {
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return days[dayjs(dateStr).day()];
}
