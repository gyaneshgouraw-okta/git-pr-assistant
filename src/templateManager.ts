import * as vscode from 'vscode';

/**
 * Manages PR templates for the Git AI Assistant
 */
export class TemplateManager {
  private readonly context: vscode.ExtensionContext;
  private readonly TEMPLATE_KEY = 'prTemplate';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get the current PR template
   * @returns The PR template string
   */
  async getTemplate(): Promise<string> {
    // Try to get a custom template from global state
    const customTemplate = this.context.globalState.get<string>(this.TEMPLATE_KEY);
    
    if (customTemplate) {
      return customTemplate;
    }
    
    // Return the default template from settings
    const config = vscode.workspace.getConfiguration('gitAIAssistant');
    return config.get<string>('defaultPRTemplate') || '## Summary\n\n## Changes\n\n## Testing\n\n## Screenshots\n\n';
  }

  /**
   * Save a new PR template
   * @param template The template string to save
   */
  async saveTemplate(template: string): Promise<void> {
    await this.context.globalState.update(this.TEMPLATE_KEY, template);
  }
} 