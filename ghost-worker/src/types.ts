export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface AIRequestBody {
  messages: ChatMessage[];
  system?: string;
  model?: string;
  tools?: ToolDefinition[];
  temperature?: number;
  max_tokens?: number;
  seed?: number;
}