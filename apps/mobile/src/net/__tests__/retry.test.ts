import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../net/http.js';
import { withGatewayRetry } from '../../net/retry.js';

const noWait = () => Promise.resolve();

describe('withGatewayRetry', () => {
  it('retries a bare gateway error and returns the later success', async () => {
    const run = vi.fn().mockRejectedValueOnce(new ApiError(502, 'error')).mockRejectedValueOnce(new ApiError(504, 'error')).mockResolvedValue('ok');
    const sleep = vi.fn(noWait);
    await expect(withGatewayRetry(run, [10, 20], sleep)).resolves.toBe('ok');
    expect(sleep.mock.calls).toEqual([[10], [20]]);
  });

  it('gives up after the last delay with the gateway error', async () => {
    const run = vi.fn().mockRejectedValue(new ApiError(502, 'error'));
    await expect(withGatewayRetry(run, [1, 1], noWait)).rejects.toMatchObject({ status: 502 });
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('does not retry app errors or network failures', async () => {
    for (const err of [new ApiError(503, 'no_puzzles'), new ApiError(500, 'error'), new TypeError('Failed to fetch')]) {
      const run = vi.fn().mockRejectedValue(err);
      await expect(withGatewayRetry(run, [1, 1], noWait)).rejects.toBe(err);
      expect(run).toHaveBeenCalledTimes(1);
    }
  });
});
