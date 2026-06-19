import { APICallError, RetryError } from 'ai';

const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export function isRetryableError(error: unknown): boolean {
  if (RetryError.isInstance(error)) return true;
  if (APICallError.isInstance(error)) return error.isRetryable;
  if (error instanceof TypeError) return true; // fetch failures
  return false;
}

export function getRetryDelay(error: unknown, attempt: number): number {
  const underlying = RetryError.isInstance(error) ? error.lastError : error;

  if (APICallError.isInstance(underlying)) {
    const retryAfter = underlying.responseHeaders?.['retry-after'];
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) return Math.min(seconds * 1000, MAX_DELAY_MS);
    }
  }

  const exponential = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = exponential * 0.25 * (Math.random() * 2 - 1);
  return Math.min(Math.round(exponential + jitter), MAX_DELAY_MS);
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
