export type QuotaKey =
  | 'email_blasts_daily'
  | 'email_messages_daily'
  | 'whatsapp_blasts_daily'
  | 'scrape_requests_daily'
  | 'pdf_generations_daily';

export const DEFAULT_QUOTAS: Record<QuotaKey, number> = {
  email_blasts_daily: 20,
  email_messages_daily: 50,
  whatsapp_blasts_daily: 20,
  scrape_requests_daily: 100,
  pdf_generations_daily: 50,
};