import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { useProductivityStore } from '../store/productivityStore';
import { Card } from '../components/ui/Card';
import type { DailyRating, CreateDailyEntryParams } from '../features/productivity/productivity.types';

const RATINGS: { value: DailyRating; label: string; emoji: string }[] = [
  { value: 'excellent', label: 'Excelente', emoji: '🔥' },
  { value: 'good', label: 'Bom', emoji: '✅' },
  { value: 'average', label: 'Médio', emoji: '😐' },
  { value: 'bad', label: 'Ruim', emoji: '❌' },
];

export function DailyEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { entries, fetchEntries, createEntry, updateEntry, deleteEntry } = useProductivityStore();
  const isEditing = !!id;

  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [prottocodeHours, setProttocodeHours] = useState(0);
  const [aluraHours, setAluraHours] = useState(0);
  const [dimourasHours, setDimourasHours] = useState(0);
  const [focus, setFocus] = useState('');
  const [completion, setCompletion] = useState(80);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState<DailyRating>('good');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entries.length === 0) fetchEntries();
  }, [entries.length, fetchEntries]);

  useEffect(() => {
    if (isEditing) {
      const entry = entries.find((e) => e.id === id);
      if (entry) {
        setDate(entry.date);
        setProttocodeHours(entry.prottocodeHours);
        setAluraHours(entry.aluraHours);
        setDimourasHours(entry.dimourasHours);
        setFocus(entry.focus);
        setCompletion(entry.completion);
        setNotes(entry.notes);
        setRating(entry.rating);
      }
    }
  }, [isEditing, id, entries]);

  const totalHours = prottocodeHours + aluraHours + dimourasHours;
  const score = Math.round((prottocodeHours * 0.6 + aluraHours * 0.2 + dimourasHours * 0.2) * 10) / 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const params: CreateDailyEntryParams = {
        date,
        prottocodeHours,
        aluraHours,
        dimourasHours,
        focus,
        completion,
        notes,
        rating,
      };
      if (isEditing) {
        await updateEntry(id!, params);
      } else {
        await createEntry(params);
      }
      navigate('/produtividade');
    } catch (err) {
      alert('Erro ao salvar registro');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('Excluir este registro?')) return;
    try {
      await deleteEntry(id);
      navigate('/produtividade');
    } catch {
      alert('Erro ao excluir');
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/produtividade"
          className="w-9 h-9 rounded-xl bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-brand-950">
            {isEditing ? 'Editar registro' : 'Novo registro'}
          </h1>
          <p className="text-sm text-brand-400">Registre seu progresso do dia</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date + live stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="sm:col-span-1">
            <label className="block text-xs font-medium text-brand-500 mb-1.5">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 focus:outline-none focus:ring-2 focus:ring-brand-400/40"
              required
            />
          </Card>
          <Card className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-brand-950">{totalHours}h</p>
              <p className="text-xs text-brand-400">Total</p>
            </div>
          </Card>
          <Card className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-brand-600">{score}</p>
              <p className="text-xs text-brand-400">Score</p>
            </div>
          </Card>
        </div>

        {/* Hours */}
        <Card>
          <h3 className="text-sm font-semibold text-brand-950 mb-4">Horas por área</h3>
          <div className="grid grid-cols-3 gap-4">
            <HoursInput
              label="Prottocode"
              value={prottocodeHours}
              onChange={setProttocodeHours}
              color="border-blue-400 focus:ring-blue-400/40"
              accent="text-blue-600"
            />
            <HoursInput
              label="Alura"
              value={aluraHours}
              onChange={setAluraHours}
              color="border-violet-400 focus:ring-violet-400/40"
              accent="text-violet-600"
            />
            <HoursInput
              label="Dimouras"
              value={dimourasHours}
              onChange={setDimourasHours}
              color="border-amber-400 focus:ring-amber-400/40"
              accent="text-amber-600"
            />
          </div>
        </Card>

        {/* Focus + Completion */}
        <Card>
          <label className="block text-xs font-medium text-brand-500 mb-1.5">Foco do dia</label>
          <input
            type="text"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="Ex: Finalizar módulo de autenticação"
            className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 mb-4"
          />

          <label className="block text-xs font-medium text-brand-500 mb-1.5">
            Conclusão: {completion}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={completion}
            onChange={(e) => setCompletion(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
          <div className="flex justify-between text-xs text-brand-300 mt-1">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </Card>

        {/* Rating */}
        <Card>
          <label className="block text-xs font-medium text-brand-500 mb-3">Avaliação do dia</label>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRating(r.value)}
                className={`py-3 rounded-xl border text-center transition-all text-sm font-medium ${
                  rating === r.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm'
                    : 'border-border-light bg-surface hover:bg-brand-50/50 text-brand-400'
                }`}
              >
                <span className="text-lg block mb-0.5">{r.emoji}</span>
                {r.label}
              </button>
            ))}
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <label className="block text-xs font-medium text-brand-500 mb-1.5">Notas / Aprendizados</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="O que você aprendeu hoje?"
            className="w-full px-3 py-2 bg-surface-secondary border border-border rounded-xl text-sm text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400/40 resize-none"
          />
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              Excluir
            </button>
          )}
          <div className={`flex gap-2 ${isEditing ? '' : 'ml-auto'}`}>
            <Link
              to="/produtividade"
              className="px-5 py-2.5 text-sm font-medium rounded-xl bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-sm font-medium rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/25 hover:shadow-lg hover:shadow-brand-500/30 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {saving ? 'Salvando...' : isEditing ? 'Atualizar' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function HoursInput({
  label,
  value,
  onChange,
  color,
  accent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  accent: string;
}) {
  return (
    <div>
      <label className={`block text-xs font-semibold ${accent} mb-1.5`}>{label}</label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 0.5))}
          className="w-8 h-8 rounded-lg bg-brand-50 hover:bg-brand-100 flex items-center justify-center text-brand-500 transition-colors text-lg font-medium"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          step={0.5}
          min={0}
          max={24}
          className={`flex-1 px-2 py-1.5 text-center bg-surface-secondary border ${color} rounded-xl text-sm font-semibold text-brand-950 focus:outline-none focus:ring-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(24, value + 0.5))}
          className="w-8 h-8 rounded-lg bg-brand-50 hover:bg-brand-100 flex items-center justify-center text-brand-500 transition-colors text-lg font-medium"
        >
          +
        </button>
      </div>
    </div>
  );
}
