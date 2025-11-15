import * as vscode from 'vscode';
import { GitDiffReader } from './gitDiffReader';
import { TemplateManager } from './templateManager';
import { CopilotAIService } from './copilotService';

// Track the webview panels
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

  // Check Copilot availability
  checkCopilotAvailability();

  console.log('Git AI Assistant is now active');
  console.log(`Activation events: ${context.extension.packageJSON.activationEvents}`);
  console.log(`Commands: ${JSON.stringify(context.extension.packageJSON.contributes.commands)}`);

  // Ensure commands are registered globally
  vscode.commands.executeCommand('setContext', 'git-ai-assistant.enabled', true);

  // Register the Material Design webview provider for the main sidebar
  const sidebarWebviewProvider = new GitAIAssistantWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gitAIAssistantWebview', sidebarWebviewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );

  // Register the SCM webview provider
  const scmWebviewProvider = new SCMWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('gitAIAssistantSCMView', scmWebviewProvider)
  );

  // Register the command for the unified provider configuration
  const configureProviderCommand = vscode.commands.registerCommand('git-ai-assistant.configureProvider', async () => {
    console.log('Configure AI Provider command triggered');

    // Show a confirmation to verify the command is being called
    vscode.window.showInformationMessage('Opening Configuration...', 'OK');

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
          'Git AI Assistant Configuration',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true
          }
        );

        // Get current configuration
        const config = vscode.workspace.getConfiguration('gitAIAssistant');
        const copilotModelId = config.get<string>('copilotModelId') || '';

        console.log('Setting webview HTML content');
        // Set webview HTML content (async)
        providerConfigPanel.webview.html = await getProviderConfigWebviewContent(
          copilotModelId,
          config.get<string>('templateSource', 'default'),
          templateManager.getCustomTemplate() || '',
          config.get<string>('defaultTemplate', '')
        );

        // Handle messages from the webview
        providerConfigPanel.webview.onDidReceiveMessage(
          async (message) => {
            switch (message.command) {
              case 'saveConfiguration':
                const copilotModelId = message.copilotModelId;
                const templateSource = message.templateSource;
                const diffSource = message.diffSource || 'staged';
                const commitCount = message.commitCount || 1;

                // Save all settings
                await config.update('copilotModelId', copilotModelId, vscode.ConfigurationTarget.Global);
                await config.update('templateSource', templateSource, vscode.ConfigurationTarget.Global);
                await config.update('diffSource', diffSource, vscode.ConfigurationTarget.Global);
                await config.update('commitCount', commitCount, vscode.ConfigurationTarget.Global);
                console.log(`Saved settings - model: ${copilotModelId}, template: ${templateSource}, diffSource: ${diffSource}, commitCount: ${commitCount}`);

                vscode.window.showInformationMessage('Configuration saved successfully');
                break;
                
              case 'saveCustomTemplate':
                // Save custom template to extension global state
                templateManager.saveCustomTemplate(message.template);
                // Update template source to 'custom'
                await config.update('templateSource', 'custom', vscode.ConfigurationTarget.Global);
                console.log('Saved custom template and set template source to custom');
                vscode.window.showInformationMessage('Custom template saved successfully');

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
          progress.report({ message: 'Calling GitHub Copilot...' });

          // Get configuration
          const config = vscode.workspace.getConfiguration('gitAIAssistant');
          const selectedModelId = config.get<string>('copilotModelId');

          // Check if a model is selected
          if (!selectedModelId) {
            vscode.window.showErrorMessage(
              'No Copilot model selected. Please configure a model in the extension settings.',
              'Configure'
            ).then(selection => {
              if (selection === 'Configure') {
                vscode.commands.executeCommand('git-ai-assistant.configureProvider');
              }
            });
            return Promise.resolve();
          }

          console.log('Using Copilot model:', selectedModelId);

          // Get the Copilot model
          const model = await CopilotAIService.getModelById(selectedModelId);

          if (!model) {
            vscode.window.showErrorMessage(
              'Selected Copilot model not available. Please ensure you have an active GitHub Copilot subscription and select a valid model.',
              'Configure'
            ).then(selection => {
              if (selection === 'Configure') {
                vscode.commands.executeCommand('git-ai-assistant.configureProvider');
              }
            });
            return Promise.resolve();
          }

          // Create Copilot AI service
          console.log('Creating Copilot AI service...');
          const aiService = new CopilotAIService(model);

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
    configureProvider: () => vscode.commands.executeCommand('git-ai-assistant.configureProvider'),
    generatePRDescription: () => vscode.commands.executeCommand('git-ai-assistant.generatePRDescription')
  };
}

/**
 * Tree item types for the sidebar view
 */
enum TreeItemType {
  Section = 'section',
  Action = 'action',
  ConfigItem = 'configItem',
  StatusItem = 'statusItem'
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

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    // Root level: Return section headers
    if (!element) {
      return Promise.resolve([
        new TreeItem(
          'ACTIONS',
          'Quick actions for generating content',
          vscode.TreeItemCollapsibleState.Expanded,
          TreeItemType.Section,
          undefined,
          'symbol-event'
        ),
        new TreeItem(
          'CONFIGURATION',
          'Current extension settings',
          vscode.TreeItemCollapsibleState.Expanded,
          TreeItemType.Section,
          undefined,
          'settings-gear'
        ),
        new TreeItem(
          'STATUS',
          'Extension and service status',
          vscode.TreeItemCollapsibleState.Collapsed,
          TreeItemType.Section,
          undefined,
          'info'
        )
      ]);
    }

    // Get configuration
    const config = vscode.workspace.getConfiguration('gitAIAssistant');

    // Return children based on section
    switch (element.label) {
      case 'ACTIONS':
        return this.getActionItems();

      case 'CONFIGURATION':
        return this.getConfigurationItems();

      case 'STATUS':
        return this.getStatusItems();

      default:
        return Promise.resolve([]);
    }
  }

  /**
   * Get action items (child nodes under ACTIONS section)
   */
  private async getActionItems(): Promise<TreeItem[]> {
    return [
      new TreeItem(
        'Generate PR Description',
        'Create a PR description from staged changes or recent commits',
        vscode.TreeItemCollapsibleState.None,
        TreeItemType.Action,
        {
          command: 'git-ai-assistant.generatePRDescription',
          title: 'Generate PR Description',
          arguments: []
        },
        'git-pull-request',
        'Click to generate'
      )
    ];
  }

  /**
   * Get configuration items (child nodes under CONFIGURATION section)
   */
  private async getConfigurationItems(): Promise<TreeItem[]> {
    const config = vscode.workspace.getConfiguration('gitAIAssistant');
    const copilotModelId = config.get<string>('copilotModelId', '');
    const templateSource = config.get<string>('templateSource', 'default');
    const diffSource = config.get<string>('diffSource', 'staged');
    const commitCount = config.get<number>('commitCount', 1);

    // Get model display name
    let modelDisplay = 'No model selected';
    if (copilotModelId) {
      try {
        const model = await CopilotAIService.getModelById(copilotModelId);
        if (model) {
          modelDisplay = model.name;
        } else {
          modelDisplay = 'Model not found';
        }
      } catch (error) {
        modelDisplay = 'Error loading model';
      }
    }

    // Format displays
    const templateDisplay = templateSource === 'custom' ? 'Custom' : 'Default';
    const sourceDisplay = diffSource === 'commits'
      ? `Recent commits (${commitCount})`
      : 'Staged changes';

    return [
      new TreeItem(
        `AI Model: ${modelDisplay}`,
        'Click to change the Copilot model',
        vscode.TreeItemCollapsibleState.None,
        TreeItemType.ConfigItem,
        {
          command: 'git-ai-assistant.configureProvider',
          title: 'Configure AI Model',
          arguments: []
        },
        'hubot',
        'Click to configure'
      ),
      new TreeItem(
        `Template: ${templateDisplay}`,
        'Click to edit or change the PR template',
        vscode.TreeItemCollapsibleState.None,
        TreeItemType.ConfigItem,
        {
          command: 'git-ai-assistant.configureProvider',
          title: 'Configure Template',
          arguments: []
        },
        'file-code',
        'Click to configure'
      ),
      new TreeItem(
        `Source: ${sourceDisplay}`,
        'Click to change diff source (staged changes or recent commits)',
        vscode.TreeItemCollapsibleState.None,
        TreeItemType.ConfigItem,
        {
          command: 'git-ai-assistant.configureProvider',
          title: 'Configure Source',
          arguments: []
        },
        'git-compare',
        'Click to configure'
      )
    ];
  }

  /**
   * Get status items (child nodes under STATUS section)
   */
  private async getStatusItems(): Promise<TreeItem[]> {
    const items: TreeItem[] = [];

    // Check Copilot availability
    try {
      const isAvailable = await CopilotAIService.isCopilotAvailable();

      if (isAvailable) {
        items.push(
          new TreeItem(
            'GitHub Copilot: Ready',
            'GitHub Copilot is available and ready to use',
            vscode.TreeItemCollapsibleState.None,
            TreeItemType.StatusItem,
            undefined,
            'pass',
            'Active subscription detected'
          )
        );
      } else {
        items.push(
          new TreeItem(
            'GitHub Copilot: Not Available',
            'GitHub Copilot subscription required',
            vscode.TreeItemCollapsibleState.None,
            TreeItemType.StatusItem,
            undefined,
            'error',
            'Click to learn more'
          )
        );
      }
    } catch (error) {
      items.push(
        new TreeItem(
          'GitHub Copilot: Unknown',
          'Unable to verify Copilot availability',
          vscode.TreeItemCollapsibleState.None,
          TreeItemType.StatusItem,
          undefined,
          'warning',
          'Check your connection'
        )
      );
    }

    // Add extension version
    const extensionVersion = extensionContext?.extension?.packageJSON?.version || 'Unknown';
    items.push(
      new TreeItem(
        `Version: ${extensionVersion}`,
        'Current extension version',
        vscode.TreeItemCollapsibleState.None,
        TreeItemType.StatusItem,
        undefined,
        'versions',
        ''
      )
    );

    return items;
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
    public readonly itemType: TreeItemType,
    public readonly command?: vscode.Command,
    iconName?: string,
    description?: string
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip;
    this.description = description;

    if (command) {
      this.command = command;
    }

    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }

    // Apply context value for conditional menu items (if needed in future)
    this.contextValue = itemType;
  }
}

