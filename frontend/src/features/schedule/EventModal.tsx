import { useState, useEffect } from 'react';
import type {
  CalendarEvent,
  CreateScheduleItemParams,
  ScheduleCategory,
  ScheduleRecurrence,
} from './schedule.types';
import { CATEGORY_CONFIG } from '../../utils/schedule';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (params: CreateScheduleItemParams) => Promise<void>;
  onUpdate: (id: string, params: Partial<CreateScheduleItemParams>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  editingEvent: CalendarEvent | null;
  defaultDate?: string;
  defaultTime?: string;
}

const CATEGORIES: { value: ScheduleCategory; label: string }[] = [
  { value: 'prottocode', label: 'Prottocode' },
  { value: 'alura', label: 'Alura' },
  { value: 'dimouras', label: 'Dimouras' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
  { value: 6, label: 'Sábado' },
];

export function EventModal({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  editingEvent,
  defaultDate,
  defaultTime,
}: EventModalProps) {
  const isEditing = !!editingEvent;

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ScheduleCategory>('prottocode');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [eventType, setEventType] = useState<'onetime' | 'recurring'>('onetime');
  const [date, setDate] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingEvent) {
      setTitle(editingEvent.title);
      setCategory(editingEvent.category);
      setStartTime(editingEvent.startTime);
      setEndTime(editingEvent.endTime);
      setEventType(editingEvent.isRecurring ? 'recurring' : 'onetime');
      setDate(editingEvent.date);
      if (editingEvent.isRecurring) {
        const d = new Date(editingEvent.date + 'T12:00:00');
        setDayOfWeek(d.getDay());
      }
    } else {
      setTitle('');
      setCategory('prottocode');
      setStartTime(defaultTime || '09:00');
      setEndTime(
        defaultTime
          ? `${String(Math.min(23, parseInt(defaultTime.split(':')[0]) + 1)).padStart(2, '0')}:00`
          : '10:00'
      );
      setEventType('onetime');
      setDate(defaultDate || '');
      setDayOfWeek(defaultDate ? new Date(defaultDate + 'T12:00:00').getDay() : 1);
    }
  }, [editingEvent, defaultDate, defaultTime, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const params: CreateScheduleItemParams = {
        title,
        category,
        startTime,
        endTime,
      };
      if (eventType === 'recurring') {
        params.recurrence = { type: 'weekly', dayOfWeek } as ScheduleRecurrence;
      } else {
        params.date = date;
      }

      if (isEditing) {
        await onUpdate(editingEvent.sourceId, params);
      } else {
        await onCreate(params);
      }
      onClose();
    } catch {
      alert('Erro ao salvar evento');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent || !confirm('Excluir este evento?')) return;
    try {
      await onDelete(editingEvent.sourceId);
      onClose();
    } catch {
      alert('Erro ao excluir');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brand-950/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface rounded-2xl border border-border-light shadow-xl w-full max-w-md mx-4 animate-slide-up">
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-brand-950">
              {isEditing ? 'Editar evento' : 'Novo evento'}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-brand-50 flex items-center justify-center text-brand-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-brand-500 mb-1.5">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Desenvolver módulo auth"
                className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-brand-500 mb-1.5">Categoria</label>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((c) => {
                  const conf = CATEGORY_CONFIG[c.value];
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                        category === c.value
                          ? `${conf.bg} ${conf.border} ${conf.text} shadow-sm`
                          : 'border-border-light bg-surface text-brand-400 hover:bg-brand-50/50'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-brand-500 mb-1.5">Início</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-500 mb-1.5">Fim</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                  required
                />
              </div>
            </div>

            {/* Event type toggle */}
            <div>
              <label className="block text-xs font-medium text-brand-500 mb-1.5">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEventType('onetime')}
                  className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                    eventType === 'onetime'
                      ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm'
                      : 'border-border-light text-brand-400 hover:bg-brand-50/50'
                  }`}
                >
                  Evento único
                </button>
                <button
                  type="button"
                  onClick={() => setEventType('recurring')}
                  className={`py-2 rounded-xl border text-xs font-semibold transition-all ${
                    eventType === 'recurring'
                      ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-sm'
                      : 'border-border-light text-brand-400 hover:bg-brand-50/50'
                  }`}
                >
                  Recorrente (semanal)
                </button>
              </div>
            </div>

            {/* Date or DayOfWeek */}
            {eventType === 'onetime' ? (
              <div>
                <label className="block text-xs font-medium text-brand-500 mb-1.5">Data</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-brand-500 mb-1.5">Dia da semana</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  Excluir
                </button>
              )}
              <div className={`flex gap-2 ${isEditing ? '' : 'ml-auto'}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25 hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
