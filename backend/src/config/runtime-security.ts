function readRequiredEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function assertProductionSecurityConfig(): void {
  if ((process.env.NODE_ENV || 'development') !== 'production') {
    return;
  }

  const required = [
    'AUTH_JWT_SECRET',
    'MERCADOPAGO_WEBHOOK_SECRET',
    'EVOLUTION_WEBHOOK_SECRET',
    'INTEGRATION_VAULT_KEY',
  ];

  const missing = required.filter((name) => !readRequiredEnv(name));
  if (missing.length > 0) {
    throw new Error(
      `Configuracao insegura para producao. Variaveis obrigatorias ausentes: ${missing.join(', ')}`,
    );
  }
}
