import * as vscode from 'vscode';
import { GitDiffReader } from './gitDiffReader';
import { TemplateManager } from './templateManager';
import { AIServiceFactory } from './aiService';

// Track the webview panels
let awsCredentialsPanel: vscode.WebviewPanel | undefined = undefined;
let googleCredentialsPanel: vscode.WebviewPanel | undefined = undefined;
let providerConfigPanel: vscode.WebviewPanel | undefined = undefined;

/**
 * This method is called when the extension is activated.
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Git AI Assistant is now active');
  console.log(`Activation events: ${context.extension.packageJSON.activationEvents}`);
  console.log(`Commands: ${JSON.stringify(context.extension.packageJSON.contributes.commands)}`);

  // Ensure commands are registered globally
  vscode.commands.executeCommand('setContext', 'git-ai-assistant.enabled', true);

  // Register the tree data provider for the sidebar
  const treeDataProvider = new GitAIAssistantProvider();
  vscode.window.registerTreeDataProvider('gitAIAssistantPanel', treeDataProvider);

  // Log all registered commands
  vscode.commands.getCommands(true).then((commands) => {
    console.log('All registered commands:', commands);
    
    // Test if our commands are already registered
    const ourCommands = [
      'git-ai-assistant.configureAWS',
      'git-ai-assistant.configureGoogle',
      'git-ai-assistant.configureProvider',
      'git-ai-assistant.generatePRDescription',
      'git-ai-assistant.testCommand'
    ];
    
    for (const cmd of ourCommands) {
      console.log(`Command ${cmd} registered: ${commands.includes(cmd)}`);
    }
  });

  // Add a simple test command to verify command registration is working
  const testCommand = vscode.commands.registerCommand('git-ai-assistant.testCommand', () => {
    console.log('Test command triggered');
    vscode.window.showInformationMessage('Git AI Assistant test command works!');
  });
  context.subscriptions.push(testCommand);
  console.log('Registered test command: git-ai-assistant.testCommand');

  // Register the command for the unified provider configuration
  const configureProviderCommand = vscode.commands.registerCommand('git-ai-assistant.configureProvider', () => {
    console.log('Configure AI Provider command triggered');
    
    // Show a confirmation to verify the command is being called
    vscode.window.showInformationMessage('Opening AI Provider configuration...', 'OK');
    
    try {
      if (providerConfigPanel) {
        // If we already have a panel, show it
        console.log('Reusing existing panel');
        providerConfigPanel.reveal(vscode.ViewColumn.One);
      } else {
        // Otherwise, create a new panel
        console.log('Creating new panel');
        providerConfigPanel = vscode.window.createWebviewPanel(
          'aiProviderConfig',
          'Configure AI Provider',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true
          }
        );

        // Get current configuration
        const config = vscode.workspace.getConfiguration('gitAIAssistant');
        const provider = config.get<string>('modelProvider') || 'aws-bedrock';
        const awsAccessKeyId = config.get<string>('awsAccessKeyId') || '';
        const awsSecretAccessKey = config.get<string>('awsSecretAccessKey') || '';
        const awsRegion = config.get<string>('awsRegion') || 'us-east-1';
        const awsSessionToken = config.get<string>('awsSessionToken') || '';
        const googleApiKey = config.get<string>('googleApiKey') || '';
        const googleGeminiModel = config.get<string>('googleGeminiModel') || 'gemini-1.5-flash';

        console.log('Setting webview HTML content');
        // Set webview HTML content
        providerConfigPanel.webview.html = getProviderConfigWebviewContent(
          provider,
          {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
            region: awsRegion,
            sessionToken: awsSessionToken
          },
          {
            apiKey: googleApiKey,
            modelId: googleGeminiModel
          }
        );

        // Handle messages from the webview
        providerConfigPanel.webview.onDidReceiveMessage(
          async (message) => {
            console.log('Received message from webview:', message.command);
            switch (message.command) {
              case 'saveConfiguration':
                try {
                  // Update configuration with new values based on provider
                  await config.update('modelProvider', message.provider, vscode.ConfigurationTarget.Global);
                  
                  if (message.provider === 'aws-bedrock') {
                    await config.update('awsAccessKeyId', message.aws.accessKeyId, vscode.ConfigurationTarget.Global);
                    await config.update('awsSecretAccessKey', message.aws.secretAccessKey, vscode.ConfigurationTarget.Global);
                    await config.update('awsRegion', message.aws.region, vscode.ConfigurationTarget.Global);
                    await config.update('awsSessionToken', message.aws.sessionToken, vscode.ConfigurationTarget.Global);
                  } else if (message.provider === 'google-gemini') {
                    await config.update('googleApiKey', message.google.apiKey, vscode.ConfigurationTarget.Global);
                    await config.update('googleGeminiModel', message.google.modelId, vscode.ConfigurationTarget.Global);
                  }
                  
                  vscode.window.showInformationMessage(`AI Provider configured: ${message.provider === 'aws-bedrock' ? 'AWS Bedrock' : 'Google Gemini'}`);
                  
                  // Refresh the sidebar to reflect the new provider
                  treeDataProvider.refresh();
                } catch (error) {
                  vscode.window.showErrorMessage(`Failed to save configuration: ${(error as Error).message}`);
                }
                break;
            }
          },
          undefined,
          context.subscriptions
        );

        // Reset when the panel is closed
        providerConfigPanel.onDidDispose(
          () => {
            console.log('Panel disposed');
            providerConfigPanel = undefined;
          },
          null,
          context.subscriptions
        );
      }
    } catch (error) {
      console.error('Error in configureProvider command:', error);
      vscode.window.showErrorMessage(`Error configuring provider: ${(error as Error).message}`);
    }
  });
  context.subscriptions.push(configureProviderCommand);
  console.log('Registered command: git-ai-assistant.configureProvider');

  // Register the command for opening AWS credentials configuration panel
  const configureAWSCommand = vscode.commands.registerCommand('git-ai-assistant.configureAWS', () => {
    console.log('Configure AWS command triggered');
    
    // Show a confirmation to verify the command is being called
    vscode.window.showInformationMessage('Opening AWS credentials configuration...', 'OK');
    
    try {
      if (awsCredentialsPanel) {
        // If we already have a panel, show it
        console.log('Reusing existing panel');
        awsCredentialsPanel.reveal(vscode.ViewColumn.One);
      } else {
        // Otherwise, create a new panel
        console.log('Creating new panel');
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
        const sessionToken = config.get<string>('awsSessionToken') || '';

        console.log('Setting webview HTML content');
        // Set webview HTML content
        awsCredentialsPanel.webview.html = getAWSCredentialsWebviewContent(accessKeyId, secretAccessKey, region, sessionToken);

        // Handle messages from the webview
        awsCredentialsPanel.webview.onDidReceiveMessage(
          async (message) => {
            console.log('Received message from webview:', message.command);
            switch (message.command) {
              case 'saveCredentials':
                try {
                  // Update configuration with new values
                  await config.update('awsAccessKeyId', message.accessKeyId, vscode.ConfigurationTarget.Global);
                  await config.update('awsSecretAccessKey', message.secretAccessKey, vscode.ConfigurationTarget.Global);
                  await config.update('awsRegion', message.region, vscode.ConfigurationTarget.Global);
                  await config.update('awsSessionToken', message.sessionToken, vscode.ConfigurationTarget.Global);
                  
                  // Set AWS as the model provider
                  await config.update('modelProvider', 'aws-bedrock', vscode.ConfigurationTarget.Global);
                  
                  vscode.window.showInformationMessage('AWS credentials saved successfully! AWS Bedrock is now your model provider.');
                  
                  // Refresh the sidebar to reflect the new provider
                  treeDataProvider.refresh();
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
            console.log('Panel disposed');
            awsCredentialsPanel = undefined;
          },
          null,
          context.subscriptions
        );
      }
    } catch (error) {
      console.error('Error in configureAWS command:', error);
      vscode.window.showErrorMessage(`Error configuring AWS: ${(error as Error).message}`);
    }
  });
  context.subscriptions.push(configureAWSCommand);
  console.log('Registered command: git-ai-assistant.configureAWS');

  // Register the command for opening Google credentials configuration panel
  const configureGoogleCommand = vscode.commands.registerCommand('git-ai-assistant.configureGoogle', () => {
    console.log('Configure Google command triggered');
    
    // Show a confirmation to verify the command is being called
    vscode.window.showInformationMessage('Opening Google credentials configuration...', 'OK');
    
    try {
      if (googleCredentialsPanel) {
        // If we already have a panel, show it
        console.log('Reusing existing panel');
        googleCredentialsPanel.reveal(vscode.ViewColumn.One);
      } else {
        // Otherwise, create a new panel
        console.log('Creating new panel');
        googleCredentialsPanel = vscode.window.createWebviewPanel(
          'googleCredentials',
          'Configure Google Credentials',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true
          }
        );

        // Get current credentials from settings
        const config = vscode.workspace.getConfiguration('gitAIAssistant');
        const apiKey = config.get<string>('googleApiKey') || '';
        const modelId = config.get<string>('googleGeminiModel') || 'gemini-1.5-flash';

        console.log('Setting webview HTML content');
        // Set webview HTML content
        googleCredentialsPanel.webview.html = getGoogleCredentialsWebviewContent(apiKey, modelId);

        // Handle messages from the webview
        googleCredentialsPanel.webview.onDidReceiveMessage(
          async (message) => {
            console.log('Received message from webview:', message.command);
            switch (message.command) {
              case 'saveCredentials':
                try {
                  // Update configuration with new values
                  await config.update('googleApiKey', message.apiKey, vscode.ConfigurationTarget.Global);
                  await config.update('googleGeminiModel', message.modelId, vscode.ConfigurationTarget.Global);
                  
                  // Set Google as the model provider
                  await config.update('modelProvider', 'google-gemini', vscode.ConfigurationTarget.Global);
                  
                  vscode.window.showInformationMessage('Google credentials saved successfully! Google Gemini is now your model provider.');
                  
                  // Refresh the sidebar to reflect the new provider
                  treeDataProvider.refresh();
                } catch (error) {
                  vscode.window.showErrorMessage(`Failed to save Google credentials: ${(error as Error).message}`);
                }
                break;
            }
          },
          undefined,
          context.subscriptions
        );

        // Reset when the panel is closed
        googleCredentialsPanel.onDidDispose(
          () => {
            console.log('Panel disposed');
            googleCredentialsPanel = undefined;
          },
          null,
          context.subscriptions
        );
      }
    } catch (error) {
      console.error('Error in configureGoogle command:', error);
      vscode.window.showErrorMessage(`Error configuring Google: ${(error as Error).message}`);
    }
  });
  context.subscriptions.push(configureGoogleCommand);
  console.log('Registered command: git-ai-assistant.configureGoogle');

  // Register the command for generating PR descriptions
  const generatePRCommand = vscode.commands.registerCommand('git-ai-assistant.generatePRDescription', async () => {
    console.log('Generate PR Description command triggered');
    
    try {
      // Get git diff
      const gitDiffReader = new GitDiffReader();
      const diff = await gitDiffReader.getDiff();
      
      if (!diff) {
        vscode.window.showInformationMessage('No changes detected. Make sure you have staged changes.');
        return;
      }
      
      // Get template
      const templateManager = new TemplateManager(context);
      const template = await templateManager.getTemplate();
      
      // Show progress notification
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Generating PR Description',
        cancellable: false
      }, async (progress) => {
        try {
          progress.report({ message: 'Calling AI service...' });
          
          // Get configuration
          const config = vscode.workspace.getConfiguration('gitAIAssistant');
          const modelProvider = config.get<string>('modelProvider') || 'aws-bedrock';
          
          // Create the appropriate AI service based on the provider
          let aiService;
          
          if (modelProvider === 'aws-bedrock') {
            // Get AWS credentials from settings
            const accessKeyId = config.get<string>('awsAccessKeyId') || '';
            const secretAccessKey = config.get<string>('awsSecretAccessKey') || '';
            const region = config.get<string>('awsRegion') || 'us-east-1';
            const sessionToken = config.get<string>('awsSessionToken') || '';
            
            if (!accessKeyId || !secretAccessKey) {
              vscode.window.showErrorMessage('AWS credentials not configured. Please use the Configure AWS Credentials command first.');
              return Promise.resolve();
            }
            
            // Create AWS Bedrock service
            aiService = AIServiceFactory.createService('aws-bedrock', {
              region,
              accessKeyId,
              secretAccessKey,
              sessionToken
            });
          } else if (modelProvider === 'google-gemini') {
            // Get Google credentials from settings
            const apiKey = config.get<string>('googleApiKey') || '';
            const modelId = config.get<string>('googleGeminiModel') || 'gemini-1.5-flash';
            
            if (!apiKey) {
              vscode.window.showErrorMessage('Google API key not configured. Please use the Configure Google Credentials command first.');
              return Promise.resolve();
            }
            
            // Create Google Gemini service
            aiService = AIServiceFactory.createService('google-gemini', {
              apiKey,
              modelId
            });
          } else {
            vscode.window.showErrorMessage(`Unknown model provider: ${modelProvider}`);
            return Promise.resolve();
          }
          
          // Use AI service to generate description
          const description = await aiService.generatePRDescription(diff, template);
          
          if (description) {
            // Create a new untitled document with the PR description
            const document = await vscode.workspace.openTextDocument({
              content: description,
              language: 'markdown'
            });
            
            await vscode.window.showTextDocument(document);
            vscode.window.showInformationMessage('PR Description generated successfully!');
          } else {
            vscode.window.showErrorMessage('Failed to generate PR description.');
          }
        } catch (error) {
          console.error('Error generating PR description:', error);
          vscode.window.showErrorMessage(`Error generating PR description: ${(error as Error).message}`);
        }
        
        return Promise.resolve();
      });
    } catch (error) {
      console.error('Error in generatePRDescription command:', error);
      vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
    }
  });
  context.subscriptions.push(generatePRCommand);
  console.log('Registered command: git-ai-assistant.generatePRDescription');
  
  // Expose a public API
  return {
    testCommand: () => vscode.commands.executeCommand('git-ai-assistant.testCommand'),
    configureProvider: () => vscode.commands.executeCommand('git-ai-assistant.configureProvider'),
    generatePRDescription: () => vscode.commands.executeCommand('git-ai-assistant.generatePRDescription')
  };
}

/**
 * Tree data provider for the sidebar view
 */
