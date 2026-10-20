import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError } from '../api.js';
import { describeError, errorKind } from '../errors.js';

describe('describeError', () => {
  it('tells the cases apart and always shows where it tried to connect for network errors', () => {
    expect(describeError(new ApiError(503, 'no_puzzles'), 'http://x').message).toBe('هنوز پازلی آماده نیست');
    expect(describeError(new ApiError(500, 'boom'), 'http://x')).toEqual({ message: 'سرور خطا داد', detail: '500 boom' });
    const bad = z.object({ a: z.string() }).safeParse({});
    expect(describeError(bad.success ? null : bad.error, 'http://x').message).toBe('پاسخ سرور قابل‌فهم نبود');
    expect(describeError(new TypeError('Failed to fetch'), 'http://localhost:3000')).toEqual({
      message: 'اتصال به سرور برقرار نشد',
      detail: 'آدرس سرور: http://localhost:3000',
    });
  });

  it('treats a bare gateway 502/503/504 as a server that is down, not a bug to report', () => {
    expect(describeError(new ApiError(502, 'error'), 'http://x')).toEqual({ message: 'سرور موقتاً در دسترس نیست؛ چند لحظه‌ی دیگر دوباره امتحان کن', detail: '502' });
    expect(errorKind(new ApiError(502, 'error'))).toBe('noInternet');
    expect(errorKind(new ApiError(503, 'no_puzzles'))).toBe('noPuzzles');
    expect(errorKind(new ApiError(500, 'boom'))).toBe('error');
  });
});
