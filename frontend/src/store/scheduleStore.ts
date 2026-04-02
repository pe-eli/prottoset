import { create } from 'zustand';
import type { ScheduleItem, CreateScheduleItemParams } from '../features/schedule/schedule.types';
import { scheduleAPI } from '../features/schedule/schedule.api';

interface ScheduleState {
  items: ScheduleItem[];
  loading: boolean;
  error: string | null;

  fetchItems: () => Promise<void>;
  createItem: (params: CreateScheduleItemParams) => Promise<ScheduleItem>;
  updateItem: (id: string, params: Partial<CreateScheduleItemParams>) => Promise<ScheduleItem>;
  deleteItem: (id: string) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  items: [],
  loading: false,
  error: null,

  fetchItems: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await scheduleAPI.getAll();
      set({ items: Array.isArray(data) ? data : [], loading: false });
    } catch {
      set({ error: 'Erro ao carregar agenda', loading: false });
    }
  },

  createItem: async (params) => {
    const { data } = await scheduleAPI.create(params);
    set({ items: [data, ...get().items] });
    return data;
  },

  updateItem: async (id, params) => {
    const { data } = await scheduleAPI.update(id, params);
    set({ items: get().items.map((i) => (i.id === id ? data : i)) });
    return data;
  },

  deleteItem: async (id) => {
    await scheduleAPI.delete(id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },
}));