class GitAIAssistantProvider implements vscode.TreeDataProvider<GitAIAssistantItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<GitAIAssistantItem | undefined | null | void> = new vscode.EventEmitter<GitAIAssistantItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<GitAIAssistantItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GitAIAssistantItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GitAIAssistantItem): Thenable<GitAIAssistantItem[]> {
    if (element) {
      return Promise.resolve([]);
    } else {
      // Get current provider
      const config = vscode.workspace.getConfiguration('gitAIAssistant');
      const provider = config.get<string>('modelProvider') || 'aws-bedrock';
      
      // Root elements - simplified to just two options
      const items = [
        new GitAIAssistantItem('Generate PR Description', 'Generate a PR description using AI', 'git-ai-assistant.generatePRDescription', 'notebook'),
        new GitAIAssistantItem('Configure AI Provider', `Current: ${provider === 'aws-bedrock' ? 'AWS Bedrock' : 'Google Gemini'}`, 'git-ai-assistant.configureProvider', 'gear')
      ];
      
      return Promise.resolve(items);
    }
  }
}

/**
 * Tree item for the sidebar view
 */
class GitAIAssistantItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    private readonly commandId?: string,
    public readonly iconName?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.tooltip = tooltip;
    
    if (commandId) {
      this.command = {
        command: commandId,
        title: label
      };
    }
    
    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }
  }
}

