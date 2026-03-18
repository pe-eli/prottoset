# Prottoset — Guia do Projeto para Claude

Leia este arquivo no início de cada sessão antes de fazer qualquer modificação no código.

## Stack

| Camada | Tech |
|--------|------|
| Frontend | React 19 + TypeScript + Vite 7 + Tailwind CSS v4 — porta **5173** |
| Backend | Express 4 + TypeScript — porta **3001** |
| Banco de dados | Flat-file JSON em `backend/data/` |
| Email | **Resend** (API key: `RESEND_API_KEY` no `.env`) |
| Busca | Serper API → Google Maps search |
| Bairros | OpenStreetMap (Nominatim + Overpass) → bairros da cidade |
| IA — WhatsApp | Gemini 2.5 Flash → geração de mensagens WhatsApp |
| WhatsApp | **Evolution API** (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`) |

## Variáveis de Ambiente (backend `.env`)

```
PORT=3001
CLIENT_URL=http://localhost:5173
SERPER_API_KEY=...
GEMINI_API_KEY=...
RESEND_API_KEY=...
RESEND_FROM=Prottocode <onboarding@resend.dev>
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=...
EVOLUTION_INSTANCE=...
```

## Arquivos-chave

### Frontend
- `frontend/src/App.tsx` — roteador principal
- `frontend/src/index.css` — tema Tailwind v4 com tokens `brand-*`, `surface*`, `border*`
- `frontend/src/components/ui/` — Button, Card, Input, Select, TextArea, PriceTag
- `frontend/src/components/layout/` — Header, Footer, StepIndicator
- `frontend/src/pages/` — HomePage, LeadsHub, LeadsDashboard, EmailBlastPage, WhatsAppBlastPage, ContactsPage, NewQuotePage, PackagesQuotePage
- `frontend/src/features/leads/` — LeadCard, LeadSearchForm, LeadDetailModal, LeadPipeline, SearchLoadingOverlay, leads.api.ts, leads.types.ts
- `frontend/src/features/contacts/contacts.api.ts` — API client para contatos e blast
- `frontend/src/features/whatsapp/whatsapp.api.ts` — API client para disparo WhatsApp

### Backend
- `backend/src/index.ts` — entry point Express
- `backend/src/routes/contacts.routes.ts` — POST /blast DEVE ficar ANTES de /:id
- `backend/src/controllers/contacts.controller.ts` — orquestra blast + fila
- `backend/src/modules/blast/blast.queue.ts` — fila de email em memória com SSE
- `backend/src/services/resend.service.ts` — envio real via Resend SDK
- `backend/src/services/evolution.service.ts` — envio WhatsApp via Evolution API
- `backend/src/modules/whatsapp/whatsapp.queue.ts` — fila WhatsApp com geração Gemini + SSE
- `backend/src/controllers/whatsapp.controller.ts` — orquestra blast WhatsApp
- `backend/src/routes/whatsapp.routes.ts` — rotas WhatsApp
- `backend/src/services/openStreetMapService.ts` — OpenStreetMap (Nominatim + Overpass) para bairros
- `backend/src/services/googleMapsService.ts` — Serper Maps API (busca places, mantém sem website)
- `backend/src/services/scraperService.ts` — HTML scraper com timeout
- `backend/src/services/emailExtractor.ts` — extração de emails via regex
- `backend/src/services/leadScoringService.ts` — scoring de prioridade (HIGH/MEDIUM/LOW)
- `backend/src/workflow/leadGenerator.ts` — orquestrador do workflow de geração de leads
- `backend/src/utils/rateLimiter.ts` — concorrência limitada + sleep
- `backend/src/utils/logger.ts` — logger prefixado

## Rotas Frontend

| Rota | Página |
|------|--------|
| `/` | HomePage (orçamentos) |
| `/novo` | NewQuotePage (wizard 7 passos) |
| `/pacotes` | PackagesQuotePage |
| `/leads` | **LeadsHub** (hub intermediário com 4 funcionalidades) |
| `/leads/prospeccao` | LeadsDashboard (busca Google Maps + pipeline Kanban) |
| `/leads/disparos` | EmailBlastPage (fila de disparo com SSE) |
| `/leads/whatsapp` | WhatsAppBlastPage (disparo via Evolution API + Gemini AI) |
| `/leads/contatos` | ContactsPage (CRM simples) |

## Rotas Backend

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/contacts/blast` | Inicia fila de disparo, retorna `blastId` |
| GET | `/api/contacts/blast/:blastId/stream` | SSE — progresso em tempo real da fila |
| GET | `/api/contacts` | Listar contatos |
| POST | `/api/contacts` | Criar contatos (por e-mails) |
| PATCH | `/api/contacts/:id` | Atualizar contato |
| DELETE | `/api/contacts/:id` | Excluir contato |
| POST | `/api/whatsapp/blast` | Inicia fila WhatsApp (Gemini + Evolution), retorna `blastId` |
| GET | `/api/whatsapp/blast/:blastId/stream` | SSE — progresso do blast WhatsApp |
| POST | `/api/leads/search` | Buscar leads (OpenAI bairros → Serper Maps → scraping → emails) |
| GET | `/api/leads` | Listar leads |
| PATCH | `/api/leads/:id/status` | Atualizar status do lead |
| DELETE | `/api/leads/:id` | Excluir lead |
| POST | `/api/quotes/generate-pdf` | Gerar PDF orçamento |
| POST | `/api/packages/generate-pdf` | Gerar PDF proposta por pacotes |

## Design System (Tailwind v4 `@theme`)

- **Cores**: `brand-50` a `brand-950` (azul profundo), `surface`, `surface-secondary`, `background`, `border`, `border-light`
- **Utilitários**: `.glass` (backdrop-blur), `.gradient-text`
- **Animações**: `fade-in`, `slide-up`, `progress`, `shimmer`
- **Font**: Inter (Google Fonts)

## Convenções de UI

- Todos os cards usam `rounded-2xl`, `border border-border-light`, `shadow-sm`
- Inputs/selects usam `rounded-xl`, focus ring `brand-400/40`
- Botão primário: gradiente `from-brand-600 to-brand-500` com sombra colorida
- Textos principais: `text-brand-950`, secundários: `text-brand-400`, placeholder: `text-brand-300`
- Empty states: ícone em div `rounded-2xl bg-brand-50` + texto `text-brand-400`
- Voltar: botão `w-9 h-9 rounded-xl bg-brand-50 hover:bg-brand-100` com chevron

## Arquitetura da Fila de E-mails

- `POST /blast` → gera `blastId` uuid, cria jobs em `blastQueue`, processa em background com delay entre envios, auto-salva destinatários como contatos
- `GET /blast/:blastId/stream` → SSE que emite eventos `{ email, status, index, total }` conforme os jobs são processados
- Frontend usa `EventSource` para consumir o SSE e atualiza status por email em tempo real

## Arquitetura da Fila de WhatsApp

- `POST /whatsapp/blast` → recebe `phones[]`, `promptBase`, `batchSize`, `intervalSeconds`; auto-salva phones como contatos; inicia `waBlastQueue.create(...)` em background
- **Fase 1 — Geração**: para cada telefone, chama `geminiService.generateWhatsAppMessage(promptBase)` (concorrência 5). Emite SSE `generating: { done, total }` conforme vai gerando mensagens únicas
- **Fase 2 — Envio**: processa em lotes via `evolutionService.sendMessage(phone, message)`. Entre lotes, `countdownDelay` emite `tick: { remaining, total }` por segundo
- SSE events: `config`, `catchup`, `generating`, `batch_start`, `progress`, `tick`, `done`

## Arquitetura do Workflow de Leads (Prospecção)

- `POST /api/leads/search` → recebe `{ searchTerm, city }`
- **Fase 1 — Bairros**: OpenStreetMap (Nominatim localiza cidade, Overpass busca `place=suburb` + `place=neighbourhood`), retorna até 8 bairros
- **Fase 2 — Google Maps**: Para cada bairro, busca `searchTerm + bairro + city` no Serper Maps API. Mantém TODOS os places (com e sem website). Deduplica por nome+endereço
- **Fase 3 — Enriquecimento**: Somente para places COM website: scrape HTML (timeout 8s) + extração de até 2 emails via regex
- **Fase 4 — Scoring**: `HIGH` (sem site + com tel), `MEDIUM` (com site + com tel), `LOW` (sem tel)
- **Resultado**: `{ leads: Lead[], metrics: { totalLeads, leadsComWebsite, leadsSemWebsite, leadsAltaPrioridade } }`
- **Lead**: `name, phone?, website?, email1?, email2?, city, neighborhood, hasWebsite, rating?, address?, priority, status, niche`
- **Serviços**: `openStreetMapService` → `googleMapsService` → `scraperService` → `emailExtractor` → `leadScoringService` → `leadGenerator` (orquestrador)
- **Rate limiting**: 1s entre queries Serper, 500ms entre scrapes, concorrência 5 no scraping

## Preferências do usuário

- Interface: moderna, limpa, minimalista — tons de azul, gradientes, bom contraste
- Estrutura de abas com hub intermediário antes de sub-funcionalidades
- Commits explícitos só quando pedido
