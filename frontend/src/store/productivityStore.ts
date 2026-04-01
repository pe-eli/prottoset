import { create } from 'zustand';
import type { DailyEntry, CreateDailyEntryParams } from '../features/productivity/productivity.types';
import { productivityAPI } from '../features/productivity/productivity.api';

interface ProductivityState {
  entries: DailyEntry[];
  loading: boolean;
  error: string | null;

  fetchEntries: () => Promise<void>;
  createEntry: (params: CreateDailyEntryParams) => Promise<DailyEntry>;
  updateEntry: (id: string, params: Partial<CreateDailyEntryParams>) => Promise<DailyEntry>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useProductivityStore = create<ProductivityState>((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  fetchEntries: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await productivityAPI.getAll();
      set({ entries: data, loading: false });
    } catch {
      set({ error: 'Erro ao carregar entradas', loading: false });
    }
  },

  createEntry: async (params) => {
    const { data } = await productivityAPI.create(params);
    set({ entries: [data, ...get().entries] });
    return data;
  },

  updateEntry: async (id, params) => {
    const { data } = await productivityAPI.update(id, params);
    set({
      entries: get().entries.map((e) => (e.id === id ? data : e)),
    });
    return data;
  },

  deleteEntry: async (id) => {
    await productivityAPI.delete(id);
    set({ entries: get().entries.filter((e) => e.id !== id) });
  },
}));
