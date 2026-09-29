import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';

describe('GET /health', () => {
  it('reports ok and a formatted sample price', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', sample: '۱۵۰ تومن' });
  });
});
