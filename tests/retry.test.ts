import { describe, it, expect } from 'vitest';
import { APICallError, RetryError } from 'ai';
import { isRetryableError, getRetryDelay, sleep } from '../src/utils/retry.js';

describe('retry utilities', () => {
  describe('isRetryableError', () => {
    it('returns true for APICallError with isRetryable=true', () => {
      const error = new APICallError({
        message: 'Internal server error',
        url: 'https://api.anthropic.com/v1/messages',
        requestBodyValues: {},
        statusCode: 500,
        isRetryable: true,
      });

      expect(isRetryableError(error)).toBe(true);
    });

    it('returns false for APICallError with isRetryable=false', () => {
      const error = new APICallError({
        message: 'Bad request',
        url: 'https://api.anthropic.com/v1/messages',
        requestBodyValues: {},
        statusCode: 400,
        isRetryable: false,
      });

      expect(isRetryableError(error)).toBe(false);
    });

    it('returns true for RetryError', () => {
      const innerError = new APICallError({
        message: 'rate limited',
        url: 'https://api.anthropic.com/v1/messages',
        requestBodyValues: {},
        statusCode: 429,
        isRetryable: true,
      });
      const retryError = new RetryError({
        message: 'maxRetries exceeded',
        reason: 'maxRetriesExceeded',
        errors: [innerError],
      });

      expect(isRetryableError(retryError)).toBe(true);
    });

    it('returns true for TypeError (fetch failures)', () => {
      const error = new TypeError('fetch failed');

      expect(isRetryableError(error)).toBe(true);
    });

    it('returns false for generic Error', () => {
      const error = new Error('something went wrong');

      expect(isRetryableError(error)).toBe(false);
    });

    it('returns false for non-Error values', () => {
      expect(isRetryableError('string error')).toBe(false);
      expect(isRetryableError(42)).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('respects retry-after header when present (seconds)', () => {
      const error = new APICallError({
        message: 'rate limited',
        url: 'https://api.anthropic.com/v1/messages',
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { 'retry-after': '5' },
        isRetryable: true,
      });

      const delay = getRetryDelay(error, 0);
      expect(delay).toBe(5000);
    });

    it('caps retry-after at 30 seconds', () => {
      const error = new APICallError({
        message: 'rate limited',
        url: 'https://api.anthropic.com/v1/messages',
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { 'retry-after': '120' },
        isRetryable: true,
      });

      const delay = getRetryDelay(error, 0);
      expect(delay).toBe(30000);
    });

    it('uses exponential backoff when no retry-after header', () => {
      const error = new APICallError({
        message: 'server error',
        url: 'https://api.anthropic.com/v1/messages',
        requestBodyValues: {},
        statusCode: 500,
        isRetryable: true,
      });

      const delay0 = getRetryDelay(error, 0);
      const delay1 = getRetryDelay(error, 1);
      const delay2 = getRetryDelay(error, 2);

      // attempt 0: base ~1000 (±250 jitter)
      expect(delay0).toBeGreaterThanOrEqual(750);
      expect(delay0).toBeLessThanOrEqual(1250);

      // attempt 1: base ~2000 (±500 jitter)
      expect(delay1).toBeGreaterThanOrEqual(1500);
      expect(delay1).toBeLessThanOrEqual(2500);

      // attempt 2: base ~4000 (±1000 jitter)
      expect(delay2).toBeGreaterThanOrEqual(3000);
      expect(delay2).toBeLessThanOrEqual(5000);
    });

    it('caps exponential backoff at 30 seconds', () => {
      const error = new TypeError('fetch failed');

      const delay = getRetryDelay(error, 10);
      expect(delay).toBeLessThanOrEqual(30000);
    });

    it('extracts underlying error from RetryError for retry-after', () => {
      const innerError = new APICallError({
        message: 'rate limited',
        url: 'https://api.anthropic.com/v1/messages',
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { 'retry-after': '3' },
        isRetryable: true,
      });
      const retryError = new RetryError({
        message: 'maxRetries exceeded',
        reason: 'maxRetriesExceeded',
        errors: [innerError],
      });

      const delay = getRetryDelay(retryError, 0);
      expect(delay).toBe(3000);
    });
  });

  describe('sleep', () => {
    it('resolves after the given milliseconds', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });
});
