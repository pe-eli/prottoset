import { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useScheduleStore } from '../store/scheduleStore';
import { useProductivityStore } from '../store/productivityStore';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EventBlock } from '../features/schedule/EventBlock';
import { EventModal } from '../features/schedule/EventModal';
import type { CalendarEvent, CreateScheduleItemParams } from '../features/schedule/schedule.types';
import {
  getWeekDates,
  shiftWeek,
  expandEventsForWeek,
  getPlannedHoursForDates,
  getWeekPlannedTotals,
  getCalendarHours,
  getDayLabel,
  CATEGORY_CONFIG,
  timeToTopPercent,
} from '../utils/schedule';

export function SchedulePage() {
  const { items, loading, fetchItems, createItem, updateItem, deleteItem } = useScheduleStore();
  const { entries: productivityEntries, fetchEntries: fetchProductivity } = useProductivityStore();

  const [weekRef, setWeekRef] = useState(dayjs().format('YYYY-MM-DD'));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [clickDate, setClickDate] = useState<string | undefined>();
  const [clickTime, setClickTime] = useState<string | undefined>();

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchItems(); fetchProductivity(); }, [fetchItems, fetchProductivity]);

  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);
  const events = useMemo(() => expandEventsForWeek(items, weekDates), [items, weekDates]);
  const plannedSummaries = useMemo(() => getPlannedHoursForDates(events, weekDates), [events, weekDates]);
  const weekTotals = useMemo(() => getWeekPlannedTotals(plannedSummaries), [plannedSummaries]);
  const calendarHours = useMemo(() => getCalendarHours(), []);

  // Current time line position
  const [now, setNow] = useState(dayjs());
  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const todayStr = now.format('YYYY-MM-DD');
  const nowTimeStr = now.format('HH:mm');
  const nowTopPct = timeToTopPercent(nowTimeStr);
  const isThisWeek = weekDates.includes(todayStr);

  // Actual hours from productivity entries for this week
  const actualByDate = useMemo(() => {
    const map = new Map<string, { prottocode: number; alura: number; dimouras: number }>();
    for (const e of productivityEntries) {
      if (weekDates.includes(e.date)) {
        map.set(e.date, {
          prottocode: e.prottocodeHours,
          alura: e.aluraHours,
          dimouras: e.dimourasHours,
        });
      }
    }
    return map;
  }, [productivityEntries, weekDates]);

  const actualTotals = useMemo(() => {
    let prottocode = 0, alura = 0, dimouras = 0;
    for (const v of actualByDate.values()) {
      prottocode += v.prottocode;
      alura += v.alura;
      dimouras += v.dimouras;
    }
    return { prottocode, alura, dimouras, total: prottocode + alura + dimouras };
  }, [actualByDate]);

  const handleCellClick = (date: string, hour: number) => {
    setEditingEvent(null);
    setClickDate(date);
    setClickTime(`${String(hour).padStart(2, '0')}:00`);
    setModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event);
    setClickDate(undefined);
    setClickTime(undefined);
    setModalOpen(true);
  };

  const handleCreate = async (params: CreateScheduleItemParams) => {
    await createItem(params);
  };

  const handleUpdate = async (id: string, params: Partial<CreateScheduleItemParams>) => {
    await updateItem(id, params);
  };

  const handleDelete = async (id: string) => {
    await deleteItem(id);
  };

  const weekLabel = `${dayjs(weekDates[0]).format('DD MMM')} – ${dayjs(weekDates[6]).format('DD MMM, YYYY')}`;

  if (loading && items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto animate-fade-in flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/produtividade"
            className="w-9 h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Agenda</h1>
            <p className="text-sm text-text-secondary">{weekLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekRef(shiftWeek(weekRef, -1))}
            className="w-9 h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setWeekRef(dayjs().format('YYYY-MM-DD'))}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-surface-secondary text-text-primary hover:bg-surface-elevated transition-colors"
          >
            Hoje
          </button>
          <button
            onClick={() => setWeekRef(shiftWeek(weekRef, 1))}
            className="w-9 h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => { setEditingEvent(null); setClickDate(todayStr); setClickTime('09:00'); setModalOpen(true); }}
            className="ml-2 px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25 hover:shadow-lg transition-all active:scale-[0.98]"
          >
            + Evento
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total planejado" value={`${weekTotals.total}h`} color="from-brand-500 to-brand-600" />
        <StatCard label="Prottocode" value={`${weekTotals.prottocode}h`} color="from-blue-500 to-blue-600" />
        <StatCard label="Alura" value={`${weekTotals.alura}h`} color="from-violet-500 to-violet-600" />
        <StatCard label="Dimouras" value={`${weekTotals.dimouras}h`} color="from-amber-500 to-amber-600" />
      </div>

      {/* Calendar Grid */}
      <Card className="!p-0 overflow-hidden">
        {/* Day headers */}
        <div className="grid border-b border-border-light" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
          <div className="p-2" />
          {weekDates.map((date) => {
            const isToday = date === todayStr;
            return (
              <div
                key={date}
                className={`p-2 text-center border-l border-border-light ${isToday ? 'bg-brand-50' : ''}`}
              >
                <p className={`text-xs font-medium ${isToday ? 'text-brand-600' : 'text-brand-400'}`}>
                  {getDayLabel(date)}
                </p>
                <p className={`text-lg font-bold ${isToday ? 'text-brand-200' : 'text-text-primary'}`}>
                  {dayjs(date).format('DD')}
                </p>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div
          ref={gridRef}
          className="grid relative overflow-y-auto"
          style={{
            gridTemplateColumns: '56px repeat(7, 1fr)',
            height: 'calc(100vh - 340px)',
            minHeight: 500,
          }}
        >
          {/* Time labels column */}
          <div className="relative">
            {calendarHours.map((hour) => (
              <div
                key={hour}
                className="border-b border-border-light/50 text-right pr-2 flex items-start justify-end"
                style={{ height: `${100 / calendarHours.length}%` }}
              >
                <span className="text-[10px] text-brand-300 -translate-y-1.5 tabular-nums">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date) => {
            const dayEvents = events.filter((e) => e.date === date);
            const isToday = date === todayStr;

            return (
              <div
                key={date}
                className={`relative border-l border-border-light ${isToday ? 'bg-brand-50/30' : ''}`}
              >
                {/* Hour cells (clickable) */}
                {calendarHours.map((hour) => (
                  <div
                    key={hour}
                    onClick={() => handleCellClick(date, hour)}
                    className="border-b border-border-light/50 hover:bg-brand-50/40 cursor-pointer transition-colors"
                    style={{ height: `${100 / calendarHours.length}%` }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => (
                  <EventBlock key={event.id} event={event} onClick={handleEventClick} />
                ))}

                {/* Current time line */}
                {isToday && isThisWeek && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: `${nowTopPct}%` }}
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                      <div className="flex-1 h-[2px] bg-red-500" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Planned vs Actual Comparison */}
      {actualByDate.size > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-text-primary mb-4">Planejado vs Realizado</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['prottocode', 'alura', 'dimouras'] as const).map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              const planned = weekTotals[cat];
              const actual = actualTotals[cat];
              const pct = planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : 0;

              return (
                <div key={cat} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                      <span className="text-xs font-semibold text-text-primary">{config.label}</span>
                    </div>
                    <span className="text-xs text-brand-400">{actual}h / {planned}h</span>
                  </div>
                  <ProgressBar
                    value={pct}
                    color={cat === 'prottocode' ? 'bg-blue-500' : cat === 'alura' ? 'bg-violet-500' : 'bg-amber-500'}
                    showLabel
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border-light flex items-center justify-between">
            <span className="text-xs font-medium text-brand-400">Total da semana</span>
            <span className="text-sm font-bold text-text-primary">
              {actualTotals.total}h realizado / {weekTotals.total}h planejado
            </span>
          </div>
        </Card>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 pb-2">
        {Object.entries(CATEGORY_CONFIG).map(([, config]) => (
          <div key={config.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
            <span className="text-xs text-brand-400">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEvent(null); }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        editingEvent={editingEvent}
        defaultDate={clickDate}
        defaultTime={clickTime}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface border border-border-light rounded-2xl shadow-sm p-3 relative overflow-hidden">
      <div className={`absolute -top-3 -right-3 w-14 h-14 bg-gradient-to-br ${color} rounded-full opacity-10`} />
      <p className="text-xl font-bold text-text-primary">{value}</p>
      <p className="text-xs text-brand-400">{label}</p>
    </div>
  );
}
