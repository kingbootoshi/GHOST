export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIRequestBody {
  messages: ChatMessage[];
  system?: string;
  model?: string;
}