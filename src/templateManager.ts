import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Common locations for PR templates in repositories
 */
const PR_TEMPLATE_PATHS = [
  '.github/PULL_REQUEST_TEMPLATE.md',
  '.github/pull_request_template.md',
  'docs/PULL_REQUEST_TEMPLATE.md',
  'docs/pull_request_template.md',
  'PULL_REQUEST_TEMPLATE.md',
  'pull_request_template.md',
];

/**
 * Template source types
 */
export enum TemplateSource {
  Custom = 'custom',
  Default = 'default'
}

/**
 * Manages PR templates for the Git AI Assistant
 */
export class TemplateManager {
  private readonly context: vscode.ExtensionContext;
  private readonly TEMPLATE_STORAGE_KEY = 'prTemplate';
  private readonly DEFAULT_TEMPLATE = `## Description
Briefly describe the changes you've made and the problem it solves.

## Related Issues
List any related issues this PR resolves or is connected to.

## Changes
Describe the key changes in this PR.

## Testing
Explain how you tested these changes.

## Screenshots
If applicable, add screenshots to help explain your changes.

## Additional Notes
Add any other context about the PR here.`;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get the current PR template based on the selected template source
   * @returns The PR template string
   */
  async getTemplate(workspaceFolder?: vscode.WorkspaceFolder): Promise<string> {
    const config = vscode.workspace.getConfiguration('gitAIAssistant');
    const templateSource = config.get<string>('templateSource', TemplateSource.Default);

    switch (templateSource) {
      case TemplateSource.Custom:
        const customTemplate = this.getCustomTemplate();
        if (customTemplate) {
          return customTemplate;
        }
        return this.DEFAULT_TEMPLATE;
      
      case TemplateSource.Default:
      default:
        return this.DEFAULT_TEMPLATE;
    }
  }

  /**
   * Get the custom template if it exists
   * @returns The custom template string or undefined if none exists
   */
  getCustomTemplate(): string | undefined {
    return this.context.globalState.get<string>(this.TEMPLATE_STORAGE_KEY);
  }

  /**
   * Save a custom PR template
   * @param template The template string to save
   */
  saveCustomTemplate(template: string): void {
    this.context.globalState.update(this.TEMPLATE_STORAGE_KEY, template);
  }

  /**
   * Delete the custom template if it exists
   */
  deleteCustomTemplate(): void {
    this.context.globalState.update(this.TEMPLATE_STORAGE_KEY, undefined);
  }

  /**
   * Get the default template from settings
   * @returns The default template string
   */
  getDefaultTemplate(): string {
    return this.DEFAULT_TEMPLATE;
  }

  /**
   * Find a PR template in the current repository
   * @returns The template content if found, null otherwise
   */
  private async findRepoTemplate(workspaceFolder: vscode.WorkspaceFolder): Promise<string | undefined> {
    const commonTemplatePaths = [
      path.join(workspaceFolder.uri.fsPath, '.github', 'pull_request_template.md'),
      path.join(workspaceFolder.uri.fsPath, '.github', 'PULL_REQUEST_TEMPLATE.md'),
      path.join(workspaceFolder.uri.fsPath, '.github', 'PULL_REQUEST_TEMPLATE'),
      path.join(workspaceFolder.uri.fsPath, 'docs', '.github', 'pull_request_template.md'),
      path.join(workspaceFolder.uri.fsPath, 'docs', '.github', 'PULL_REQUEST_TEMPLATE.md'),
      path.join(workspaceFolder.uri.fsPath, '.github', 'PULL_REQUEST_TEMPLATE', 'pull_request_template.md')
    ];

    for (const templatePath of commonTemplatePaths) {
      try {
        if (fs.existsSync(templatePath)) {
          return fs.readFileSync(templatePath, 'utf8');
        }
      } catch (error) {
        console.error(`Error reading template at ${templatePath}:`, error);
      }
    }

    return undefined;
  }
} 