import type { AiChatDetailItem, AiChatResponse } from '../types/aiChat';

export const AI_ASSISTANT_CHAT_WEBHOOK_URL =
  'https://n8n-service-ijbl.onrender.com/webhook/chat-web';

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    const s = asString(value)?.trim();
    if (s) return s;
  }
  return '';
}

function normalizeDetails(raw: unknown): AiChatDetailItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChatDetailItem[] = [];
  for (const it of raw) {
    if (it && typeof it === 'object') {
      const o = it as Record<string, unknown>;
      const label = asString(o.label)?.trim() ?? '';
      const value = asString(o.value)?.trim() ?? '';
      if (!label && !value) continue;
      out.push({ label, value });
      continue;
    }
    const textValue = asString(it)?.trim() ?? '';
    if (!textValue) continue;
    out.push({ label: '', value: textValue });
  }
  return out;
}

/** n8n có thể trả `source` là một chuỗi hoặc mảng chuỗi (URL). */
function normalizeSources(raw: unknown): string[] {
  if (typeof raw === 'string') {
    return raw
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const it of raw) {
    if (typeof it === 'string') {
      const chunks = it
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      out.push(...chunks);
      continue;
    }
    const s = asString(it)?.trim();
    if (s) out.push(s);
  }
  return out;
}

function unwrapBody(raw: unknown): Record<string, unknown> {
  let cur: unknown = raw;
  if (Array.isArray(cur) && cur.length > 0) cur = cur[0];
  if (!cur || typeof cur !== 'object') return {};
  const rec = cur as Record<string, unknown>;
  const inner = rec.body;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  return rec;
}

/**
 * POST n8n webhook — không dùng API_BASE / Bearer (dịch vụ bên ngoài).
 */
export async function postAiAssistantChat(payload: {
  chatInput: string;
  sessionId: string;
}): Promise<AiChatResponse> {
  const res = await fetch(AI_ASSISTANT_CHAT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      chatInput: payload.chatInput,
      sessionId: payload.sessionId,
    }),
  });

  const rawText = await res.text();
  let raw: unknown = {};
  if (rawText) {
    try {
      raw = JSON.parse(rawText) as unknown;
    } catch {
      raw = {};
    }
  }

  if (!res.ok) {
    const errBody = unwrapBody(raw);
    const msg =
      asString(errBody.message) ??
      asString(errBody.error) ??
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  const body = unwrapBody(raw);
  const data = body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : null;
  const summary = firstNonEmptyString(
    body.summary,
    body.output,
    body.response,
    body.answer,
    body.message,
    body.text,
    data?.summary,
    data?.output,
    data?.response,
    data?.answer,
    data?.message,
    data?.text
  );
  const details = normalizeDetails(body.details ?? data?.details);
  const sources = normalizeSources(body.source ?? data?.source);

  return {
    summary,
    details,
    source: sources[0] ?? null,
    sources: sources.length > 0 ? sources : undefined,
  };
}
