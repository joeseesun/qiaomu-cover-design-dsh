export interface ApiConnection { provider: string; baseUrl: string; model: string; secretId: string; protocol?: "openai-chat" | "openai-responses" | "anthropic" | "google"; }
