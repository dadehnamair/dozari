import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { CLIENT_ERROR_PER_WINDOW, registerClientErrorAdminRoutes, registerClientErrorRoutes } from '../clienterrors/routes.js';
import { createMemoryClientErrorStore } from '../clienterrors/store.js';

const SHOT = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const body = { kind: 'crash', screen: 'duel', message: 'TypeError: x is undefined', detail: 'stack', context: 'web | build 1', screenshot: SHOT };

async function setup() {
  const store = createMemoryClientErrorStore();
  const app = Fastify();
  registerClientErrorRoutes(app, store);
  registerClientErrorAdminRoutes(app, store, () => undefined);
  await app.ready();
  return { app, store };
}

describe('client error reports', () => {
  it('takes a report with a screenshot, signed out, and lists it for the admin', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'POST', url: '/client-errors', payload: body });
    expect(res.statusCode).toBe(201);
    const list = (await app.inject({ method: 'GET', url: '/admin/client-errors' })).json() as { errors: { id: string; hasScreenshot: boolean; screen: string }[]; open: number };
    expect(list.errors).toHaveLength(1);
    expect(list.errors[0]).toMatchObject({ screen: 'duel', hasScreenshot: true });
    expect(list.open).toBe(1);
    const shot = (await app.inject({ method: 'GET', url: `/admin/client-errors/${list.errors[0]!.id}/screenshot` })).json() as { screenshot: string };
    expect(shot.screenshot).toBe(SHOT);
  });

  it('refuses a screenshot that is not an image data URL and an unknown kind', async () => {
    const { app } = await setup();
    expect((await app.inject({ method: 'POST', url: '/client-errors', payload: { ...body, screenshot: 'javascript:alert(1)' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/client-errors', payload: { ...body, kind: 'nope' } })).statusCode).toBe(400);
  });

  it('rate limits one device so a crash loop cannot fill the table', async () => {
    const { app } = await setup();
    for (let i = 0; i < CLIENT_ERROR_PER_WINDOW; i++) expect((await app.inject({ method: 'POST', url: '/client-errors', payload: body })).statusCode).toBe(201);
    expect((await app.inject({ method: 'POST', url: '/client-errors', payload: body })).statusCode).toBe(429);
  });

  it('marks a report as checked once', async () => {
    const { app } = await setup();
    await app.inject({ method: 'POST', url: '/client-errors', payload: body });
    const id = ((await app.inject({ method: 'GET', url: '/admin/client-errors' })).json() as { errors: { id: string }[] }).errors[0]!.id;
    expect((await app.inject({ method: 'POST', url: `/admin/client-errors/${id}/resolve` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/admin/client-errors/${id}/resolve` })).statusCode).toBe(404);
  });
});
