import * as vscode from 'vscode';
import { AIProvider } from './aiService';

/**
 * Model information returned from Copilot
 */
export interface CopilotModelInfo {
  id: string;
  name: string;
  family: string;
  vendor: string;
}

/**
 * VS Code Copilot implementation of the AI service
 * Uses the vscode.lm API to interact with Copilot models
 */
export class CopilotAIService implements AIProvider {
  private model: vscode.LanguageModelChat;

  /**
   * Create a new Copilot AI Service
   * @param model The VS Code Language Model to use
   */
  constructor(model: vscode.LanguageModelChat) {
    this.model = model;
  }

  /**
   * List all available Copilot models
   * @returns Array of available Copilot model information
   */
  static async listAvailableModels(): Promise<CopilotModelInfo[]> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });

      return models.map(model => ({
        id: model.id,
        name: model.name,
        family: model.family,
        vendor: model.vendor
      }));
    } catch (error) {
      console.error('Error listing Copilot models:', error);
      throw new Error(`Failed to list Copilot models: ${(error as Error).message}`);
    }
  }

  /**
   * Get a specific Copilot model by ID
   * @param modelId The model ID to retrieve
   * @returns The language model, or undefined if not found
   */
  static async getModelById(modelId: string): Promise<vscode.LanguageModelChat | undefined> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      return models.find(model => model.id === modelId);
    } catch (error) {
      console.error('Error getting Copilot model by ID:', error);
      return undefined;
    }
  }

  /**
   * Check if Copilot is available
   * @returns True if at least one Copilot model is available
   */
  static async isCopilotAvailable(): Promise<boolean> {
    try {
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      return models.length > 0;
    } catch (error) {
      console.error('Error checking Copilot availability:', error);
      return false;
    }
  }

  /**
   * Create a prompt for the AI model to generate a PR description
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

  /**
   * Generate a PR description based on a git diff and a template using Copilot
   * @param gitDiff The git diff to describe
   * @param template The PR template to use
   * @returns The generated PR description
   */
  async generatePRDescription(gitDiff: string, template: string): Promise<string> {
    try {
      console.log(`Generating PR description with Copilot model: ${this.model.name} (${this.model.id})`);

      // Create the prompt
      const prompt = this.createPrompt(gitDiff, template);

      // Create cancellation token
      const tokenSource = new vscode.CancellationTokenSource();

      // Prepare messages for the model
      const messages = [
        vscode.LanguageModelChatMessage.User(prompt)
      ];

      // Send request to Copilot
      const response = await this.model.sendRequest(messages, {}, tokenSource.token);

      // Process streaming response
      let result = '';
      for await (const chunk of response.text) {
        result += chunk;
      }

      // Clean up
      tokenSource.dispose();

      return result.trim();
    } catch (error) {
      console.error(`Error generating PR description with Copilot:`, error);

      // Provide more specific error messages
      if (error instanceof vscode.LanguageModelError) {
        if (error.code === vscode.LanguageModelError.NotFound().code) {
          throw new Error('Copilot model not found. Please ensure you have an active GitHub Copilot subscription.');
        } else if (error.code === vscode.LanguageModelError.Blocked().code) {
          throw new Error('Request was blocked by Copilot. The content may have triggered safety filters.');
        } else if (error.code === vscode.LanguageModelError.NoPermissions().code) {
          throw new Error('No permissions to access Copilot. Please ensure you have an active GitHub Copilot subscription.');
        }
      }

      throw new Error(`Failed to generate PR description with Copilot: ${(error as Error).message}`);
    }
  }
}
