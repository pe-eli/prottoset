/**
 * Centralized AI credit calculation.
 *
 * Credits are based on actual token usage returned by the AI API.
 * Fallback to character-based estimation when token data is unavailable.
 *
 * Formula (token-based):  Math.ceil(totalTokens / TOKENS_PER_CREDIT)
 * Formula (char-based):   Math.ceil((promptChars + responseChars) / CHARS_PER_CREDIT)
 */

/** How many tokens = 1 credit */
const TOKENS_PER_CREDIT = 10;

/** Character-based fallback: chars per 1 credit */
const CHARS_PER_CREDIT = 100;

/** Hard cap on prompt length (characters) to prevent abuse */
export const MAX_PROMPT_CHARS = 1000;

/** Average tokens per typical WhatsApp greeting generation (used for estimates) */
const AVG_TOKENS_PER_GENERATION = 250;

/**
 * Calculate credits consumed from real token usage (preferred).
 * Never returns less than 1 credit for a successful call.
 */
export function calculateCreditsFromTokens(totalTokens: number): number {
  if (totalTokens <= 0) return 1;
  return Math.ceil(totalTokens / TOKENS_PER_CREDIT);
}

/**
 * Character-based fallback when token info is unavailable.
 */
export function calculateCreditsFromChars(promptLength: number, responseLength: number): number {
  const total = promptLength + responseLength;
  if (total <= 0) return 1;
  return Math.ceil(total / CHARS_PER_CREDIT);
}

/**
 * Estimate credit cost before making an AI call.
 * Used for pre-flight checks to block obviously impossible requests.
 */
export function estimateCreditCost(promptLength: number): number {
  // Estimate based on average generation size
  return Math.ceil(AVG_TOKENS_PER_GENERATION / TOKENS_PER_CREDIT);
}

/**
 * Estimate how many AI messages a user can still generate
 * given their remaining credits.
 */
export function estimateRemainingMessages(creditsRemaining: number): number {
  const avgCreditsPerMessage = Math.ceil(AVG_TOKENS_PER_GENERATION / TOKENS_PER_CREDIT);
  return Math.floor(creditsRemaining / avgCreditsPerMessage);
}
