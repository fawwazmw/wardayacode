import { describe, it, expect } from 'vitest';
import { formatDuration } from '../src/utils/formatDuration.js';

describe('formatDuration', () => {
  it('formats sub-second durations in milliseconds', () => {
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(1)).toBe('1ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats seconds with one decimal place', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(4200)).toBe('4.2s');
    expect(formatDuration(59900)).toBe('59.9s');
  });

  it('formats minutes and seconds past one minute', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(65000)).toBe('1m 5s');
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('rounds seconds within the minute display', () => {
    expect(formatDuration(61500)).toBe('1m 2s');
  });

  it('clamps negative input to zero', () => {
    expect(formatDuration(-50)).toBe('0ms');
  });
});
