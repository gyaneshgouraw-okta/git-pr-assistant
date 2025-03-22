declare module '@ai-sdk/amazon-bedrock' {
  export function bedrock(config: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  }): (modelId: string) => any;
}

// Not needed anymore since we're using the AWS SDK directly
// Keeping this declaration for potential future use if we switch back to the AI SDK
declare module 'ai' {
  export interface TextGenerationOptions {
    model: any;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  }

  export interface TextGenerationResult {
    text: string;
  }

  export function streamText(options: TextGenerationOptions): Promise<TextGenerationResult>;
} 