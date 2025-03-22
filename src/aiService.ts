import * as bedrockSdk from '@ai-sdk/amazon-bedrock';
import * as AWS from 'aws-sdk';

/**
 * Service that uses AWS Bedrock (Claude) via Vercel AI SDK to generate PR descriptions
 */
export class AIService {
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private sessionToken?: string;
  
  // List of Claude models to try in order of preference
  private readonly CLAUDE_MODELS = [
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
  ];
  
  /**
   * Create a new AIService
   * @param region AWS region
   * @param accessKeyId AWS access key ID
   * @param secretAccessKey AWS secret access key
   * @param sessionToken Optional AWS session token for temporary credentials
   */
  constructor(
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken?: string
  ) {
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
  }
  
  /**
   * Generate a PR description based on a git diff and a template
   * @param gitDiff The git diff to describe
   * @param template The PR template to use
   * @returns The generated PR description
   */
  async generatePRDescription(gitDiff: string, template: string): Promise<string> {
    // Set environment variables for AWS Bedrock
    process.env.AWS_ACCESS_KEY_ID = this.accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = this.secretAccessKey;
    process.env.AWS_REGION = this.region;
    
    // Set session token if provided (for temporary credentials)
    if (this.sessionToken) {
      process.env.AWS_SESSION_TOKEN = this.sessionToken;
    }
    
    // Create the prompt for the AI model
    const prompt = this.createPrompt(gitDiff, template);
    
    // Try each Claude model until one works
    let lastError: Error | null = null;
    
    for (const modelId of this.CLAUDE_MODELS) {
      try {
        console.log(`Trying to generate PR description with model: ${modelId}`);
        
        // Use AWS SDK to invoke model
        const result = await this.invokeBedrockModel(modelId, prompt);
        
        return result.trim();
      } catch (error) {
        console.error(`Error with model ${modelId}:`, error);
        lastError = error as Error;
        // Continue trying with the next model
      }
    }
    
    // If we reach here, all models failed
    throw new Error(`Failed to generate PR description with any Claude model: ${lastError?.message}`);
  }
  
  /**
   * Invoke the AWS Bedrock model directly
   * @param modelId The model ID to use
   * @param prompt The prompt to send
   * @returns The generated text
   */
  private async invokeBedrockModel(modelId: string, prompt: string): Promise<string> {
    try {
      // Configure AWS credentials
      AWS.config.update({
        region: this.region,
        credentials: new AWS.Credentials({
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
          sessionToken: this.sessionToken
        })
      });
      
      // Create Bedrock Runtime client
      const bedrockRuntime = new AWS.BedrockRuntime();
      
      // Format the request based on the model type
      let requestBody = {};
      
      if (modelId.includes('anthropic.claude')) {
        // Claude models
        requestBody = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          temperature: 0.5,
          top_p: 0.9,
          system: "You are an AI assistant that writes clear, concise pull request descriptions based on git diffs.",
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ]
        };
      } else {
        // Generic fallback (unlikely to be used, but just in case)
        requestBody = {
          prompt,
          max_tokens: 2000,
          temperature: 0.5,
          top_p: 0.9
        };
      }
      
      // Invoke the model
      const response = await bedrockRuntime.invokeModel({
        modelId: modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody)
      }).promise();
      
      // Parse the response
      const responseBody = JSON.parse(response.body.toString());
      
      // Extract the generated text based on model
      if (modelId.includes('anthropic.claude')) {
        return responseBody.content[0].text;
      } else {
        // Generic fallback
        return responseBody.generation || responseBody.text || responseBody.completion || '';
      }
    } catch (error) {
      console.error('Error invoking Bedrock model:', error);
      throw error;
    }
  }
  
  /**
   * Create a prompt for Claude to generate a PR description
   * @param gitDiff The git diff
   * @param template The PR template
   * @returns The prompt string
   */
  private createPrompt(gitDiff: string, template: string): string {
    const promptParts = [
      "I need you to create a pull request description based on the following git diff.",
      "Use the template provided below to structure your response.",
      "",
      "GIT DIFF:",
      "```",
      gitDiff,
      "```",
      "",
      "TEMPLATE:",
      "```",
      template,
      "```",
      "",
      "Please fill in the template with details about the changes in the git diff. Be concise and clear about the purpose of the changes, what was modified, and any important details reviewers should know.",
      "",
      "Don't include the template markers (like \"## Summary\") in places they don't belong, and maintain the overall structure of the template. Complete sentences are preferred."
    ];
    
    return promptParts.join("\n");
  }
} 