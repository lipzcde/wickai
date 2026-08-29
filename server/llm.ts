import { Response } from 'express';

const DEFAULT_BASE_URL = 'https://labor-buyer-cal-private.trycloudflare.com/v1';
const DEFAULT_API_KEY = 'sk-070098ecda5aea48-k93903-455d3c11';
const DEFAULT_MODEL = 'kirocor';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function getLLMConfig() {
  const rawBaseUrl = process.env.LLM_BASE_URL || DEFAULT_BASE_URL;
  // Ensure no trailing slash
  const baseUrl = rawBaseUrl.replace(/\/+$/, '');
  const apiKey = process.env.LLM_API_KEY || DEFAULT_API_KEY;
  const defaultModel = process.env.LLM_DEFAULT_MODEL || DEFAULT_MODEL;

  return {
    baseUrl,
    apiKey,
    defaultModel,
  };
}

const SYSTEM_PROMPT: OpenAIMessage = {
  role: 'system',
  content:
    'You are WickAI, an intelligent AI assistant created by a mysterious young developer whose true identity remains unknown. Answer promptly, accurately, and thoughtfully. Use clear markdown formatting for code, lists, and headers when appropriate.',
};

/**
 * Optimizes messages by applying sliding window (last 12 messages)
 * and appending the concise system prompt at the beginning.
 */
export function buildOptimizedMessages(rawMessages: Array<{ role: string; content: string }>): OpenAIMessage[] {
  // Filter out any invalid messages
  const sanitized = rawMessages
    .filter((m) => m && m.content && typeof m.content === 'string')
    .map((m) => ({
      role: (m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user') as 'user' | 'assistant' | 'system',
      content: m.content.trim(),
    }));

  // Exclude raw system messages from client, we attach our optimized compact system prompt
  const nonSystem = sanitized.filter((m) => m.role !== 'system');

  // Sliding window: keep only the last 12 messages
  const windowed = nonSystem.length > 12 ? nonSystem.slice(-12) : nonSystem;

  return [SYSTEM_PROMPT, ...windowed];
}

/**
 * Streams LLM completion via OpenAI-compatible endpoint directly to client Response as SSE
 */
export async function streamChatCompletion(
  modelName: string,
  messages: Array<{ role: string; content: string }>,
  res: Response,
  onComplete?: (fullText: string) => void | Promise<void>
): Promise<void> {
  const { baseUrl, apiKey, defaultModel } = getLLMConfig();
  const selectedModel = (modelName && modelName.trim()) || defaultModel;
  const optimizedMessages = buildOptimizedMessages(messages);

  const endpoint = `${baseUrl}/chat/completions`;

  const requestBody = {
    model: selectedModel,
    messages: optimizedMessages,
    stream: true,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

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
      let errorText = '';
      try {
        errorText = await upstreamRes.text();
      } catch (e) {
        errorText = upstreamRes.statusText;
      }
      res.write(`data: ${JSON.stringify({ error: `Upstream error (${upstreamRes.status}): ${errorText}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    if (!upstreamRes.body) {
      res.write(`data: ${JSON.stringify({ error: 'No response body stream received from LLM endpoint' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = upstreamRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';

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
          const jsonStr = trimmed.substring(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulatedText += delta;
              res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
            }
          } catch (err) {
            // Forward raw if non-json or partial
          }
        }
      }
    }

    if (buffer.trim()) {
      const trimmed = buffer.trim();
      if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
        try {
          const parsed = JSON.parse(trimmed.substring(6));
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            accumulatedText += delta;
            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
          }
        } catch (e) {
          // ignore
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

    if (onComplete) {
      try {
        await onComplete(accumulatedText);
      } catch (err) {
        console.error('Error in onComplete handler:', err);
      }
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error('LLM stream error:', err);
    const errorMsg = err.name === 'AbortError' ? 'Request timed out after 60s.' : (err.message || 'Failed to stream response from AI model.');
    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
