import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatRelativeTime } from './formatRelativeTime';

const NOW = new Date('2026-04-22T12:00:00Z').getTime();

const minutesAgo = (n: number) => new Date(NOW - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(NOW - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatRelativeTime', () => {
  it('returns 1m for timestamps under one minute old', () => {
    expect(formatRelativeTime(minutesAgo(0))).toBe('1m');
    expect(formatRelativeTime(new Date(NOW - 30_000).toISOString())).toBe('1m');
  });

  it('returns minutes below the hour boundary', () => {
    expect(formatRelativeTime(minutesAgo(1))).toBe('1m');
    expect(formatRelativeTime(minutesAgo(59))).toBe('59m');
  });

  it('returns hours at and above 60 minutes', () => {
    expect(formatRelativeTime(minutesAgo(60))).toBe('1h');
    expect(formatRelativeTime(hoursAgo(23))).toBe('23h');
  });

  it('returns days at and above 24 hours', () => {
    expect(formatRelativeTime(hoursAgo(24))).toBe('1d');
    expect(formatRelativeTime(daysAgo(6))).toBe('6d');
  });

  it('returns weeks between 7 and 34 days', () => {
    expect(formatRelativeTime(daysAgo(7))).toBe('1w');
    expect(formatRelativeTime(daysAgo(34))).toBe('4w');
  });

  it('returns months from 35 days up to one year', () => {
    expect(formatRelativeTime(daysAgo(35))).toBe('1mo');
    expect(formatRelativeTime(daysAgo(364))).toBe('12mo');
  });

  it('returns years at and above 365 days', () => {
    expect(formatRelativeTime(daysAgo(365))).toBe('1y');
    expect(formatRelativeTime(daysAgo(730))).toBe('2y');
  });

  it('does not produce 0y in the days 360-364 window', () => {
    for (let days = 360; days < 365; days++) {
      expect(formatRelativeTime(daysAgo(days))).toBe('12mo');
    }
  });
});
