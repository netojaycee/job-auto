import { AnthropicProvider } from "./providers/anthropic";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible";
import type { AiProvider } from "./provider";

export * from "./provider";

/**
 * Single entry point for getting an LLM client. Controlled entirely by env vars
 * so call sites never know or care whether they're hitting Anthropic or a local
 * Ollama instance. Never instantiate a provider class directly outside this file.
 *
 * AI_PROVIDER=anthropic (default) | ollama | openai
 * AI_MODEL=claude-sonnet-5 | claude-haiku-4-5-20251001 | qwen2.5:14b | ...
 * AI_BASE_URL=http://localhost:11434/v1 (ollama/openai only)
 */
let cached: AiProvider | undefined;

export function getAiProvider(): AiProvider {
  if (cached) return cached;

  const provider = process.env.AI_PROVIDER ?? "anthropic";

  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    cached = new AnthropicProvider(apiKey, process.env.AI_MODEL ?? "claude-sonnet-5");
    return cached;
  }

  if (provider === "ollama" || provider === "openai") {
    const baseURL = process.env.AI_BASE_URL ?? "http://localhost:11434/v1";
    const apiKey = process.env.AI_API_KEY ?? "ollama";
    const model = process.env.AI_MODEL ?? "qwen2.5:14b";
    cached = new OpenAiCompatibleProvider(baseURL, apiKey, model);
    return cached;
  }

  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}
