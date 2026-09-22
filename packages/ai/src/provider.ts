export interface AiCompletionRequest {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiCompletionResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiProvider {
  complete(request: AiCompletionRequest): Promise<AiCompletionResult>;
}
