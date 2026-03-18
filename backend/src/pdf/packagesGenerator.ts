import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { PackagesQuote, PackagePlan } from '../types/packages.types';
import { BRAND } from './templates';

const TEMPLATE_PATH = path.join(__dirname, 'packages-template.html');
const LOGO_PATH = path.join(__dirname, '../../..', 'frontend/public/logo.png');

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function buildPlanCard(plan: PackagePlan, isHighlighted: boolean, installments: number): string {
  const hl = isHighlighted;

  const featuresHtml = plan.features
    .map((f) => `<li><span class="check">✓</span>${escapeHtml(f)}</li>`)
    .join('\n');

  const badge = hl ? 'Mais Popular' : plan.name;

  // PIX tag always shown (main price is always the à vista/PIX price)
  const pixTag = `<span class="plan-pix-tag${hl ? ' hl' : ''}">PIX · À vista</span>`;

  // Installment line — only if priceInstallments is set and installments > 1
  const installmentHtml =
    plan.priceInstallments && installments > 1
      ? `<div class="plan-installment${hl ? ' hl' : ''}">ou ${installments}× de ${formatBRL(plan.priceInstallments / installments)}</div>`
      : '';

  // Savings badge — only when priceInstallments > priceAVista
  const savings =
    plan.priceInstallments && plan.priceInstallments > plan.priceAVista
      ? plan.priceInstallments - plan.priceAVista
      : 0;
  const savingsHtml = savings > 0
    ? `<div class="plan-savings-badge${hl ? ' hl' : ''}">✦ Economize ${formatBRL(savings)} pagando à vista</div>`
    : '';

  const monthlyHtml =
    plan.monthlyFee
      ? `
  <div class="plan-monthly">
    <div class="plan-monthly-label">Mensalidade</div>
    <div class="plan-monthly-fee">${formatBRL(plan.monthlyFee)}<span class="plan-monthly-per">/mês</span></div>
    ${plan.monthlyFeeDescription ? `<div class="plan-monthly-desc">${escapeHtml(plan.monthlyFeeDescription)}</div>` : ''}
  </div>`
      : '';

  return `
<div class="plan-card${hl ? ' highlighted' : ''}">
  <div class="plan-header${hl ? ' hl' : ''}">
    <span class="plan-badge${hl ? ' hl' : ''}">${escapeHtml(badge)}</span>
    <span class="plan-name${hl ? ' hl' : ''}">${escapeHtml(plan.name)}</span>
    <div class="plan-price-row">
      <span class="plan-price${hl ? ' hl' : ''}">${formatBRL(plan.priceAVista)}</span>
      <span class="plan-price-note${hl ? ' hl' : ''}">/projeto</span>
    </div>
    ${pixTag}
    ${installmentHtml}
    ${savingsHtml}
  </div>
  <div class="plan-body">
    <ul class="features-list">
      ${featuresHtml}
    </ul>
  </div>${monthlyHtml}
</div>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getLogoDataUrl(): string {
  try {
    const data = fs.readFileSync(LOGO_PATH);
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch {
    return '';
  }
}

export function buildPackagesHtml(quote: PackagesQuote): string {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  const plansHtml = quote.plans
    .map((plan) => buildPlanCard(plan, plan.highlighted === true, quote.installments))
    .join('\n');

  const logoDataUrl = getLogoDataUrl();

  const referenceSection = quote.referenceUrl
    ? `<div class="project-reference">
    <span class="project-reference-label">Tenha uma ideia de como pode ficar seu projeto</span>
    <a href="${escapeHtml(quote.referenceUrl)}" class="project-reference-link">${escapeHtml(quote.referenceUrl)}</a>
  </div>`
    : '';

  // Use regex with global flag to replace ALL occurrences of each token
  return template
    .replace(/\{\{LOGO_DATA_URL\}\}/g, logoDataUrl)
    .replace(/\{\{CLIENT_NAME\}\}/g, escapeHtml(quote.clientName))
    .replace(/\{\{PROJECT_NAME\}\}/g, escapeHtml(quote.projectName))
    .replace(/\{\{PROJECT_DESCRIPTION\}\}/g, escapeHtml(quote.projectDescription))
    .replace(/\{\{REFERENCE_SECTION\}\}/g, referenceSection)
    .replace(/\{\{DATE\}\}/g, formatDate(quote.createdAt))
    .replace(/\{\{PLANS_HTML\}\}/g, plansHtml)
    .replace(/\{\{DELIVERY_DAYS\}\}/g, escapeHtml(quote.deliveryDays))
    .replace(/\{\{PAYMENT_TERMS\}\}/g, escapeHtml(quote.paymentTerms))
    .replace(/\{\{PAYMENT_METHOD\}\}/g, escapeHtml(quote.paymentMethod))
    .replace(/\{\{VALIDITY_DAYS\}\}/g, String(quote.validityDays))
    .replace(/\{\{COMPANY_NAME\}\}/g, escapeHtml(BRAND.name))
    .replace(/\{\{COMPANY_TAGLINE\}\}/g, escapeHtml(BRAND.tagline))
    .replace(/\{\{COMPANY_EMAIL\}\}/g, escapeHtml(BRAND.email))
    .replace(/\{\{COMPANY_PHONE\}\}/g, escapeHtml(BRAND.phone));
}

export async function generatePackagesPdf(quote: PackagesQuote): Promise<Buffer> {
  const html = buildPackagesHtml(quote);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
