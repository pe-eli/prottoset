const PREFIX = '[LeadGen]';

export const logger = {
  info(msg: string): void {
    console.log(`${PREFIX} ${msg}`);
  },

  warn(msg: string): void {
    console.warn(`${PREFIX} ⚠ ${msg}`);
  },

  error(msg: string): void {
    console.error(`${PREFIX} ✖ ${msg}`);
  },
};
