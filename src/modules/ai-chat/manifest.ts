import { ModuleManifest } from '../_schema';

const manifest: ModuleManifest = {
  id: 'ai-chat',
  version: 1,
  title: 'AI Chat',
  icon: '💬',
  capabilities: {
    db: true,
    net: ['ghost-worker.ghost-ai.workers.dev']
  },
  entry: {
    main: './index.ts',
    ui: './ui.tsx'
  },
  settingsSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        title: 'AI Model',
        description: 'Select the AI model to use',
        enum: [
          '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          '@cf/meta/llama-3.1-8b-instruct',
          '@cf/google/gemma-7b-it-lora'
        ],
        default: '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
      },
      temperature: {
        type: 'number',
        title: 'Temperature',
        description: 'Controls randomness (0 = deterministic, 1 = creative)',
        minimum: 0,
        maximum: 1,
        step: 0.1,
        default: 0.7
      },
      maxTokens: {
        type: 'number',
        title: 'Max Tokens',
        description: 'Maximum response length',
        minimum: 100,
        maximum: 4000,
        step: 100,
        default: 2000
      }
    }
  }
};

export default manifest;