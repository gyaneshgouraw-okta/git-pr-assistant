import * as vscode from 'vscode';
import { GitDiffReader } from './gitDiffReader';
import { TemplateManager } from './templateManager';
import { AIServiceFactory } from './aiService';

// Track the webview panels
let awsCredentialsPanel: vscode.WebviewPanel | undefined = undefined;
let googleCredentialsPanel: vscode.WebviewPanel | undefined = undefined;
let providerConfigPanel: vscode.WebviewPanel | undefined = undefined;

// Store the extension context for access throughout the module
let extensionContext: vscode.ExtensionContext;

// Add a global templateManager variable at the top of the file
let templateManager: TemplateManager;

/**
 * This method is called when the extension is activated.
 * @param context The extension context
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('Activating Git AI Assistant extension...');
  
  // Store context for global access
  extensionContext = context;
  
  // Initialize the template manager
  templateManager = new TemplateManager(context);
  
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
        const useRepoTemplate = config.get<boolean>('useRepoTemplate') || false;

        console.log('Setting webview HTML content');
        // Set webview HTML content
        providerConfigPanel.webview.html = getProviderConfigWebviewContent(
          provider,
          awsAccessKeyId,
          awsSecretAccessKey,
          awsRegion,
          awsSessionToken,
          googleApiKey,
          googleGeminiModel,
          config.get<string>('templateSource', 'repository'),
          templateManager.getCustomTemplate() || '',
          config.get<string>('defaultTemplate', '')
        );

        // Handle messages from the webview
        providerConfigPanel.webview.onDidReceiveMessage(
          async (message) => {
            switch (message.command) {
              case 'saveConfiguration':
                const provider = message.provider;
                const templateSource = message.templateSource;
                const diffSource = message.diffSource || 'staged';
                const commitCount = message.commitCount || 1;
                
                // Save general settings
                await config.update('modelProvider', provider, vscode.ConfigurationTarget.Global);
                await config.update('templateSource', templateSource, vscode.ConfigurationTarget.Global);
                await config.update('diffSource', diffSource, vscode.ConfigurationTarget.Global);
                await config.update('commitCount', commitCount, vscode.ConfigurationTarget.Global);
                console.log(`Saved settings - template: ${templateSource}, diffSource: ${diffSource}, commitCount: ${commitCount}`);
                
                if (provider === 'aws-bedrock') {
                  // Save AWS settings
                  await config.update('awsAccessKeyId', message.awsAccessKeyId, vscode.ConfigurationTarget.Global);
                  await config.update('awsSecretAccessKey', message.awsSecretAccessKey, vscode.ConfigurationTarget.Global);
                  await config.update('awsRegion', message.awsRegion, vscode.ConfigurationTarget.Global);
                  await config.update('awsSessionToken', message.awsSessionToken, vscode.ConfigurationTarget.Global);
                  vscode.window.showInformationMessage('AWS Bedrock configuration saved successfully');
                } else if (provider === 'google-gemini') {
                  // Save Google settings
                  await config.update('googleApiKey', message.googleApiKey, vscode.ConfigurationTarget.Global);
                  await config.update('googleGeminiModel', message.googleModel, vscode.ConfigurationTarget.Global);
                  vscode.window.showInformationMessage('Google Gemini configuration saved successfully');
                }
                
                // Refresh tree view to show updated provider
                treeDataProvider.refresh();
                break;
                
              case 'saveCustomTemplate':
                // Save custom template to extension global state
                templateManager.saveCustomTemplate(message.template);
                // Update template source to 'custom'
                await config.update('templateSource', 'custom', vscode.ConfigurationTarget.Global);
                console.log('Saved custom template and set template source to custom');
                vscode.window.showInformationMessage('Custom template saved successfully');
                treeDataProvider.refresh();
                
                // Refresh webview to show template source change
                if (providerConfigPanel) {
                  updateProviderConfigPanel();
                }
                break;
                
              case 'deleteCustomTemplate':
                // Delete custom template from extension global state
                templateManager.deleteCustomTemplate();
                // Set template source to 'default'
                await config.update('templateSource', 'default', vscode.ConfigurationTarget.Global);
                console.log('Deleted custom template and set template source to default');
                vscode.window.showInformationMessage('Custom template deleted');
                
                // Refresh webview
                if (providerConfigPanel) {
                  updateProviderConfigPanel();
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
      // Get configuration for diff source and commit count
      const config = vscode.workspace.getConfiguration('gitAIAssistant');
      const diffSource = config.get<string>('diffSource', 'staged');
      const commitCount = config.get<number>('commitCount', 1);
      
      console.log(`Using diff source: ${diffSource}, commit count: ${commitCount}`);
      
      // Get git diff
      console.log('Creating GitDiffReader instance...');
      const gitDiffReader = new GitDiffReader();
      console.log('Calling getDiff()...');
      const diff = await gitDiffReader.getDiff(diffSource, commitCount);
      console.log('getDiff() returned:', diff ? `diff of length ${diff.length}` : 'null');
      
      if (!diff) {
        if (diffSource === 'staged') {
          vscode.window.showInformationMessage('No staged changes detected. Make sure you have staged changes using "git add" command.');
        } else {
          vscode.window.showInformationMessage(`No changes found in the last ${commitCount} commit(s). Try increasing the commit count.`);
        }
        return;
      }
      
      // Get the active workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const activeWorkspaceFolder = workspaceFolders && workspaceFolders.length > 0 ? 
        workspaceFolders[0] : undefined;
      console.log('Active workspace folder:', activeWorkspaceFolder?.uri.fsPath || 'none');
      
      // Use the global templateManager instead of creating a new instance
      console.log('Getting template from templateManager...');
      const template = await templateManager.getTemplate(activeWorkspaceFolder);
      console.log('Template retrieved, length:', template.length);
      
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
          console.log('Using model provider:', modelProvider);
          
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
            console.log('Creating AWS Bedrock service...');
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
class GitAIAssistantProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }
    
    // Get the current model provider configuration
    const config = vscode.workspace.getConfiguration('gitAIAssistant');
    const provider = config.get<string>('modelProvider', 'aws-bedrock');
    const templateSource = config.get<string>('templateSource', 'default');
    
    // Format the provider name for display
    let providerDisplay = 'AWS Bedrock';
    if (provider === 'google-gemini') {
      providerDisplay = 'Google Gemini';
    }
    
    // Format the template source for display
    let templateDisplay = 'Default';
    if (templateSource === 'custom') {
      templateDisplay = 'Custom';
    }
    
    // Create the root elements
    return Promise.resolve([
      new TreeItem(
        'Generate PR Description',
        'Click to generate a PR description using AI',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'git-ai-assistant.generatePRDescription',
          title: 'Generate PR Description',
          arguments: []
        },
        'git-pull-request'
      ),
      new TreeItem(
        `Configure Settings (Provider: ${providerDisplay}, Template: ${templateDisplay})`,
        'Configure AI provider and template settings',
        vscode.TreeItemCollapsibleState.None,
        {
          command: 'git-ai-assistant.configureProvider',
          title: 'Configure Settings',
          arguments: []
        },
        'gear'
      )
    ]);
  }
}

/**
 * Tree item for the sidebar view
 */
class TreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    iconName?: string
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip;
    
    if (command) {
      this.command = command;
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
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsRegion: string,
  awsSessionToken: string,
  googleApiKey: string,
  googleModel: string,
  templateSource: string,
  customTemplate: string,
  defaultTemplate: string
): string {
  // Get current configuration
  const config = vscode.workspace.getConfiguration('gitAIAssistant');
  const diffSource = config.get<string>('diffSource', 'staged');
  const commitCount = config.get<number>('commitCount', 1);
  
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Provider Configuration</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
        }
        .provider-selector {
            margin-bottom: 20px;
        }
        .config-section {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
        }
        .field {
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-bottom: 5px;
        }
        input, select, textarea {
            width: 100%;
            padding: 8px;
            box-sizing: border-box;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        input[type="radio"] {
            width: auto;
            margin-right: 8px;
        }
        .radio-label {
            display: inline-flex;
            align-items: center;
            margin-right: 15px;
        }
        textarea {
            min-height: 200px;
            font-family: monospace;
        }
        .template-section {
            margin-top: 30px;
            border-top: 1px solid var(--vscode-panel-border);
            padding-top: 20px;
        }
        .diff-source-section {
            margin-top: 30px;
            border-top: 1px solid var(--vscode-panel-border);
            padding-top: 20px;
        }
        button {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
            margin-right: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .custom-template-section {
            margin-top: 15px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            display: ${templateSource === 'custom' ? 'block' : 'none'};
        }
        .commit-count-field {
            margin-top: 15px;
            display: ${diffSource === 'commits' ? 'block' : 'none'};
        }
    </style>
</head>
<body>
    <h1>AI Provider Configuration</h1>
    
    <div class="provider-selector">
        <label for="provider-select">Select AI Provider:</label>
        <select id="provider-select">
            <option value="aws-bedrock" ${currentProvider === 'aws-bedrock' ? 'selected' : ''}>AWS Bedrock</option>
            <option value="google-gemini" ${currentProvider === 'google-gemini' ? 'selected' : ''}>Google Gemini</option>
        </select>
    </div>
    
    <div id="aws-config" class="config-section" style="display: ${currentProvider === 'aws-bedrock' ? 'block' : 'none'}">
        <h2>AWS Bedrock Configuration</h2>
        <div class="field">
            <label for="aws-access-key">Access Key ID:</label>
            <input type="password" id="aws-access-key" value="${awsAccessKeyId}" placeholder="Enter AWS Access Key ID">
        </div>
        <div class="field">
            <label for="aws-secret-key">Secret Access Key:</label>
            <input type="password" id="aws-secret-key" value="${awsSecretAccessKey}" placeholder="Enter AWS Secret Access Key">
        </div>
        <div class="field">
            <label for="aws-region">Region:</label>
            <input type="text" id="aws-region" value="${awsRegion}" placeholder="Enter AWS Region (e.g., us-west-2)">
        </div>
        <div class="field">
            <label for="aws-session-token">Session Token (optional):</label>
            <input type="password" id="aws-session-token" value="${awsSessionToken}" placeholder="Enter AWS Session Token if using temporary credentials">
        </div>
    </div>
    
    <div id="google-config" class="config-section" style="display: ${currentProvider === 'google-gemini' ? 'block' : 'none'}">
        <h2>Google Gemini Configuration</h2>
        <div class="field">
            <label for="google-api-key">API Key:</label>
            <input type="password" id="google-api-key" value="${googleApiKey}" placeholder="Enter Google API Key">
        </div>
        <div class="field">
            <label for="google-model">Model:</label>
            <select id="google-model">
                <option value="gemini-pro" ${googleModel === 'gemini-pro' ? 'selected' : ''}>gemini-pro</option>
                <option value="gemini-pro-vision" ${googleModel === 'gemini-pro-vision' ? 'selected' : ''}>gemini-pro-vision</option>
            </select>
        </div>
    </div>
    
    <div class="diff-source-section">
        <h2>PR Description Source</h2>
        <div class="field">
            <label>Diff Source:</label>
            <div>
                <label class="radio-label">
                    <input type="radio" name="diff-source" value="staged" ${diffSource === 'staged' ? 'checked' : ''}>
                    Staged Changes
                </label>
                <label class="radio-label">
                    <input type="radio" name="diff-source" value="commits" ${diffSource === 'commits' ? 'checked' : ''}>
                    Recent Commits
                </label>
            </div>
        </div>
        
        <div id="commit-count-field" class="field commit-count-field">
            <label for="commit-count">Number of Recent Commits:</label>
            <input type="number" id="commit-count" value="${commitCount}" min="1" max="20" step="1">
        </div>
    </div>
    
    <div class="template-section">
        <h2>PR Template Configuration</h2>
        
        <div class="field">
            <label for="template-source">Template Source:</label>
            <select id="template-source">
                <option value="default" ${templateSource === 'default' ? 'selected' : ''}>Default Template</option>
                <option value="custom" ${templateSource === 'custom' ? 'selected' : ''}>Custom Template</option>
            </select>
        </div>
        
        <div id="custom-template-section" class="custom-template-section">
            <div class="field">
                <label for="custom-template-content">Custom Template:</label>
                <textarea id="custom-template-content" placeholder="Enter your custom PR template here">${customTemplate || ''}</textarea>
            </div>
            <div>
                <button id="save-custom-template">Save Custom Template</button>
                <button id="delete-custom-template">Delete Custom Template</button>
            </div>
        </div>
    </div>

    <button id="save-config">Save Configuration</button>

    <script>
        (function() {
            const vscode = acquireVsCodeApi();
            
            // Handle provider selection change
            const providerSelect = document.getElementById('provider-select');
            const awsConfig = document.getElementById('aws-config');
            const googleConfig = document.getElementById('google-config');
            
            providerSelect.addEventListener('change', function() {
                const provider = providerSelect.value;
                awsConfig.style.display = provider === 'aws-bedrock' ? 'block' : 'none';
                googleConfig.style.display = provider === 'google-gemini' ? 'block' : 'none';
            });
            
            // Handle template source selection
            const templateSourceSelect = document.getElementById('template-source');
            const customTemplateSection = document.getElementById('custom-template-section');
            
            templateSourceSelect.addEventListener('change', function() {
                const source = templateSourceSelect.value;
                customTemplateSection.style.display = source === 'custom' ? 'block' : 'none';
            });
            
            // Handle diff source selection
            const diffSourceRadios = document.getElementsByName('diff-source');
            const commitCountField = document.getElementById('commit-count-field');
            
            for (const radio of diffSourceRadios) {
                radio.addEventListener('change', function() {
                    const source = this.value;
                    commitCountField.style.display = source === 'commits' ? 'block' : 'none';
                });
            }
            
            // Handle save configuration button
            document.getElementById('save-config').addEventListener('click', function() {
                const provider = providerSelect.value;
                const templateSource = templateSourceSelect.value;
                
                // Get selected diff source
                let diffSource = 'staged';
                for (const radio of diffSourceRadios) {
                    if (radio.checked) {
                        diffSource = radio.value;
                        break;
                    }
                }
                
                // Get commit count
                const commitCount = parseInt(document.getElementById('commit-count').value, 10) || 1;
                
                let config = {
                    command: 'saveConfiguration',
                    provider: provider,
                    templateSource: templateSource,
                    diffSource: diffSource,
                    commitCount: commitCount
                };
                
                if (provider === 'aws-bedrock') {
                    config.awsAccessKeyId = document.getElementById('aws-access-key').value;
                    config.awsSecretAccessKey = document.getElementById('aws-secret-key').value;
                    config.awsRegion = document.getElementById('aws-region').value;
                    config.awsSessionToken = document.getElementById('aws-session-token').value;
                } else if (provider === 'google-gemini') {
                    config.googleApiKey = document.getElementById('google-api-key').value;
                    config.googleModel = document.getElementById('google-model').value;
                }
                
                vscode.postMessage(config);
            });
            
            // Handle custom template actions
            document.getElementById('save-custom-template').addEventListener('click', function() {
                const template = document.getElementById('custom-template-content').value;
                vscode.postMessage({
                    command: 'saveCustomTemplate',
                    template: template
                });
            });
            
            document.getElementById('delete-custom-template').addEventListener('click', function() {
                vscode.postMessage({
                    command: 'deleteCustomTemplate'
                });
                document.getElementById('custom-template-content').value = '';
            });
        })();
    </script>
</body>
</html>`;
}

/**
 * Function to update the provider config panel with current settings
 */
function updateProviderConfigPanel() {
  if (!providerConfigPanel) {
    return;
  }

  const config = vscode.workspace.getConfiguration('gitAIAssistant');
  const currentProvider = config.get<string>('modelProvider', 'aws-bedrock');
  const templateSource = config.get<string>('templateSource', 'repository');
  const defaultTemplate = config.get<string>('defaultTemplate', '');
  const customTemplate = templateManager.getCustomTemplate() || '';
  const diffSource = config.get<string>('diffSource', 'staged');
  const commitCount = config.get<number>('commitCount', 1);

  const awsAccessKeyId = config.get<string>('awsAccessKeyId', '');
  const awsSecretAccessKey = config.get<string>('awsSecretAccessKey', '');
  const awsRegion = config.get<string>('awsRegion', 'us-east-1');
  const awsSessionToken = config.get<string>('awsSessionToken', '');
  
  const googleApiKey = config.get<string>('googleApiKey', '');
  const googleModel = config.get<string>('googleGeminiModel', 'gemini-pro');

  providerConfigPanel.webview.html = getProviderConfigWebviewContent(
    currentProvider,
    awsAccessKeyId,
    awsSecretAccessKey,
    awsRegion,
    awsSessionToken,
    googleApiKey,
    googleModel,
    templateSource,
    customTemplate,
    defaultTemplate
  );
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