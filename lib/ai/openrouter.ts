import { getOpenRouterEnv } from "@/lib/env";

export type AiRole = "system" | "user" | "assistant";

export type AiMessage = {
  role: AiRole;
  content: string;
};

export type OpenRouterOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

function buildHeaders() {
  const { apiKey, siteUrl, appName } = getOpenRouterEnv();

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": siteUrl,
    "X-Title": appName
  };
}

export async function* streamChatCompletion(
  messages: AiMessage[],
  options: OpenRouterOptions = {}
) {
  const { defaultModel } = getOpenRouterEnv();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      model: options.model || defaultModel,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1400,
      stream: true
    })
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenRouter streaming failed: ${response.status} ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = parsed.choices?.[0]?.delta?.content;
        if (token) {
          yield token;
        }
      } catch {
        continue;
      }
    }
  }
}

export async function completeText(
  messages: AiMessage[],
  options: OpenRouterOptions = {}
) {
  const { defaultModel } = getOpenRouterEnv();
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      model: options.model || defaultModel,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 1800
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenRouter completion failed: ${response.status} ${errorText}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return json.choices?.[0]?.message?.content || "";
}

export async function completeJson<T>(
  messages: AiMessage[],
  options: OpenRouterOptions = {}
) {
  const content = await completeText(
    [
      ...messages,
      {
        role: "user",
        content:
          "أعد الناتج بصيغة JSON صحيحة فقط، بدون شرح خارج JSON وبدون Markdown."
      }
    ],
    {
      ...options,
      temperature: options.temperature ?? 0.1
    }
  );

  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned) as T;
}
