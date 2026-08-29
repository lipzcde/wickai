import { Response } from 'express';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_API_KEY = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY || '';
const DEFAULT_MODEL = 'wick-master-200b-v2';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function getLLMConfig() {
  const rawBaseUrl = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_BASE_URL;
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || DEFAULT_API_KEY;
  const defaultModel = process.env.LLM_DEFAULT_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;

  return {
    baseUrl,
    apiKey,
    defaultModel,
  };
}

function resolveUpstreamModel(modelName: string): string {
  const clean = (modelName || '').toLowerCase();
  if (clean.includes('fast') || clean.includes('3-ultra')) return 'gpt-4o-mini';
  if (clean.includes('reasoning') || clean.includes('180gb')) return 'o3-mini';
  if (clean.includes('master') || clean.includes('200b')) return 'gpt-4o';
  if (['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'gpt-3.5-turbo', 'llama-3.3-70b-instruct'].includes(clean)) {
    return clean;
  }
  return 'gpt-4o';
}

const SYSTEM_PROMPT: OpenAIMessage = {
  role: 'system',
  content:
    'You are WickAI, an intelligent AI assistant created by a mysterious young developer whose true identity remains unknown. Answer promptly, accurately, and thoughtfully. Use clear markdown formatting for code, lists, and headers when appropriate.',
};

export function buildOptimizedMessages(rawMessages: Array<{ role: string; content: string }>): OpenAIMessage[] {
  const sanitized = rawMessages
    .filter((m) => m && m.content && typeof m.content === 'string')
    .map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user') as 'user' | 'assistant' | 'system',
      content: m.content.trim(),
    }));

  const nonSystem = sanitized.filter((m) => m.role !== 'system');
  const windowed = nonSystem.length > 12 ? nonSystem.slice(-12) : nonSystem;

  return [SYSTEM_PROMPT, ...windowed];
}

export async function streamChatCompletion(
  modelName: string,
  messages: Array<{ role: string; content: string }>,
  res: Response,
  onComplete?: (fullText: string) => void
): Promise<void> {
  const { baseUrl, apiKey, defaultModel } = getLLMConfig();
  const selectedModel = (modelName && modelName.trim()) || defaultModel;
  const targetModel = resolveUpstreamModel(selectedModel);
  const optimizedMessages = buildOptimizedMessages(messages);

  if (!apiKey) {
    res.write(
      `data: ${JSON.stringify({
        error:
          'API Key is not configured. Please set OPENAI_API_KEY or LLM_API_KEY in your environment variables (.env / Vercel settings).',
      })}\n\n`
    );
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  const endpoint = `${baseUrl}/chat/completions`;

  const requestBody = {
    model: targetModel,
    messages: optimizedMessages,
    stream: true,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  let fullText = '';

  try {
    const upstreamRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!upstreamRes.ok) {
      const errorBody = await upstreamRes.text();
      let errorMsg = `Upstream LLM API error (${upstreamRes.status})`;
      try {
        const parsed = JSON.parse(errorBody);
        errorMsg = parsed.error?.message || parsed.error || errorMsg;
      } catch {
        if (errorBody) errorMsg = errorBody;
      }

      res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    if (!upstreamRes.body) {
      res.write(`data: ${JSON.stringify({ error: 'No response body from upstream LLM provider.' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed === 'data: [DONE]') {
          res.write('data: [DONE]\n\n');
          continue;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const jsonStr = trimmed.substring(6);
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullText += delta;
              res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
          } catch (parseErr) {
            // ignore partial line chunks
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

    if (onComplete) {
      onComplete(fullText);
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('Streaming completion error:', err);
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: err?.message || 'Streaming failed' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }
}
