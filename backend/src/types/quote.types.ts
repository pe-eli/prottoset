export interface ClientInfo {
  name: string;
  company: string;
  email: string;
}

export interface ProjectInfo {
  name: string;
  description: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  basePrice: number;
}

export interface ExtraItem {
  id: string;
  name: string;
  description: string;
  price: number;
}

export interface SelectedService {
  service: ServiceItem;
  quantity: number;
}

export interface SelectedExtra {
  extra: ExtraItem;
}

export type PaymentMethod = 'pix' | 'transferencia' | 'parcelamento';

export interface PaymentInfo {
  method: PaymentMethod;
  installments?: number;
}

export interface Quote {
  id: string;
  client: ClientInfo;
  project: ProjectInfo;
  services: SelectedService[];
  extras: SelectedExtra[];
  payment: PaymentInfo;
  subtotalServices: number;
  subtotalExtras: number;
  total: number;
  createdAt: string;
  validUntil: string;
}
