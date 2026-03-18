import fs from 'fs';
import path from 'path';
import { Lead, LeadPriority, LeadStatus } from '../../types/leads.types';

const DATA_DIR = path.join(__dirname, '../../../data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, '[]', 'utf-8');
  }
}

/** Preenche campos que podem faltar em leads antigos */
function migrateLead(raw: any): Lead {
  const hasWebsite = raw.hasWebsite ?? !!raw.website;
  const hasPhone = !!raw.phone;
  let priority: LeadPriority = raw.priority;
  if (!priority || !['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
    if (!hasPhone) priority = 'LOW';
    else if (!hasWebsite) priority = 'HIGH';
    else priority = 'MEDIUM';
  }

  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    phone: raw.phone ?? '',
    website: raw.website ?? '',
    email1: raw.email1 ?? raw.email ?? '',
    email2: raw.email2 ?? '',
    city: raw.city ?? '',
    neighborhood: raw.neighborhood ?? '',
    address: raw.address ?? '',
    hasWebsite,
    rating: raw.rating ?? 0,
    niche: raw.niche ?? '',
    priority,
    status: raw.status ?? 'new',
    createdAt: raw.createdAt ?? new Date().toISOString(),
  };
}

function readLeads(): Lead[] {
  ensureFile();
  const raw = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
  return (raw as any[]).map(migrateLead);
}

function writeLeads(leads: Lead[]): void {
  ensureFile();
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
}

/** Deduplica por nome+endereço normalizado */
function dedupeKey(lead: Lead): string {
  return `${lead.name.toLowerCase().trim()}|${lead.address.toLowerCase().trim()}`;
}

export const leadsRepository = {
  getAll(): Lead[] {
    return readLeads();
  },

  getById(id: string): Lead | null {
    return readLeads().find((l) => l.id === id) || null;
  },

  saveMany(newLeads: Lead[]): Lead[] {
    const existing = readLeads();
    const existingKeys = new Set(existing.map(dedupeKey));
    const unique = newLeads.filter((l) => !existingKeys.has(dedupeKey(l)));
    const updated = [...unique, ...existing];
    writeLeads(updated);
    return unique;
  },

  updateStatus(id: string, status: LeadStatus): Lead | null {
    const leads = readLeads();
    const lead = leads.find((l) => l.id === id);
    if (!lead) return null;
    lead.status = status;
    writeLeads(leads);
    return lead;
  },

  delete(id: string): boolean {
    const leads = readLeads();
    const filtered = leads.filter((l) => l.id !== id);
    if (filtered.length === leads.length) return false;
    writeLeads(filtered);
    return true;
  },
};
