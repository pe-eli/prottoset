import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { useProductivityStore } from '../store/productivityStore';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import {
  groupByWeek, getWeekString, formatWeekLabel,
  getRatingColor, getRatingLabel, getDayOfWeekLabel,
  calculateProductivityScore, getTotalHours,
} from '../utils/productivity';

const PIE_COLORS = ['#2563eb', '#8b5cf6', '#f59e0b'];
const chartTooltipStyle = {
  background: '#22262e',
  border: '1px solid #363c4a',
  borderRadius: 12,
  boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
  fontSize: 13,
  color: '#e8eaf0',
};

export function ProductivityDashboard() {
  const { entries, loading, fetchEntries } = useProductivityStore();

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const currentWeek = getWeekString(dayjs().format('YYYY-MM-DD'));
  const weeks = useMemo(() => groupByWeek(entries), [entries]);
  const currentWeekData = weeks.find((w) => w.week === currentWeek);

  const recentEntries = useMemo(
    () => [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 7),
    [entries]
  );

  const chartData = useMemo(() => {
    if (!currentWeekData) return [];
    return currentWeekData.entries.map((e) => ({
      day: getDayOfWeekLabel(e.date).slice(0, 3),
      Prottocode: e.prottocodeHours,
      Alura: e.aluraHours,
      Dimouras: e.dimourasHours,
    }));
  }, [currentWeekData]);

  const pieData = useMemo(() => {
    if (!currentWeekData) return [];
    return [
      { name: 'Prottocode', value: currentWeekData.totalProttocodeHours },
      { name: 'Alura', value: currentWeekData.totalAluraHours },
      { name: 'Dimouras', value: currentWeekData.totalDimourasHours },
    ].filter((d) => d.value > 0);
  }, [currentWeekData]);

  if (loading && entries.length === 0) {
    return (
      <div className="max-w-6xl mx-auto animate-fade-in">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              to="/leads"
              className="w-9 h-9 rounded-xl bg-surface-secondary hover:bg-surface-elevated flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-text-primary">Produtividade</h1>
          </div>
          <p className="text-sm text-brand-400 ml-12">
            {formatWeekLabel(currentWeek)} — Acompanhe seu progresso diário
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/produtividade/agenda"
            className="px-4 py-2 text-sm font-medium rounded-xl bg-surface-secondary text-text-primary hover:bg-surface-elevated transition-colors"
          >
            Agenda
          </Link>
          <Link
            to="/produtividade/semanal"
            className="px-4 py-2 text-sm font-medium rounded-xl bg-surface-secondary text-text-primary hover:bg-surface-elevated transition-colors"
          >
            Visão semanal
          </Link>
          <Link
            to="/produtividade/novo"
            className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/30 transition-all active:scale-[0.98]"
          >
            + Novo registro
          </Link>
        </div>
      </div>

      {/* Stats */}
      {currentWeekData ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Horas totais"
            value={`${currentWeekData.totalHours}h`}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="from-brand-500 to-brand-600"
          />
          <StatCard
            label="Score"
            value={currentWeekData.productivityScore.toFixed(1)}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
            color="from-violet-500 to-purple-600"
          />
          <StatCard
            label="Conclusão média"
            value={`${currentWeekData.averageCompletion}%`}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            color="from-emerald-500 to-green-600"
          />
          <StatCard
            label="Melhor dia"
            value={currentWeekData.bestDay ? getDayOfWeekLabel(currentWeekData.bestDay.date).slice(0, 3) : '—'}
            icon={
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            }
            color="from-amber-500 to-orange-600"
          />
        </div>
      ) : (
        <Card>
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-surface-secondary flex items-center justify-center mx-auto mb-3">
              <svg className="w-7 h-7 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-brand-400">Nenhum registro nesta semana</p>
            <Link
              to="/produtividade/novo"
              className="text-sm text-brand-600 hover:text-brand-700 font-medium mt-1 inline-block"
            >
              Criar primeiro registro
            </Link>
          </div>
        </Card>
      )}

      {/* Charts row */}
      {currentWeekData && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Horas por dia</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="20%">
                  <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                  />
                  <Bar dataKey="Prottocode" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Alura" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Dimouras" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="text-sm font-semibold text-text-primary mb-4">Distribuição</h3>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value) => `${value ?? 0}h`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {[
                { name: 'Prottocode', color: 'bg-blue-500' },
                { name: 'Alura', color: 'bg-violet-500' },
                { name: 'Dimouras', color: 'bg-amber-500' },
              ].map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                  <span className="text-xs text-brand-400">{item.name}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Recent entries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">Registros recentes</h3>
          <Link
            to="/produtividade/semanal"
            className="text-xs text-brand-500 hover:text-brand-600 font-medium"
          >
            Ver todos
          </Link>
        </div>
        {recentEntries.length > 0 ? (
          <div className="space-y-2">
            {recentEntries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <Card>
            <p className="text-sm text-brand-400 text-center py-6">Nenhum registro encontrado</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-surface border border-border-light rounded-2xl shadow-sm p-4 relative overflow-hidden">
      <div className={`absolute -top-3 -right-3 w-16 h-16 bg-gradient-to-br ${color} rounded-full opacity-10`} />
      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white mb-2`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-xs text-brand-400 mt-0.5">{label}</p>
    </div>
  );
}

function EntryRow({ entry }: { entry: import('../features/productivity/productivity.types').DailyEntry }) {
  const total = getTotalHours(entry);
  const score = calculateProductivityScore(entry.prottocodeHours, entry.aluraHours, entry.dimourasHours);

  return (
    <Link
      to={`/produtividade/editar/${entry.id}`}
      className="block bg-surface border border-border-light rounded-2xl p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-text-primary">
            {dayjs(entry.date).format('DD/MM')}
          </span>
          <span className="text-xs text-brand-400">
            {getDayOfWeekLabel(entry.date)}
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getRatingColor(entry.rating)}`}>
            {getRatingLabel(entry.rating)}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-brand-400">
          <span>{total}h total</span>
          <span>Score: {score}</span>
        </div>
      </div>
      <div className="flex items-center gap-6 mb-2">
        <HoursBadge label="Prottocode" hours={entry.prottocodeHours} color="text-blue-600" />
        <HoursBadge label="Alura" hours={entry.aluraHours} color="text-violet-600" />
        <HoursBadge label="Dimouras" hours={entry.dimourasHours} color="text-amber-600" />
      </div>
      <ProgressBar value={entry.completion} size="sm" />
      {entry.focus && (
        <p className="text-xs text-brand-400 mt-2 truncate">{entry.focus}</p>
      )}
    </Link>
  );
}

function HoursBadge({ label, hours, color }: { label: string; hours: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xs font-semibold ${color}`}>{hours}h</span>
      <span className="text-xs text-brand-300">{label}</span>
    </div>
  );
}