/**
 * Get the HTML content for the AWS credentials webview
 */
function getAWSCredentialsWebviewContent(
  accessKeyId: string, 
  secretAccessKey: string, 
  region: string,
  sessionToken: string = ''
): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configure AWS Credentials</title>
    <style>
      body {
        padding: 16px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
      }
      .container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      label {
        display: block;
        margin-bottom: 4px;
      }
      input, select {
        width: 100%;
        padding: 8px;
        box-sizing: border-box;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
      }
      button {
        padding: 8px 16px;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        cursor: pointer;
      }
      button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
      .field {
        margin-bottom: 16px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Configure AWS Credentials</h1>
      <p>Enter your AWS credentials to use with Bedrock for AI-generated PR descriptions.</p>
      
      <div class="field">
        <label for="accessKeyId">AWS Access Key ID</label>
        <input type="text" id="accessKeyId" value="${accessKeyId}" placeholder="Enter your AWS Access Key ID" />
      </div>
      
      <div class="field">
        <label for="secretAccessKey">AWS Secret Access Key</label>
        <input type="password" id="secretAccessKey" value="${secretAccessKey}" placeholder="Enter your AWS Secret Access Key" />
      </div>
      
      <div class="field">
        <label for="region">AWS Region</label>
        <select id="region">
          <option value="us-east-1" ${region === 'us-east-1' ? 'selected' : ''}>US East (N. Virginia) - us-east-1</option>
          <option value="us-east-2" ${region === 'us-east-2' ? 'selected' : ''}>US East (Ohio) - us-east-2</option>
          <option value="us-west-1" ${region === 'us-west-1' ? 'selected' : ''}>US West (N. California) - us-west-1</option>
          <option value="us-west-2" ${region === 'us-west-2' ? 'selected' : ''}>US West (Oregon) - us-west-2</option>
          <option value="eu-west-1" ${region === 'eu-west-1' ? 'selected' : ''}>EU (Ireland) - eu-west-1</option>
          <option value="eu-central-1" ${region === 'eu-central-1' ? 'selected' : ''}>EU (Frankfurt) - eu-central-1</option>
          <option value="ap-northeast-1" ${region === 'ap-northeast-1' ? 'selected' : ''}>Asia Pacific (Tokyo) - ap-northeast-1</option>
          <option value="ap-northeast-2" ${region === 'ap-northeast-2' ? 'selected' : ''}>Asia Pacific (Seoul) - ap-northeast-2</option>
          <option value="ap-southeast-1" ${region === 'ap-southeast-1' ? 'selected' : ''}>Asia Pacific (Singapore) - ap-southeast-1</option>
          <option value="ap-southeast-2" ${region === 'ap-southeast-2' ? 'selected' : ''}>Asia Pacific (Sydney) - ap-southeast-2</option>
        </select>
      </div>
      
      <div class="field">
        <label for="sessionToken">AWS Session Token (optional)</label>
        <input type="password" id="sessionToken" value="${sessionToken}" placeholder="Enter your AWS Session Token if using temporary credentials" />
      </div>
      
      <button id="saveButton">Save Credentials & Use AWS Bedrock</button>
    </div>
    
    <script>
      const vscode = acquireVsCodeApi();
      
      document.getElementById('saveButton').addEventListener('click', () => {
        const accessKeyId = document.getElementById('accessKeyId').value;
        const secretAccessKey = document.getElementById('secretAccessKey').value;
        const region = document.getElementById('region').value;
        const sessionToken = document.getElementById('sessionToken').value;
        
        vscode.postMessage({
          command: 'saveCredentials',
          accessKeyId,
          secretAccessKey,
          region,
          sessionToken
        });
      });
    </script>
  </body>
  </html>`;
}

/**
 * Get the HTML content for the Google credentials webview
 */
function getGoogleCredentialsWebviewContent(apiKey: string, modelId: string): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configure Google Credentials</title>
    <style>
      body {
        padding: 16px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
      }
      .container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      label {
        display: block;
        margin-bottom: 4px;
      }
      input, select {
        width: 100%;
        padding: 8px;
        box-sizing: border-box;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
      }
      button {
        padding: 8px 16px;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        cursor: pointer;
      }
      button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
      .field {
        margin-bottom: 16px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Configure Google Credentials</h1>
      <p>Enter your Google API key to use with Gemini for AI-generated PR descriptions.</p>
      
      <div class="field">
        <label for="apiKey">Google API Key</label>
        <input type="password" id="apiKey" value="${apiKey}" placeholder="Enter your Google API Key" />
      </div>
      
      <div class="field">
        <label for="modelId">Gemini Model</label>
        <select id="modelId">
          <option value="gemini-1.5-flash" ${modelId === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash</option>
          <option value="gemini-1.5-flash-8b" ${modelId === 'gemini-1.5-flash-8b' ? 'selected' : ''}>Gemini 1.5 Flash 8B</option>
          <option value="gemini-2.0-flash-exp" ${modelId === 'gemini-2.0-flash-exp' ? 'selected' : ''}>Gemini 2.0 Flash (Experimental)</option>
        </select>
      </div>
      
      <button id="saveButton">Save Credentials & Use Google Gemini</button>
    </div>
    
    <script>
      const vscode = acquireVsCodeApi();
      
      document.getElementById('saveButton').addEventListener('click', () => {
        const apiKey = document.getElementById('apiKey').value;
        const modelId = document.getElementById('modelId').value;
        
        vscode.postMessage({
          command: 'saveCredentials',
          apiKey,
          modelId
        });
      });
    </script>
  </body>
  </html>`;
}

