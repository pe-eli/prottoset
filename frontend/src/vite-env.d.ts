/// <reference types="vite/client" />

interface TurnstileRenderOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'expired-callback'?: () => void;
  'error-callback'?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | number;
  reset: (widgetId?: string | number) => void;
}

interface Window {
  turnstile?: TurnstileApi;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}