/**
 * Get the HTML content for the unified AI provider configuration webview
 */
async function getProviderConfigWebviewContent(
  selectedModelId: string,
  templateSource: string,
  customTemplate: string,
  defaultTemplate: string
): Promise<string> {
  // Get current configuration
  const config = vscode.workspace.getConfiguration('gitAIAssistant');
  const diffSource = config.get<string>('diffSource', 'staged');
  const commitCount = config.get<number>('commitCount', 1);

  // Get available Copilot models
  let modelsDropdownOptions = '';
  try {
    const models = await CopilotAIService.listAvailableModels();

    if (models.length === 0) {
      modelsDropdownOptions = '<option value="">No Copilot models available</option>';
    } else {
      modelsDropdownOptions = models.map(model =>
        `<option value="${model.id}" ${selectedModelId === model.id ? 'selected' : ''}>${model.name} (${model.family})</option>`
      ).join('\n');
    }
  } catch (error) {
    console.error('Error loading Copilot models:', error);
    modelsDropdownOptions = '<option value="">Error loading models</option>';
  }

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Git AI Assistant Configuration</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
        }
        .config-section {
            margin-bottom: 30px;
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
        .help-text {
            margin-top: 8px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
        }
        .info-banner {
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            padding: 12px;
            margin-bottom: 20px;
            border-radius: 5px;
        }
    </style>
</head>
<body>
    <h1>Git AI Assistant Configuration</h1>

    <div class="info-banner">
        <strong>GitHub Copilot Required:</strong> This extension uses VS Code's built-in GitHub Copilot integration.
        Please ensure you have an active Copilot subscription.
    </div>

    <div class="config-section">
        <h2>Copilot Model Selection</h2>
        <div class="field">
            <label for="copilot-model-select">Select Copilot Model:</label>
            <select id="copilot-model-select">
                ${modelsDropdownOptions}
            </select>
            <div class="help-text">
                Select which GitHub Copilot model to use for generating PR descriptions.
            </div>
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
                const copilotModelId = document.getElementById('copilot-model-select').value;
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

                const config = {
                    command: 'saveConfiguration',
                    copilotModelId: copilotModelId,
                    templateSource: templateSource,
                    diffSource: diffSource,
                    commitCount: commitCount
                };

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
async function updateProviderConfigPanel() {
  if (!providerConfigPanel) {
    return;
  }

  const config = vscode.workspace.getConfiguration('gitAIAssistant');
  const copilotModelId = config.get<string>('copilotModelId', '');
  const templateSource = config.get<string>('templateSource', 'default');
  const defaultTemplate = config.get<string>('defaultTemplate', '');
  const customTemplate = templateManager.getCustomTemplate() || '';

  providerConfigPanel.webview.html = await getProviderConfigWebviewContent(
    copilotModelId,
    templateSource,
    customTemplate,
    defaultTemplate
  );
}

/**
 * Check if GitHub Copilot is available
 * Show error message if not available
 */
async function checkCopilotAvailability() {
  try {
    const isAvailable = await CopilotAIService.isCopilotAvailable();

    if (!isAvailable) {
      vscode.window.showErrorMessage(
        'GitHub Copilot is required to use Git AI Assistant. Please ensure you have an active GitHub Copilot subscription and that Copilot is enabled in VS Code.',
        'Learn More'
      ).then(selection => {
        if (selection === 'Learn More') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/features/copilot'));
        }
      });
    } else {
      console.log('GitHub Copilot is available');
    }
  } catch (error) {
    console.error('Error checking Copilot availability:', error);
    vscode.window.showWarningMessage(
      'Unable to verify GitHub Copilot availability. Some features may not work correctly.'
    );
  }
}

