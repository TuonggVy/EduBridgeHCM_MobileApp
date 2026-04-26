import type { AiChatDetailItem, AiChatResponse } from '../types/aiChat';

export const AI_ASSISTANT_CHAT_WEBHOOK_URL =
  'https://n8n-service-ijbl.onrender.com/webhook/chat-web';

function asString(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return null;
}

function normalizeDetails(raw: unknown): AiChatDetailItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AiChatDetailItem[] = [];
  for (const it of raw) {
    if (!it || typeof it !== 'object') continue;
    const o = it as Record<string, unknown>;
    const label = asString(o.label) ?? '';
    const value = asString(o.value) ?? '';
    if (!label.trim() && !value.trim()) continue;
    out.push({ label: label.trim(), value: value.trim() });
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
  const summary = asString(body.summary) ?? '';

  return {
    summary,
    details: normalizeDetails(body.details),
    source: asString(body.source),
  };
}
