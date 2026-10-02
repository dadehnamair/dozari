import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError } from '../api.js';
import { describeError } from '../errors.js';

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
});
