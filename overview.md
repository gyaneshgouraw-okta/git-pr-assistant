# VS Code Extension Development Overview

A comprehensive guide to understanding VS Code extension development patterns using Git AI Assistant as a practical example.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Extension Lifecycle](#extension-lifecycle)
3. [Key Building Blocks](#key-building-blocks)
4. [Common VS Code APIs](#common-vs-code-apis)
5. [Extension Development Workflow](#extension-development-workflow)
6. [Key Patterns in This Extension](#key-patterns-in-this-extension)
7. [Testing Extensions](#testing-extensions)
8. [Debugging](#debugging)
9. [Publishing](#publishing)
10. [Quick Start Checklist](#quick-start-checklist)
11. [Resources](#resources)

---

## Core Concepts

### The Extension Manifest (`package.json`)

This is your extension's blueprint. It defines:

```json
{
  "name": "git-ai-assistant",                    // Unique identifier
  "displayName": "Git AI Assistant",             // User-facing name
  "main": "./dist/extension.js",                 // Entry point
  "engines": { "vscode": "^1.60.0" },           // VS Code version compatibility
  "activationEvents": ["onStartupFinished"],     // When to load your extension
  "contributes": { ... }                         // What your extension adds to VS Code
}
```

**Location in this repo**: `package.json:1-226`

### The Contribution Points (`contributes`)

This tells VS Code what features your extension provides:

#### Commands - Actions users can trigger

```json
"commands": [
  {
    "command": "git-ai-assistant.generatePRDescription",
    "title": "Generate PR Description and Commit Message"
  }
]
```

**Location in this repo**: `package.json:42-63`

#### Views - Custom UI panels/sidebars

```json
"viewsContainers": {
  "activitybar": [{
    "id": "git-ai-assistant",
    "title": "Git AI Assistant",
    "icon": "resources/sidebar-icon.svg"
  }]
}
```

**Location in this repo**: `package.json:19-34`

#### Configuration - User settings

```json
"configuration": {
  "properties": {
    "gitAIAssistant.modelProvider": {
      "type": "string",
      "enum": ["aws-bedrock", "google-gemini"],
      "default": "google-gemini"
    }
  }
}
```

**Location in this repo**: `package.json:95-164`

---

## Extension Lifecycle

### Activation

The entry point of every VS Code extension:

```typescript
export function activate(context: vscode.ExtensionContext) {
  // 1. Register commands
  const disposable = vscode.commands.registerCommand(
    'git-ai-assistant.generatePRDescription',
    async () => {
      // Command implementation
    }
  );

  // 2. Add to subscriptions (for cleanup)
  context.subscriptions.push(disposable);

  // 3. Register tree data providers (for sidebar)
  const treeDataProvider = new GitAIAssistantProvider();
  vscode.window.registerTreeDataProvider('gitAIAssistantPanel', treeDataProvider);
}
```

**Location in this repo**: `src/extension.ts:21-78`

The `context` object provides:
- **subscriptions**: Array for disposables (cleanup on deactivation)
- **globalState**: Persistent storage across VS Code sessions
- **workspaceState**: Storage specific to current workspace
- **extensionPath**: Path to your extension files

### Deactivation

Cleanup resources when the extension is unloaded:

```typescript
export function deactivate() {
  // Cleanup resources if needed
}
```

**Location in this repo**: `src/extension.ts:1174`

---

## Key Building Blocks

### A. Commands

Commands are the primary way users interact with extensions.

#### Registration

```typescript
vscode.commands.registerCommand('extension.commandName', async () => {
  // Your logic here
  vscode.window.showInformationMessage('Hello!');
});
```

**Invocation methods:**
- Command Palette (Ctrl+Shift+P)
- Keyboard shortcuts
- Buttons in UI
- Programmatically: `vscode.commands.executeCommand('extension.commandName')`

**In this repo**: `src/extension.ts:15-80` - Multiple commands registered

---

### B. Tree Views (Sidebar Panels)

Custom views in the sidebar using TreeDataProvider pattern.

#### Implementation

```typescript
class GitAIAssistantProvider implements vscode.TreeDataProvider<TreeItem> {
  // Required: Return tree items
  getChildren(element?: TreeItem): TreeItem[] {
    return [
      new TreeItem('Generate PR Description', 'git-ai-assistant.generatePRDescription'),
      new TreeItem('Configure Settings', 'git-ai-assistant.configureProvider')
    ];
  }

  // Required: Describe how to display each item
  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  // Optional: Refresh tree when data changes
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}
```

**In this repo**: `src/extension.ts:85-150` - TreeDataProvider implementation

**Key Concepts:**
- **TreeDataProvider**: Interface that defines how to build the tree structure
- **getChildren()**: Returns child items for a given element (or root items if element is undefined)
- **getTreeItem()**: Returns display properties for each item
- **EventEmitter**: Used to notify VS Code when tree data changes

---

### C. Webviews

Custom HTML/CSS/JS panels for rich UI experiences.

#### Creating a Webview

```typescript
const panel = vscode.window.createWebviewPanel(
  'myWebview',                              // Identifier
  'My Panel',                               // Title
  vscode.ViewColumn.One,                    // Editor column
  {
    enableScripts: true,                    // Allow JavaScript
    retainContextWhenHidden: true          // Keep state when hidden
  }
);

// Set HTML content
panel.webview.html = getWebviewContent();
```

#### Two-way Communication

**Extension → Webview:**
```typescript
panel.webview.postMessage({ command: 'update', data: {...} });
```

**Webview → Extension:**
```typescript
panel.webview.onDidReceiveMessage(message => {
  switch (message.command) {
    case 'saveSettings':
      // Handle message from webview
      break;
  }
});
```

**In the webview HTML:**
```javascript
const vscode = acquireVsCodeApi();

// Send to extension
vscode.postMessage({ command: 'saveSettings', data: {...} });

// Receive from extension
window.addEventListener('message', event => {
  const message = event.data;
  // Handle message
});
```

**In this repo**: `src/extension.ts:153-850` - Three webview panels with full communication

**Webview Security:**
- Webviews run in isolated contexts
- Use Content Security Policy (CSP) to restrict what content can be loaded
- Never trust data from webviews - always validate

---

### D. Configuration (Settings)

#### Reading settings

```typescript
const config = vscode.workspace.getConfiguration('gitAIAssistant');
const provider = config.get<string>('modelProvider');
```

#### Writing settings

```typescript
await config.update(
  'modelProvider',
  'google-gemini',
  vscode.ConfigurationTarget.Global  // or Workspace, WorkspaceFolder
);
```

**Configuration Targets:**
- **Global**: User settings (applies to all workspaces)
- **Workspace**: Workspace settings (applies to current workspace only)
- **WorkspaceFolder**: Folder settings (for multi-root workspaces)

#### Watching for changes

```typescript
vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('gitAIAssistant.modelProvider')) {
    // React to config change
  }
});
```

**In this repo**:
- Configuration read throughout `src/extension.ts`
- Written in webview message handlers: `src/extension.ts:122-145`

---

## Common VS Code APIs

### Window API

```typescript
// Show messages
vscode.window.showInformationMessage('Success!');
vscode.window.showWarningMessage('Warning!');
vscode.window.showErrorMessage('Error!');

// Show input boxes
const input = await vscode.window.showInputBox({
  prompt: 'Enter value',
  placeHolder: 'placeholder text'
});

// Show quick pick
const choice = await vscode.window.showQuickPick(['Option 1', 'Option 2']);

// Open documents
const doc = await vscode.workspace.openTextDocument({
  content: 'File content',
  language: 'markdown'
});
await vscode.window.showTextDocument(doc);
```

**In this repo**: `src/extension.ts:30-45` - Shows errors and opens generated PR in editor

---

### Workspace API

```typescript
// Get workspace folders
const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

// Read/write files
const fileUri = vscode.Uri.file('/path/to/file');
const content = await vscode.workspace.fs.readFile(fileUri);
await vscode.workspace.fs.writeFile(fileUri, Buffer.from('content'));

// Find files
const files = await vscode.workspace.findFiles('**/*.ts', '**/node_modules/**');
```

**In this repo**: `src/gitDiffReader.ts:15-30` - Uses workspace folder for git operations

---

### Terminal API

```typescript
// Execute shell commands
const terminal = vscode.window.createTerminal('My Terminal');
terminal.show();
terminal.sendText('npm install');
```

**Alternative Approach**: Use Node.js `child_process` to execute commands programmatically:

```typescript
import * as cp from 'child_process';

function executeCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}
```

**In this repo**: `src/gitDiffReader.ts` uses `child_process.exec` for git commands

---

## Extension Development Workflow

### Project Structure

```
my-extension/
├── src/
│   └── extension.ts          // Main entry point
├── package.json              // Extension manifest
├── tsconfig.json             // TypeScript config
├── .vscodeignore            // Files to exclude from package
└── README.md                // User documentation
```

### Development Commands

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile)
npm run watch

# Run extension in debug mode
# Press F5 in VS Code (launches Extension Development Host)

# Package extension
npm run package  # Creates .vsix file

# Publish to marketplace
npm run publish
```

**In this repo**: Check `package.json:167-188` for all available scripts

### Build Configuration

This extension uses **Webpack** for bundling:

**webpack.config.js**:
```javascript
module.exports = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode'  // Don't bundle VS Code API
  }
};
```

**In this repo**: `webpack.config.js:1-66`

---

## Key Patterns in This Extension

### Pattern 1: Factory Pattern for Extensibility

```typescript
// aiService.ts - Easy to add new AI providers
class AIServiceFactory {
  static createService(provider: string, config: any): AIProvider {
    switch (provider) {
      case 'aws-bedrock':
        return new AWSBedrockService(config);
      case 'google-gemini':
        return new GoogleGeminiService(config);
      default:
        throw new Error('Unknown provider');
    }
  }
}
```

**Location**: `src/aiService.ts:227-252`

**Benefits:**
- Easy to add new AI providers
- Centralized creation logic
- Type-safe provider selection

---

### Pattern 2: Separation of Concerns

The extension is organized into distinct modules:

| Module | Responsibility | Location |
|--------|---------------|----------|
| **extension.ts** | UI and orchestration | `src/extension.ts:1-1174` |
| **aiService.ts** | AI logic | `src/aiService.ts:1-252` |
| **gitDiffReader.ts** | Git operations | `src/gitDiffReader.ts:1-192` |
| **templateManager.ts** | Template logic | `src/templateManager.ts:1-138` |

This makes testing and maintenance easier.

---

### Pattern 3: Global State Management

```typescript
// Store webview panel references to prevent duplicates
let providerConfigPanel: vscode.WebviewPanel | undefined;

if (providerConfigPanel) {
  providerConfigPanel.reveal();  // Show existing panel
} else {
  providerConfigPanel = vscode.window.createWebviewPanel(...);
}
```

**Location**: `src/extension.ts:82-108`

**Benefits:**
- Prevents duplicate panels
- Enables panel reuse
- Better user experience

---

### Pattern 4: Abstract Base Class

```typescript
abstract class BaseAIService implements AIProvider {
  abstract generatePRDescription(gitDiff: string, template: string): Promise<string>;

  protected createPrompt(gitDiff: string, template: string): string {
    // Shared prompt creation logic
  }
}
```

**Location**: `src/aiService.ts:16-53`

**Benefits:**
- Shared functionality across providers
- Consistent prompt engineering
- DRY (Don't Repeat Yourself) principle

---

### Pattern 5: Strategy Pattern

Different AI providers can be swapped at runtime:

```typescript
const modelProvider = config.get<string>('modelProvider');
let aiService: AIProvider;

if (modelProvider === 'aws-bedrock') {
  aiService = AIServiceFactory.createService('aws-bedrock', {...});
} else if (modelProvider === 'google-gemini') {
  aiService = AIServiceFactory.createService('google-gemini', {...});
}

// Use the service (same interface regardless of provider)
const description = await aiService.generatePRDescription(diff, template);
```

**Location**: `src/extension.ts:422-463`

---

## Testing Extensions

### Unit Testing

```typescript
import * as vscode from 'vscode';
import * as assert from 'assert';

suite('Extension Test Suite', () => {
  test('Command is registered', async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes('git-ai-assistant.generatePRDescription'));
  });
});
```

**In this repo**: `src/test/suite/` - Full test suite with mocks

### Test Configuration

**`.mocharc.json`**:
```json
{
  "require": ["ts-node/register"],
  "extensions": ["ts"],
  "spec": ["src/test/suite/**/*.test.ts"]
}
```

**In this repo**: `.mocharc.json:1-8`

### Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npx mocha --require ts-node/register src/test/suite/aiService.test.ts
```

---

## Debugging

### Launch Configuration (`.vscode/launch.json`)

```json
{
  "type": "extensionHost",
  "request": "launch",
  "name": "Run Extension",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
}
```

Press **F5** → Opens new VS Code window with your extension loaded

### Debugging Tips

1. **Use Console Logs**: Add strategic logging throughout your code
2. **Check Developer Tools**: Help > Toggle Developer Tools
3. **Breakpoints**: Set breakpoints in your TypeScript code
4. **Watch Variables**: Use VS Code's debug panel to inspect variables

**In this repo**: Look for `console.log()` statements throughout the codebase for debugging examples

---

## Publishing

### Prerequisites

1. Create a [Visual Studio Marketplace publisher account](https://marketplace.visualstudio.com/manage)
2. Get a Personal Access Token (PAT) from Azure DevOps

### Publishing Steps

```bash
# Install publishing tool
npm install -g @vscode/vsce

# Login to publisher account
vsce login <publisher-name>

# Package
vsce package  # Creates .vsix file

# Publish to marketplace
vsce publish
```

**In this repo**: `package.json:221` - Publisher: "gyaneshgouraw"

### `.vscodeignore`

Specify files to exclude from the published package:

```
.vscode/**
.git/**
src/**
node_modules/**
*.vsix
```

**In this repo**: `.vscodeignore:1-9`

---

## Quick Start Checklist

To create a VS Code extension:

1. ✅ **Install Yeoman generator**: `npm install -g yo generator-code`
2. ✅ **Scaffold project**: `yo code`
3. ✅ **Define contributions** in `package.json`
4. ✅ **Implement `activate()`** in `extension.ts`
5. ✅ **Register commands/views/providers**
6. ✅ **Test with F5** (Extension Development Host)
7. ✅ **Package**: `vsce package`
8. ✅ **Publish**: `vsce publish`

---

## Key Concepts Summary

| Concept | Purpose | Example in This Repo |
|---------|---------|---------------------|
| **Commands** | User-invokable actions | Generate PR Description |
| **Tree Views** | Custom sidebar panels | Git AI Assistant sidebar |
| **Webviews** | Rich HTML UI | Configuration panels |
| **Configuration** | User settings | AI provider selection |
| **Context** | Extension lifecycle management | Subscriptions, state |
| **Activation Events** | When to load extension | `onStartupFinished` |

---

## Extension Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│              VS Code Extension API                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  Commands    │  │  Tree Views  │  │ Webviews │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │         Configuration & State                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │      Your Business Logic (Services)           │  │
│  │  ┌────────┐  ┌────────┐  ┌────────────────┐  │  │
│  │  │ AI     │  │  Git   │  │   Templates    │  │  │
│  │  │Service │  │ Diff   │  │    Manager     │  │  │
│  │  └────────┘  └────────┘  └────────────────┘  │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api/references/vscode-api) - Official API reference
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview) - Comprehensive guides
- [Extension Samples](https://github.com/microsoft/vscode-extension-samples) - Official examples
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) - Marketplace guide
- [UX Guidelines](https://code.visualstudio.com/api/ux-guidelines/overview) - Best practices for extension UI

---

## Next Steps

After understanding these concepts:

1. **Explore the codebase**: Read through `src/extension.ts` to see how everything connects
2. **Try modifying**: Make small changes and test with F5
3. **Read AGENTS.md**: Learn how to add new AI providers to this specific extension
4. **Build your own**: Use `yo code` to scaffold your own extension

---

**Last Updated**: January 2025
**Related Guides**: See [AGENTS.md](./AGENTS.md) for detailed AI provider integration guide
