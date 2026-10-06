import { AI_LIMITS } from '@dozari/shared';

/** A chat provider that speaks the OpenAI `/chat/completions` dialect (ChatGPT, DeepSeek and the Iranian gateways all do). */
export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  /** Name of the environment variable that holds the API key. Keys are never stored in the database or sent to the browser. */
  keyEnv: string;
}

export const PRESETS: readonly ProviderPreset[] = [
  { id: 'openai', label: 'ChatGPT (OpenAI)', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini', keyEnv: 'AI_OPENAI_API_KEY' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat', keyEnv: 'AI_DEEPSEEK_API_KEY' },
  { id: 'gapgpt', label: 'GapGPT (ایرانی)', baseUrl: 'https://api.gapgpt.app/v1', defaultModel: 'gpt-4o-mini', keyEnv: 'AI_GAPGPT_API_KEY' },
  { id: 'avalai', label: 'AvalAI (ایرانی)', baseUrl: 'https://api.avalai.ir/v1', defaultModel: 'gpt-4o-mini', keyEnv: 'AI_AVALAI_API_KEY' },
];

export type Env = Record<string, string | undefined>;

export interface ResolvedProvider extends ProviderPreset {
  apiKey: string;
}

/** The providers this deployment can use: presets with a key, plus one custom gateway (`AI_CUSTOM_BASE_URL`, `AI_CUSTOM_API_KEY`, optional `AI_CUSTOM_NAME` / `AI_CUSTOM_MODEL`). Base URLs may be overridden with `AI_<ID>_BASE_URL`. */
export function resolveProviders(env: Env): ResolvedProvider[] {
  const out: ResolvedProvider[] = [];
  for (const p of PRESETS) {
    const apiKey = env[p.keyEnv]?.trim();
    if (!apiKey) continue;
    out.push({ ...p, baseUrl: (env[`AI_${p.id.toUpperCase()}_BASE_URL`]?.trim() || p.baseUrl).replace(/\/+$/, ''), apiKey });
  }
  const customUrl = env.AI_CUSTOM_BASE_URL?.trim();
  const customKey = env.AI_CUSTOM_API_KEY?.trim();
  if (customUrl && customKey && /^https?:\/\//i.test(customUrl)) {
    out.push({ id: 'custom', label: env.AI_CUSTOM_NAME?.trim() || 'درگاه دلخواه', baseUrl: customUrl.replace(/\/+$/, ''), defaultModel: env.AI_CUSTOM_MODEL?.trim() || 'gpt-4o-mini', keyEnv: 'AI_CUSTOM_API_KEY', apiKey: customKey });
  }
  return out;
}

export type AiErrorCode = 'ai_not_configured' | 'ai_unknown_provider' | 'ai_rate_limited' | 'ai_timeout' | 'ai_unreachable' | 'ai_http_error' | 'ai_bad_output' | 'ai_invalid_model' | 'ai_not_found';

export class AiError extends Error {
  constructor(readonly code: AiErrorCode, readonly status?: number) {
    super(code);
  }
}

export interface ChatRequest {
  system: string;
  user: string;
  model: string;
  maxTokens: number;
  temperature?: number;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** A model name as gateways spell them: letters, digits and `. _ - : /`. Anything else is refused so it cannot smuggle path or header text. */
export const isModelName = (s: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/.test(s);

/** One chat completion. Returns the assistant text. The API key only travels in the `Authorization` header and is never part of an error. */
export async function chat(provider: ResolvedProvider, req: ChatRequest, doFetch: FetchLike = fetch as unknown as FetchLike): Promise<string> {
  if (!isModelName(req.model)) throw new AiError('ai_invalid_model');
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), AI_LIMITS.timeoutSeconds * 1000);
  try {
    const res = await doFetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${provider.apiKey}` },
      body: JSON.stringify({
        model: req.model,
        temperature: req.temperature ?? 0.8,
        max_tokens: req.maxTokens,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
      }),
      signal: ctl.signal,
    });
    if (!res.ok) throw new AiError('ai_http_error', res.status);
    const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.trim() === '') throw new AiError('ai_bad_output');
    return text;
  } catch (err) {
    if (err instanceof AiError) throw err;
    if ((err as { name?: string }).name === 'AbortError') throw new AiError('ai_timeout');
    throw new AiError('ai_unreachable');
  } finally {
    clearTimeout(timer);
  }
}
