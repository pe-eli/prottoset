import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useProductivityStore } from '../store/productivityStore';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import type { WeeklySummary } from '../features/productivity/productivity.types';
import {
  groupByWeek, formatWeekLabel, getRatingColor, getRatingLabel,
  getDayOfWeekLabel, calculateProductivityScore, getTotalHours,
} from '../utils/productivity';

export function WeeklyViewPage() {
  const { entries, loading, fetchEntries } = useProductivityStore();
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const weeks = useMemo(() => groupByWeek(entries), [entries]);

  useEffect(() => {
    if (weeks.length > 0 && !selectedWeek) {
      setSelectedWeek(weeks[0].week);
    }
  }, [weeks, selectedWeek]);

  const activeWeek = weeks.find((w) => w.week === selectedWeek) || null;

  const chartData = useMemo(() => {
    if (!activeWeek) return [];
    return activeWeek.entries.map((e) => ({
      day: getDayOfWeekLabel(e.date).slice(0, 3),
      Prottocode: e.prottocodeHours,
      Alura: e.aluraHours,
      Dimouras: e.dimourasHours,
    }));
  }, [activeWeek]);

  if (loading && entries.length === 0) {
    return (
      <div className="max-w-6xl mx-auto animate-fade-in flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/produtividade"
            className="w-9 h-9 rounded-xl bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-brand-950">Visão Semanal</h1>
            <p className="text-sm text-brand-400">Análise detalhada por semana</p>
          </div>
        </div>
      </div>

      {weeks.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <p className="text-sm text-brand-400">Nenhum registro encontrado</p>
            <Link
              to="/produtividade/novo"
              className="text-sm text-brand-600 hover:text-brand-700 font-medium mt-1 inline-block"
            >
              Criar primeiro registro
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Week list */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-brand-500 uppercase tracking-wide mb-2">Semanas</h3>
            {weeks.map((w) => (
              <WeekCard
                key={w.week}
                summary={w}
                isActive={w.week === selectedWeek}
                onClick={() => setSelectedWeek(w.week)}
              />
            ))}
          </div>

          {/* Week detail */}
          <div className="lg:col-span-3 space-y-4">
            {activeWeek && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-brand-950">
                    {formatWeekLabel(activeWeek.week)}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-brand-400">
                    <span>{activeWeek.entries.length} dias</span>
                    <span>{activeWeek.totalHours}h total</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MiniStat label="Prottocode" value={`${activeWeek.totalProttocodeHours}h`} color="text-blue-600 bg-blue-50" />
                  <MiniStat label="Alura" value={`${activeWeek.totalAluraHours}h`} color="text-violet-600 bg-violet-50" />
                  <MiniStat label="Dimouras" value={`${activeWeek.totalDimourasHours}h`} color="text-amber-600 bg-amber-50" />
                  <MiniStat label="Score" value={activeWeek.productivityScore.toFixed(1)} color="text-brand-600 bg-brand-50" />
                </div>

                {/* Chart */}
                {chartData.length > 0 && (
                  <Card>
                    <h3 className="text-sm font-semibold text-brand-950 mb-3">Distribuição diária</h3>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barCategoryGap="20%">
                          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                          <Tooltip
                            contentStyle={{
                              background: '#fff',
                              border: '1px solid #edf1fa',
                              borderRadius: 12,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                              fontSize: 13,
                            }}
                          />
                          <Bar dataKey="Prottocode" fill="#2563eb" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Alura" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Dimouras" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                {/* Entries table */}
                <Card>
                  <h3 className="text-sm font-semibold text-brand-950 mb-3">Detalhamento</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-light">
                          <th className="text-left py-2 text-xs font-medium text-brand-400">Dia</th>
                          <th className="text-center py-2 text-xs font-medium text-blue-500">Prottocode</th>
                          <th className="text-center py-2 text-xs font-medium text-violet-500">Alura</th>
                          <th className="text-center py-2 text-xs font-medium text-amber-500">Dimouras</th>
                          <th className="text-center py-2 text-xs font-medium text-brand-400">Total</th>
                          <th className="text-center py-2 text-xs font-medium text-brand-400">Conclusão</th>
                          <th className="text-center py-2 text-xs font-medium text-brand-400">Avaliação</th>
                          <th className="text-right py-2 text-xs font-medium text-brand-400">Foco</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeWeek.entries.map((entry) => {
                          const total = getTotalHours(entry);
                          return (
                            <tr
                              key={entry.id}
                              className="border-b border-border-light/50 hover:bg-brand-50/30 transition-colors"
                            >
                              <td className="py-2.5">
                                <Link
                                  to={`/produtividade/editar/${entry.id}`}
                                  className="font-medium text-brand-950 hover:text-brand-600"
                                >
                                  {dayjs(entry.date).format('DD/MM')}
                                  <span className="text-brand-300 font-normal ml-1.5">
                                    {getDayOfWeekLabel(entry.date).slice(0, 3)}
                                  </span>
                                </Link>
                              </td>
                              <td className="text-center font-medium text-blue-600">{entry.prottocodeHours}h</td>
                              <td className="text-center font-medium text-violet-600">{entry.aluraHours}h</td>
                              <td className="text-center font-medium text-amber-600">{entry.dimourasHours}h</td>
                              <td className="text-center font-semibold text-brand-950">{total}h</td>
                              <td className="text-center">
                                <div className="max-w-16 mx-auto">
                                  <ProgressBar value={entry.completion} size="sm" />
                                </div>
                              </td>
                              <td className="text-center">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getRatingColor(entry.rating)}`}>
                                  {getRatingLabel(entry.rating)}
                                </span>
                              </td>
                              <td className="text-right text-brand-400 max-w-32 truncate">{entry.focus}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Best day highlight */}
                {activeWeek.bestDay && (
                  <Card className="bg-gradient-to-r from-brand-50 to-violet-50 border-brand-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-brand-950">
                          Melhor dia: {getDayOfWeekLabel(activeWeek.bestDay.date)}, {dayjs(activeWeek.bestDay.date).format('DD/MM')}
                        </p>
                        <p className="text-xs text-brand-400">
                          {getTotalHours(activeWeek.bestDay)}h total — Score: {calculateProductivityScore(
                            activeWeek.bestDay.prottocodeHours,
                            activeWeek.bestDay.aluraHours,
                            activeWeek.bestDay.dimourasHours
                          )}
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function WeekCard({
  summary,
  isActive,
  onClick,
}: {
  summary: WeeklySummary;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-3 transition-all ${
        isActive
          ? 'border-brand-400 bg-brand-50 shadow-sm'
          : 'border-border-light bg-surface hover:bg-brand-50/30'
      }`}
    >
      <p className={`text-sm font-semibold ${isActive ? 'text-brand-700' : 'text-brand-950'}`}>
        {formatWeekLabel(summary.week)}
      </p>
      <div className="flex items-center gap-3 mt-1 text-xs text-brand-400">
        <span>{summary.totalHours}h</span>
        <span>Score: {summary.productivityScore.toFixed(1)}</span>
        <span>{summary.entries.length}d</span>
      </div>
    </button>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface border border-border-light rounded-2xl shadow-sm p-3 text-center">
      <p className={`text-xl font-bold rounded-lg inline-block px-2 py-0.5 ${color}`}>{value}</p>
      <p className="text-xs text-brand-400 mt-1">{label}</p>
    </div>
  );
}
