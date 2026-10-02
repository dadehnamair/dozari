import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

/**
 * Baseline response headers for every reply, and a per-response CSP nonce for the admin page (its script and style are inline).
 * The API itself returns JSON only, so its CSP is `default-src 'none'`.
 */
export function registerSecurityHeaders(app: FastifyInstance, opts: { hsts?: boolean } = {}) {
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-frame-options', 'DENY');
    reply.header('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    if (opts.hsts) reply.header('strict-transport-security', 'max-age=15552000; includeSubDomains');
    const type = String(reply.getHeader('content-type') ?? '');
    if (type.startsWith('text/html') && typeof payload === 'string' && req.url.split('?')[0] === '/admin') {
      const nonce = randomBytes(16).toString('base64');
      reply.header(
        'content-security-policy',
        `default-src 'none'; script-src 'nonce-${nonce}'; style-src-elem 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`,
      );
      reply.header('cache-control', 'no-store');
      return payload.replace(/<script>/g, `<script nonce="${nonce}">`).replace(/<style>/g, `<style nonce="${nonce}">`);
    }
    if (type.startsWith('application/json')) reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
    return payload;
  });
}
