import * as vscode from 'vscode';
import { GitDiffReader } from './gitDiffReader';
import { TemplateManager } from './templateManager';
import { AIService } from './aiService';

// Track the webview panel
let awsCredentialsPanel: vscode.WebviewPanel | undefined = undefined;

/**
 * This method is called when the extension is activated.
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Git AI Assistant is now active');

  // Register the tree data provider for the sidebar
  const treeDataProvider = new GitAIAssistantProvider();
  vscode.window.registerTreeDataProvider('gitAIAssistantPanel', treeDataProvider);

  // Register the command for opening AWS credentials configuration panel
  const configureAWSCommand = vscode.commands.registerCommand('git-ai-assistant.configureAWS', () => {
    if (awsCredentialsPanel) {
      // If we already have a panel, show it
      awsCredentialsPanel.reveal(vscode.ViewColumn.One);
    } else {
      // Otherwise, create a new panel
      awsCredentialsPanel = vscode.window.createWebviewPanel(
        'awsCredentials',
        'Configure AWS Credentials',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // Get current credentials from settings
      const config = vscode.workspace.getConfiguration('gitAIAssistant');
      const accessKeyId = config.get<string>('awsAccessKeyId') || '';
      const secretAccessKey = config.get<string>('awsSecretAccessKey') || '';
      const region = config.get<string>('awsRegion') || 'us-east-1';

      // Set webview HTML content
      awsCredentialsPanel.webview.html = getAWSCredentialsWebviewContent(accessKeyId, secretAccessKey, region);

      // Handle messages from the webview
      awsCredentialsPanel.webview.onDidReceiveMessage(
        async (message) => {
          switch (message.command) {
            case 'saveCredentials':
              try {
                // Update configuration with new values
                await config.update('awsAccessKeyId', message.accessKeyId, vscode.ConfigurationTarget.Global);
                await config.update('awsSecretAccessKey', message.secretAccessKey, vscode.ConfigurationTarget.Global);
                await config.update('awsRegion', message.region, vscode.ConfigurationTarget.Global);
                
                vscode.window.showInformationMessage('AWS credentials saved successfully!');
              } catch (error) {
                vscode.window.showErrorMessage(`Failed to save AWS credentials: ${(error as Error).message}`);
              }
              break;
          }
        },
        undefined,
        context.subscriptions
      );

      // Reset when the panel is closed
      awsCredentialsPanel.onDidDispose(
        () => {
          awsCredentialsPanel = undefined;
        },
        null,
        context.subscriptions
      );
    }
  });

  // Register the command for generating PR descriptions
  const generatePRCommand = vscode.commands.registerCommand('git-ai-assistant.generatePRDescription', async () => {
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
        const result = await vscode.window.showErrorMessage(
          'AWS credentials not configured.',
          'Configure Now'
        );
        
        if (result === 'Configure Now') {
          vscode.commands.executeCommand('git-ai-assistant.configureAWS');
        }
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

  context.subscriptions.push(generatePRCommand, configureAWSCommand);
}

/**
 * Tree data provider for the sidebar view
 */
class GitAIAssistantProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Thenable<vscode.TreeItem[]> {
    return Promise.resolve([]);
  }
}

/**
 * Generate the HTML content for the AWS credentials webview
 */
function getAWSCredentialsWebviewContent(accessKeyId: string, secretAccessKey: string, region: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configure AWS Credentials</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
        }
        .form-group {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input, select {
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            cursor: pointer;
            margin-top: 10px;
        }
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .note {
            font-size: 0.9em;
            margin-top: 5px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <h1>Configure AWS Credentials</h1>
    <p>Enter your AWS credentials for accessing Bedrock services:</p>
    
    <div class="form-group">
        <label for="accessKeyId">AWS Access Key ID:</label>
        <input type="text" id="accessKeyId" value="${accessKeyId}" placeholder="Enter your AWS Access Key ID" />
    </div>
    
    <div class="form-group">
        <label for="secretAccessKey">AWS Secret Access Key:</label>
        <input type="password" id="secretAccessKey" value="${secretAccessKey}" placeholder="Enter your AWS Secret Access Key" />
        <p class="note">Your credentials are stored securely in VS Code's settings storage.</p>
    </div>
    
    <div class="form-group">
        <label for="region">AWS Region:</label>
        <select id="region">
            <option value="us-east-1" ${region === 'us-east-1' ? 'selected' : ''}>US East (N. Virginia) - us-east-1</option>
            <option value="us-east-2" ${region === 'us-east-2' ? 'selected' : ''}>US East (Ohio) - us-east-2</option>
            <option value="us-west-1" ${region === 'us-west-1' ? 'selected' : ''}>US West (N. California) - us-west-1</option>
            <option value="us-west-2" ${region === 'us-west-2' ? 'selected' : ''}>US West (Oregon) - us-west-2</option>
            <option value="eu-west-1" ${region === 'eu-west-1' ? 'selected' : ''}>EU (Ireland) - eu-west-1</option>
            <option value="eu-central-1" ${region === 'eu-central-1' ? 'selected' : ''}>EU (Frankfurt) - eu-central-1</option>
        </select>
    </div>
    
    <button id="saveButton">Save Credentials</button>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('saveButton').addEventListener('click', () => {
            // Get values from form
            const accessKeyId = document.getElementById('accessKeyId').value.trim();
            const secretAccessKey = document.getElementById('secretAccessKey').value.trim();
            const region = document.getElementById('region').value;
            
            // Validate inputs
            if (!accessKeyId || !secretAccessKey) {
                alert('Please enter both AWS Access Key ID and Secret Access Key');
                return;
            }
            
            // Send message to extension
            vscode.postMessage({
                command: 'saveCredentials',
                accessKeyId,
                secretAccessKey,
                region
            });
        });
    </script>
</body>
</html>`;
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {} 