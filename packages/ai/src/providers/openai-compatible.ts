import OpenAI from "openai";
import type { AiCompletionRequest, AiCompletionResult, AiProvider } from "../provider";

/**
 * Works against any OpenAI-compatible chat completions endpoint —
 * used for both real OpenAI and local Ollama (http://localhost:11434/v1).
 */
export class OpenAiCompatibleProvider implements AiProvider {
  private client: OpenAI;
  private model: string;

  constructor(baseURL: string, apiKey: string, model: string) {
    this.client = new OpenAI({ baseURL, apiKey });
    this.model = model;
  }

  async complete(request: AiCompletionRequest): Promise<AiCompletionResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature,
      messages: [
        ...(request.system ? [{ role: "system" as const, content: request.system }] : []),
        { role: "user" as const, content: request.prompt },
      ],
    });

    return {
      text: response.choices[0]?.message?.content ?? "",
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
    };
  }
}
