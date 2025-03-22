import * as vscode from 'vscode';
import { GitDiffReader } from './gitDiffReader';
import { TemplateManager } from './templateManager';
import { AIService } from './aiService';

/**
 * This method is called when the extension is activated.
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Git AI Assistant is now active');

  // Register the command for generating PR descriptions
  const disposable = vscode.commands.registerCommand('git-ai-assistant.generatePRDescription', async () => {
    try {
      // Get the git diff
      const gitDiffReader = new GitDiffReader();
      const diff = await gitDiffReader.getDiff();
      
      if (!diff) {
        vscode.window.showInformationMessage('No changes detected. Make some changes before generating a PR description.');
        return;
      }
      
      // Get the template
      const templateManager = new TemplateManager(context);
      const template = await templateManager.getTemplate();
      
      // Get AWS credentials from settings
      const config = vscode.workspace.getConfiguration('gitAIAssistant');
      const accessKeyId = config.get<string>('awsAccessKeyId') || '';
      const secretAccessKey = config.get<string>('awsSecretAccessKey') || '';
      const region = config.get<string>('awsRegion') || 'us-east-1';
      
      if (!accessKeyId || !secretAccessKey) {
        vscode.window.showErrorMessage('AWS credentials not configured. Please set them in the extension settings.');
        return;
      }
      
      // Show progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating PR description...',
          cancellable: false
        },
        async () => {
          try {
            // Generate PR description
            const aiService = new AIService(region, accessKeyId, secretAccessKey);
            const prDescription = await aiService.generatePRDescription(diff, template);
            
            // Create a new text document with the PR description
            const document = await vscode.workspace.openTextDocument({
              language: 'markdown',
              content: prDescription
            });
            
            // Show the document
            await vscode.window.showTextDocument(document);
            
            vscode.window.showInformationMessage('PR description generated!');
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate PR description: ${(error as Error).message}`);
          }
        }
      );
      
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
    }
  });

  context.subscriptions.push(disposable);
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {} 