/**
 * Get the HTML content for the unified AI provider configuration webview
 */
function getProviderConfigWebviewContent(
  currentProvider: string,
  awsConfig: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    sessionToken: string;
  },
  googleConfig: {
    apiKey: string;
    modelId: string;
  }
): string {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configure AI Provider</title>
    <style>
      body {
        padding: 16px;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
      }
      .container {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      label {
        display: block;
        margin-bottom: 4px;
      }
      input, select {
        width: 100%;
        padding: 8px;
        box-sizing: border-box;
        background-color: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
      }
      button {
        padding: 8px 16px;
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        cursor: pointer;
      }
      button:hover {
        background-color: var(--vscode-button-hoverBackground);
      }
      .field {
        margin-bottom: 16px;
      }
      .provider-section {
        margin-top: 16px;
        padding: 16px;
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
      }
      .hidden {
        display: none;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Configure AI Provider</h1>
      <p>Select an AI provider and configure its credentials for generating PR descriptions.</p>
      
      <div class="field">
        <label for="provider">AI Provider</label>
        <select id="provider">
          <option value="aws-bedrock" ${currentProvider === 'aws-bedrock' ? 'selected' : ''}>AWS Bedrock (Claude)</option>
          <option value="google-gemini" ${currentProvider === 'google-gemini' ? 'selected' : ''}>Google Gemini</option>
        </select>
      </div>
      
      <!-- AWS Bedrock Configuration -->
      <div id="aws-section" class="provider-section ${currentProvider === 'aws-bedrock' ? '' : 'hidden'}">
        <h2>AWS Bedrock Configuration</h2>
        <p>Enter your AWS credentials to use with Bedrock.</p>
        
        <div class="field">
          <label for="aws-access-key">AWS Access Key ID</label>
          <input type="text" id="aws-access-key" value="${awsConfig.accessKeyId}" placeholder="Enter your AWS Access Key ID" />
        </div>
        
        <div class="field">
          <label for="aws-secret-key">AWS Secret Access Key</label>
          <input type="password" id="aws-secret-key" value="${awsConfig.secretAccessKey}" placeholder="Enter your AWS Secret Access Key" />
        </div>
        
        <div class="field">
          <label for="aws-region">AWS Region</label>
          <select id="aws-region">
            <option value="us-east-1" ${awsConfig.region === 'us-east-1' ? 'selected' : ''}>US East (N. Virginia) - us-east-1</option>
            <option value="us-east-2" ${awsConfig.region === 'us-east-2' ? 'selected' : ''}>US East (Ohio) - us-east-2</option>
            <option value="us-west-1" ${awsConfig.region === 'us-west-1' ? 'selected' : ''}>US West (N. California) - us-west-1</option>
            <option value="us-west-2" ${awsConfig.region === 'us-west-2' ? 'selected' : ''}>US West (Oregon) - us-west-2</option>
            <option value="eu-west-1" ${awsConfig.region === 'eu-west-1' ? 'selected' : ''}>EU (Ireland) - eu-west-1</option>
            <option value="eu-central-1" ${awsConfig.region === 'eu-central-1' ? 'selected' : ''}>EU (Frankfurt) - eu-central-1</option>
            <option value="ap-northeast-1" ${awsConfig.region === 'ap-northeast-1' ? 'selected' : ''}>Asia Pacific (Tokyo) - ap-northeast-1</option>
            <option value="ap-northeast-2" ${awsConfig.region === 'ap-northeast-2' ? 'selected' : ''}>Asia Pacific (Seoul) - ap-northeast-2</option>
            <option value="ap-southeast-1" ${awsConfig.region === 'ap-southeast-1' ? 'selected' : ''}>Asia Pacific (Singapore) - ap-southeast-1</option>
            <option value="ap-southeast-2" ${awsConfig.region === 'ap-southeast-2' ? 'selected' : ''}>Asia Pacific (Sydney) - ap-southeast-2</option>
          </select>
        </div>
        
        <div class="field">
          <label for="aws-session-token">AWS Session Token (optional)</label>
          <input type="password" id="aws-session-token" value="${awsConfig.sessionToken}" placeholder="Enter your AWS Session Token if using temporary credentials" />
        </div>
      </div>
      
      <!-- Google Gemini Configuration -->
      <div id="google-section" class="provider-section ${currentProvider === 'google-gemini' ? '' : 'hidden'}">
        <h2>Google Gemini Configuration</h2>
        <p>Enter your Google API key and select a Gemini model.</p>
        
        <div class="field">
          <label for="google-api-key">Google API Key</label>
          <input type="password" id="google-api-key" value="${googleConfig.apiKey}" placeholder="Enter your Google API Key" />
        </div>
        
        <div class="field">
          <label for="google-model">Gemini Model</label>
          <select id="google-model">
            <option value="gemini-1.5-flash" ${googleConfig.modelId === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini 1.5 Flash</option>
            <option value="gemini-1.5-flash-8b" ${googleConfig.modelId === 'gemini-1.5-flash-8b' ? 'selected' : ''}>Gemini 1.5 Flash 8B</option>
            <option value="gemini-2.0-flash-exp" ${googleConfig.modelId === 'gemini-2.0-flash-exp' ? 'selected' : ''}>Gemini 2.0 Flash (Experimental)</option>
          </select>
        </div>
      </div>
      
      <button id="saveButton">Save Configuration</button>
    </div>
    
    <script>
      const vscode = acquireVsCodeApi();
      const providerSelect = document.getElementById('provider');
      const awsSection = document.getElementById('aws-section');
      const googleSection = document.getElementById('google-section');
      
      // Toggle visibility of provider sections based on selection
      providerSelect.addEventListener('change', () => {
        const provider = providerSelect.value;
        
        if (provider === 'aws-bedrock') {
          awsSection.classList.remove('hidden');
          googleSection.classList.add('hidden');
        } else if (provider === 'google-gemini') {
          awsSection.classList.add('hidden');
          googleSection.classList.remove('hidden');
        }
      });
      
      // Save button handler
      document.getElementById('saveButton').addEventListener('click', () => {
        const provider = providerSelect.value;
        
        // Get configuration based on the selected provider
        const config = {
          command: 'saveConfiguration',
          provider: provider,
          aws: {
            accessKeyId: document.getElementById('aws-access-key').value,
            secretAccessKey: document.getElementById('aws-secret-key').value,
            region: document.getElementById('aws-region').value,
            sessionToken: document.getElementById('aws-session-token').value
          },
          google: {
            apiKey: document.getElementById('google-api-key').value,
            modelId: document.getElementById('google-model').value
          }
        };
        
        vscode.postMessage(config);
      });
    </script>
  </body>
  </html>`;
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {
  if (awsCredentialsPanel) {
    awsCredentialsPanel.dispose();
  }
  if (googleCredentialsPanel) {
    googleCredentialsPanel.dispose();
  }
  if (providerConfigPanel) {
    providerConfigPanel.dispose();
  }
} 