/**
 * Webview view provider for the SCM panel
 */
class SCMWebviewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'generatePR':
          vscode.commands.executeCommand('git-ai-assistant.generatePRDescription');
          break;
        case 'configure':
          vscode.commands.executeCommand('git-ai-assistant.configureProvider');
          break;
      }
    });

    // Update content when configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('gitAIAssistant')) {
        webviewView.webview.html = this.getHtmlContent(webviewView.webview);
      }
    });
  }

  private getHtmlContent(webview: vscode.Webview): string {
    // Get current configuration
    const config = vscode.workspace.getConfiguration('gitAIAssistant');
    const copilotModelId = config.get<string>('copilotModelId', '');
    const diffSource = config.get<string>('diffSource', 'staged');
    const commitCount = config.get<number>('commitCount', 1);

    let sourceText = diffSource === 'staged' ? 'Staged changes' : `Last ${commitCount} commit(s)`;

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Git AI Assistant</title>
        <style>
            @font-face {
                font-family: 'codicon';
                src: url('${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.ttf'))}') format('truetype');
            }

            .codicon {
                font-family: 'codicon';
                font-size: 16px;
                font-weight: normal;
                font-style: normal;
            }

            body {
                padding: 12px 16px;
                margin: 0;
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
            }

            .button-primary {
                width: 100%;
                padding: 8px 14px;
                background-color: #16825d;
                color: #ffffff;
                border: none;
                border-radius: 2px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                transition: background-color 0.1s ease;
            }

            .button-primary:hover {
                background-color: #0e6245;
            }

            .button-primary:active {
                transform: translateY(1px);
            }

            .button-secondary {
                width: 100%;
                padding: 6px 14px;
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border: none;
                border-radius: 2px;
                cursor: pointer;
                font-size: 12px;
                text-align: center;
                margin-top: 8px;
                transition: background-color 0.1s ease;
            }

            .button-secondary:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }

            .info-section {
                margin-top: 12px;
                padding: 8px;
                background-color: var(--vscode-textBlockQuote-background);
                border-left: 3px solid var(--vscode-textBlockQuote-border);
                font-size: 11px;
                color: var(--vscode-descriptionForeground);
            }

            .info-row {
                display: flex;
                justify-content: space-between;
                margin: 4px 0;
            }

            .info-label {
                font-weight: 500;
            }

            .icon {
                display: inline-block;
                width: 16px;
                height: 16px;
            }
        </style>
    </head>
    <body>
        <button class="button-primary" id="generateBtn" title="Generate PR description using AI">
            <span class="codicon">&#xea64;</span>
            <span>Generate PR Description</span>
        </button>

        <button class="button-secondary" id="configureBtn" title="Configure AI model and template">
            Configure Settings
        </button>

        <div class="info-section">
            <div class="info-row">
                <span class="info-label">Source:</span>
                <span>${sourceText}</span>
            </div>
            ${copilotModelId ? `
            <div class="info-row">
                <span class="info-label">AI Model:</span>
                <span>Configured ✓</span>
            </div>
            ` : `
            <div class="info-row">
                <span class="info-label">AI Model:</span>
                <span style="color: var(--vscode-errorForeground);">Not configured</span>
            </div>
            `}
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            document.getElementById('generateBtn').addEventListener('click', () => {
                vscode.postMessage({ command: 'generatePR' });
            });

            document.getElementById('configureBtn').addEventListener('click', () => {
                vscode.postMessage({ command: 'configure' });
            });
        </script>
    </body>
    </html>`;
  }
}

/**
 * Material Design webview view provider for the main sidebar
 */
class GitAIAssistantWebviewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = await this.getHtmlContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'generatePR':
          vscode.commands.executeCommand('git-ai-assistant.generatePRDescription');
          break;
        case 'configure':
          vscode.commands.executeCommand('git-ai-assistant.configureProvider');
          break;
        case 'refresh':
          webviewView.webview.html = await this.getHtmlContent(webviewView.webview);
          break;
      }
    });

    // Update content when configuration changes
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('gitAIAssistant')) {
        webviewView.webview.html = await this.getHtmlContent(webviewView.webview);
      }
    });
  }

  private async getHtmlContent(webview: vscode.Webview): Promise<string> {
    // Get current configuration
    const config = vscode.workspace.getConfiguration('gitAIAssistant');
    const copilotModelId = config.get<string>('copilotModelId', '');
    const templateSource = config.get<string>('templateSource', 'default');
    const diffSource = config.get<string>('diffSource', 'staged');
    const commitCount = config.get<number>('commitCount', 1);

    // Get model display name
    let modelDisplay = 'Not configured';
    let modelStatus = 'error';
    if (copilotModelId) {
      try {
        const model = await CopilotAIService.getModelById(copilotModelId);
        if (model) {
          modelDisplay = model.name;
          modelStatus = 'success';
        }
      } catch (error) {
        modelDisplay = 'Error loading model';
        modelStatus = 'warning';
      }
    }

    // Check Copilot availability
    let copilotStatus = 'Unknown';
    let copilotStatusClass = 'warning';
    try {
      const isAvailable = await CopilotAIService.isCopilotAvailable();
      if (isAvailable) {
        copilotStatus = 'Ready';
        copilotStatusClass = 'success';
      } else {
        copilotStatus = 'Not Available';
        copilotStatusClass = 'error';
      }
    } catch (error) {
      copilotStatus = 'Unknown';
      copilotStatusClass = 'warning';
    }

    const templateDisplay = templateSource === 'custom' ? 'Custom' : 'Default';
    const sourceDisplay = diffSource === 'staged' ? 'Staged Changes' : `Last ${commitCount} commit(s)`;
    const extensionVersion = extensionContext?.extension?.packageJSON?.version || 'Unknown';

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Git AI Assistant</title>
        <style>
            @font-face {
                font-family: 'codicon';
                src: url('${webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.ttf'))}') format('truetype');
            }

            .codicon {
                font-family: 'codicon';
                font-size: 16px;
                font-weight: normal;
                font-style: normal;
                line-height: 1;
            }

            .codicon-git-pull-request:before { content: "\\ea64"; }
            .codicon-hubot:before { content: "\\ea8c"; }
            .codicon-file-code:before { content: "\\ead9"; }
            .codicon-git-compare:before { content: "\\eb29"; }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                padding: 16px;
                margin: 0;
                font-family: var(--vscode-font-family);
                color: var(--vscode-foreground);
                background-color: var(--vscode-sideBar-background);
                font-size: 13px;
            }

            .container {
                display: flex;
                flex-direction: column;
                gap: 24px;
            }

            /* Section Headers */
            .section-header {
                font-size: 11px;
                font-weight: 600;
                color: var(--vscode-foreground);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 12px;
                opacity: 0.7;
            }

            /* Cards */
            .card {
                background-color: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                padding: 16px;
                transition: box-shadow 0.2s ease;
            }

            .card:hover {
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }

            .card-content {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .card-header {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 4px;
            }

            .card-icon {
                width: 20px;
                height: 20px;
                flex-shrink: 0;
                color: var(--vscode-foreground);
            }

            .card-title {
                font-size: 14px;
                font-weight: 500;
                color: var(--vscode-foreground);
            }

            .card-description {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                line-height: 1.5;
                margin-bottom: 8px;
            }

            /* Buttons */
            .button {
                width: 100%;
                padding: 10px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: all 0.2s ease;
                font-family: var(--vscode-font-family);
            }

            .button-primary {
                background-color: #16825d;
                color: #ffffff;
                height: 40px;
            }

            .button-primary:hover {
                background-color: #0e6245;
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }

            .button-primary:active {
                transform: translateY(0);
            }

            .button-outlined {
                background-color: transparent;
                color: var(--vscode-button-secondaryForeground);
                border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
                height: 36px;
            }

            .button-outlined:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }

            /* List Items */
            .list-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 0;
            }

            .list-item-icon {
                width: 16px;
                height: 16px;
                flex-shrink: 0;
                color: var(--vscode-foreground);
                opacity: 0.8;
            }

            .list-item-content {
                flex: 1;
                min-width: 0;
            }

            .list-item-label {
                font-size: 12px;
                font-weight: 500;
                color: var(--vscode-foreground);
            }

            .list-item-value {
                font-size: 12px;
                color: var(--vscode-descriptionForeground);
                margin-top: 2px;
            }

            /* Status Chips */
            .status-chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 500;
                white-space: nowrap;
            }

            .status-chip.success {
                background-color: rgba(40, 167, 69, 0.15);
                color: #28a745;
            }

            .status-chip.error {
                background-color: rgba(220, 53, 69, 0.15);
                color: #dc3545;
            }

            .status-chip.warning {
                background-color: rgba(255, 193, 7, 0.15);
                color: #ffc107;
            }

            .status-indicator {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                display: inline-block;
            }

            .status-indicator.success {
                background-color: #28a745;
            }

            .status-indicator.error {
                background-color: #dc3545;
            }

            .status-indicator.warning {
                background-color: #ffc107;
            }

            /* Divider */
            .divider {
                height: 1px;
                background-color: var(--vscode-panel-border);
                margin: 8px 0;
            }

            /* Config Grid */
            .config-grid {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

            .config-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background-color: var(--vscode-input-background);
                border-radius: 4px;
                font-size: 12px;
            }

            .config-label {
                color: var(--vscode-foreground);
                font-weight: 500;
            }

            .config-value {
                color: var(--vscode-descriptionForeground);
                text-align: right;
            }

            /* Status List */
            .status-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .status-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 8px;
                font-size: 12px;
            }

            .status-label {
                color: var(--vscode-foreground);
            }

            .status-value {
                margin-left: auto;
                color: var(--vscode-descriptionForeground);
                font-size: 11px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- Quick Actions Section -->
            <section>
                <div class="section-header">QUICK ACTIONS</div>
                <div class="card">
                    <div class="card-content">
                        <div class="card-header">
                            <i class="codicon codicon-git-pull-request card-icon"></i>
                            <div class="card-title">Generate PR Description</div>
                        </div>
                        <div class="card-description">
                            Create AI-powered pull request descriptions from your changes
                        </div>
                        <button class="button button-primary" id="generateBtn">
                            <i class="codicon codicon-git-pull-request"></i>
                            <span>Generate</span>
                        </button>
                    </div>
                </div>
            </section>

            <!-- Configuration Section -->
            <section>
                <div class="section-header">CONFIGURATION</div>
                <div class="card">
                    <div class="card-content">
                        <div class="list-item">
                            <i class="codicon codicon-hubot list-item-icon"></i>
                            <div class="list-item-content">
                                <div class="list-item-label">AI Model</div>
                                <div class="list-item-value">${modelDisplay}</div>
                            </div>
                            <span class="status-chip ${modelStatus}">
                                <span class="status-indicator ${modelStatus}"></span>
                                ${modelStatus === 'success' ? 'Ready' : modelStatus === 'error' ? 'Not Set' : 'Warning'}
                            </span>
                        </div>

                        <div class="divider"></div>

                        <div class="config-grid">
                            <div class="config-item">
                                <span class="config-label">📄 Template</span>
                                <span class="config-value">${templateDisplay}</span>
                            </div>
                            <div class="config-item">
                                <span class="config-label">📊 Source</span>
                                <span class="config-value">${sourceDisplay}</span>
                            </div>
                        </div>

                        <button class="button button-outlined" id="configureBtn">
                            Configure Settings
                        </button>
                    </div>
                </div>
            </section>

            <!-- Status Section -->
            <section>
                <div class="section-header">SERVICE STATUS</div>
                <div class="card">
                    <div class="card-content">
                        <div class="status-list">
                            <div class="status-item">
                                <span class="status-indicator ${copilotStatusClass}"></span>
                                <span class="status-label">GitHub Copilot</span>
                                <span class="status-value">${copilotStatus}</span>
                            </div>
                            <div class="status-item">
                                <span class="status-indicator success"></span>
                                <span class="status-label">Extension</span>
                                <span class="status-value">v${extensionVersion}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            document.getElementById('generateBtn').addEventListener('click', () => {
                vscode.postMessage({ command: 'generatePR' });
            });

            document.getElementById('configureBtn').addEventListener('click', () => {
                vscode.postMessage({ command: 'configure' });
            });
        </script>
    </body>
    </html>`;
  }
}

/**
 * This method is called when the extension is deactivated
 */
export function deactivate() {
  if (providerConfigPanel) {
    providerConfigPanel.dispose();
  }
} 