import { 
  BedrockRuntimeClient,
  InvokeModelCommand
} from '@aws-sdk/client-bedrock-runtime';

/**
 * Service that uses AWS Bedrock (Claude) to generate PR descriptions
 */
export class AIService {
  private client: BedrockRuntimeClient;
  
  /**
   * Create a new AIService
   * @param region AWS region
   * @param accessKeyId AWS access key ID
   * @param secretAccessKey AWS secret access key
   * @param bedrockClient Optional Bedrock client for testing
   */
  constructor(
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    bedrockClient?: BedrockRuntimeClient
  ) {
    if (bedrockClient) {
      this.client = bedrockClient;
    } else {
      this.client = new BedrockRuntimeClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey
        }
      });
    }
  }
  
  /**
   * Generate a PR description based on a git diff and a template
   * @param gitDiff The git diff to describe
   * @param template The PR template to use
   * @returns The generated PR description
   */
  async generatePRDescription(gitDiff: string, template: string): Promise<string> {
    try {
      const prompt = this.createPrompt(gitDiff, template);
      
      const command = new InvokeModelCommand({
        modelId: 'anthropic.claude-v2',
        body: JSON.stringify({
          prompt: prompt,
          max_tokens_to_sample: 2000,
          temperature: 0.5,
          top_p: 0.9
        })
      });
      
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      return responseBody.completion.trim();
    } catch (error) {
      throw new Error(`Failed to generate PR description: ${(error as Error).message}`);
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
      "Human: I need you to create a pull request description based on the following git diff.",
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