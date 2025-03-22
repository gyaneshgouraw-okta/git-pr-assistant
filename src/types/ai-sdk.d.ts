declare module '@ai-sdk/amazon-bedrock' {
  export function bedrock(config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  } | string): any;
}

declare module 'ai' {
  export function generateText(options: {
    model: any;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  }): Promise<{ text: string }>;
} 