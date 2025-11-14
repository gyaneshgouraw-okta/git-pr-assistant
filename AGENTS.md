# AI Agents Architecture Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [Adding a New AI Model Provider](#adding-a-new-ai-model-provider)
4. [Practical Example: Adding OpenAI GPT](#practical-example-adding-openai-gpt)
5. [Local Development & Testing](#local-development--testing)
6. [Code Reference](#code-reference)

---

## Overview

Git AI Assistant is a VS Code extension that leverages AI to automatically generate Pull Request descriptions and commit messages. The extension is designed with a modular, extensible architecture that makes it easy to add new AI providers.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      VS Code Extension                       │
│                     (extension.ts)                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │   Webview   │  │  Git Diff      │  │   Template      │  │
│  │     UI      │  │   Reader       │  │   Manager       │  │
│  └─────────────┘  └────────────────┘  └─────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │      AIServiceFactory                 │
        │      (Factory Pattern)                │
        └───────────────────┬───────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
    ┌───────────────┐              ┌──────────────────┐
    │ AWSBedrock    │              │ GoogleGemini     │
    │   Service     │              │    Service       │
    └───────────────┘              └──────────────────┘
            │                               │
            ▼                               ▼
    ┌───────────────┐              ┌──────────────────┐
    │ Vercel AI SDK │              │  Vercel AI SDK   │
    │  + AWS SDK    │              │  + Google API    │
    └───────────────┘              └──────────────────┘
```

### Key Design Patterns

1. **Interface-Based Design**: All AI providers implement the `AIProvider` interface
2. **Factory Pattern**: `AIServiceFactory` creates appropriate service instances
3. **Template Method**: `BaseAIService` provides common functionality through inheritance
4. **Strategy Pattern**: Different AI providers can be swapped at runtime

---

## Architecture Deep Dive

### 1. AIProvider Interface

The foundation of the AI service layer is the `AIProvider` interface:

```typescript
export interface AIProvider {
  generatePRDescription(gitDiff: string, template: string): Promise<string>;
}
```

**Location**: `src/aiService.ts:9-11`

**Purpose**: Defines the contract that all AI providers must implement. This ensures consistent behavior across different AI services.

### 2. BaseAIService Abstract Class

The `BaseAIService` provides common functionality for all AI providers:

```typescript
abstract class BaseAIService implements AIProvider {
  abstract generatePRDescription(gitDiff: string, template: string): Promise<string>;

  protected createPrompt(gitDiff: string, template: string): string {
    // Creates standardized prompt for AI models
  }
}
```

**Location**: `src/aiService.ts:16-53`

**Key Features**:
- **Prompt Engineering**: The `createPrompt` method creates a standardized prompt that:
  - Instructs the AI to generate PR descriptions
  - Provides the git diff in a code block
  - Supplies the template structure
  - Sets clear expectations about format and content

**Prompt Structure**:
```
I need you to create a pull request description based on the following git diff.
Use the template provided below to structure your response.

GIT DIFF:
```
[git diff content]
```

TEMPLATE:
```
[template content]
```

Please fill in the template with details about the changes...
```

### 3. Current Implementations

#### AWS Bedrock Service

**Location**: `src/aiService.ts:58-146`

**Key Features**:
- Uses AWS Bedrock with Claude 3.5 Sonnet model
- Supports AWS credentials (Access Key, Secret Key, Region, Session Token)
- Implements retry logic with multiple model versions
- Sets environment variables for AWS SDK authentication

**Configuration Required**:
```typescript
{
  region: string,           // AWS region (e.g., 'us-east-1')
  accessKeyId: string,      // AWS Access Key ID
  secretAccessKey: string,  // AWS Secret Access Key
  sessionToken?: string     // Optional session token
}
```

**Model Configuration**:
```typescript
private readonly CLAUDE_MODELS = [
  'anthropic.claude-3-5-sonnet-20241022-v2:0',
];
```

**AI Parameters**:
- Temperature: `0.5` (more deterministic)
- Top P: `0.9`
- Max Tokens: `2000`

#### Google Gemini Service

**Location**: `src/aiService.ts:151-222`

**Key Features**:
- Supports three Gemini models (2.0 Flash, 1.5 Flash, 1.5 Flash 8B)
- Model validation with fallback to default
- Simple API key authentication

**Configuration Required**:
```typescript
{
  apiKey: string,           // Google API Key
  modelId?: string          // Optional model selection
}
```

**Supported Models**:
```typescript
private static readonly SUPPORTED_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',      // Default
  'gemini-1.5-flash-8b'
];
```

**AI Parameters**:
- Temperature: `0.7` (more creative than AWS)
- Top P: `0.9`
- Max Tokens: `2000`

### 4. AIServiceFactory

**Location**: `src/aiService.ts:227-252`

The factory class creates appropriate AI service instances:

```typescript
export class AIServiceFactory {
  static createService(
    provider: 'aws-bedrock' | 'google-gemini',
    config: any
  ): AIProvider {
    switch (provider) {
      case 'aws-bedrock':
        return new AWSBedrockService(
          config.region,
          config.accessKeyId,
          config.secretAccessKey,
          config.sessionToken
        );
      case 'google-gemini':
        return new GoogleGeminiService(config.apiKey, config.modelId);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }
}
```

**Usage Pattern** (from `src/extension.ts:422-463`):
```typescript
const config = vscode.workspace.getConfiguration('gitAIAssistant');
const modelProvider = config.get<string>('modelProvider') || 'google-gemini';

let aiService;
if (modelProvider === 'aws-bedrock') {
  aiService = AIServiceFactory.createService('aws-bedrock', {
    region: config.get('awsRegion'),
    accessKeyId: config.get('awsAccessKeyId'),
    secretAccessKey: config.get('awsSecretAccessKey'),
    sessionToken: config.get('awsSessionToken')
  });
}

const description = await aiService.generatePRDescription(diff, template);
```

---

## Adding a New AI Model Provider

This section provides a complete, step-by-step guide for adding a new AI provider to the extension.

### Prerequisites

Before you begin, ensure you have:
1. Node.js and npm installed
2. VS Code and the extension development environment set up
3. Access to the AI provider's API
4. API credentials for the provider
5. Familiarity with TypeScript

### Implementation Checklist

- [ ] Step 1: Install required dependencies
- [ ] Step 2: Create the service class
- [ ] Step 3: Update the factory
- [ ] Step 4: Add configuration properties
- [ ] Step 5: Update the UI
- [ ] Step 6: Test the implementation
- [ ] Step 7: Update documentation

### Step-by-Step Implementation

#### Step 1: Install Required Dependencies

First, identify and install the necessary npm packages for your AI provider.

```bash
# Example: For OpenAI
npm install openai --save

# If using Vercel AI SDK (recommended)
npm install @ai-sdk/openai --save
```

**Why**: You need the official SDK or API client library to communicate with the AI provider's API.

#### Step 2: Create the Service Class

Add your new service class to `src/aiService.ts`.

**Template**:
```typescript
/**
 * [Provider Name] implementation of the AI service
 */
export class YourProviderService extends BaseAIService {
  private apiKey: string;
  private modelId: string;

  // Define supported models
  private static readonly SUPPORTED_MODELS = [
    'model-1',
    'model-2',
  ];

  /**
   * Create a new [Provider Name] Service
   * @param apiKey API key for authentication
   * @param modelId Model ID (optional, defaults to model-1)
   */
  constructor(apiKey: string, modelId: string = 'model-1') {
    super();
    this.apiKey = apiKey;
    this.modelId = modelId;

    // Optional: Validate model ID
    if (!YourProviderService.SUPPORTED_MODELS.includes(modelId)) {
      console.warn(`Unsupported model: ${modelId}. Falling back to model-1`);
      this.modelId = 'model-1';
    }
  }

  /**
   * Generate a PR description using [Provider Name]
   * @param gitDiff The git diff to describe
   * @param template The PR template to use
   * @returns The generated PR description
   */
  async generatePRDescription(gitDiff: string, template: string): Promise<string> {
    // Set environment variables if needed
    process.env.YOUR_PROVIDER_API_KEY = this.apiKey;

    // Create the prompt using the base class method
    const prompt = this.createPrompt(gitDiff, template);

    try {
      console.log(`Generating PR description with [Provider]: ${this.modelId}`);

      // Use Vercel AI SDK (recommended approach)
      const result = await ai.generateText({
        model: yourProvider(this.modelId),
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that writes clear, concise pull request descriptions based on git diffs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2000
      });

      return result.text.trim();
    } catch (error) {
      console.error(`Error with [Provider] model ${this.modelId}:`, error);
      throw new Error(`Failed to generate PR description: ${(error as Error).message}`);
    }
  }
}
```

**Key Points**:
- Extend `BaseAIService` to inherit common functionality
- Use the `createPrompt()` method from the base class
- Follow the same parameter structure (temperature, top_p, max_tokens)
- Add comprehensive error handling
- Use console logging for debugging

#### Step 3: Update the Factory

Modify `AIServiceFactory` in `src/aiService.ts` to support your new provider.

**Before**:
```typescript
static createService(
  provider: 'aws-bedrock' | 'google-gemini',
  config: any
): AIProvider {
  switch (provider) {
    case 'aws-bedrock':
      return new AWSBedrockService(...);
    case 'google-gemini':
      return new GoogleGeminiService(...);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
```

**After**:
```typescript
static createService(
  provider: 'aws-bedrock' | 'google-gemini' | 'your-provider',  // Add your provider
  config: any
): AIProvider {
  switch (provider) {
    case 'aws-bedrock':
      return new AWSBedrockService(...);
    case 'google-gemini':
      return new GoogleGeminiService(...);
    case 'your-provider':  // Add your case
      return new YourProviderService(
        config.apiKey,
        config.modelId
      );
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
```

#### Step 4: Add Configuration Properties

Update `package.json` to add configuration settings for your provider.

**Location**: `package.json` → `contributes.configuration.properties`

**Add these properties**:
```json
{
  "gitAIAssistant.yourProviderApiKey": {
    "type": "string",
    "default": "",
    "description": "[Provider Name] API Key"
  },
  "gitAIAssistant.yourProviderModel": {
    "type": "string",
    "enum": ["model-1", "model-2", "model-3"],
    "default": "model-1",
    "description": "[Provider Name] model to use"
  }
}
```

**Update the modelProvider enum**:
```json
{
  "gitAIAssistant.modelProvider": {
    "type": "string",
    "enum": ["aws-bedrock", "google-gemini", "your-provider"],  // Add here
    "default": "google-gemini",
    "description": "The AI model provider to use for generating PR descriptions"
  }
}
```

#### Step 5: Update the UI

Update the webview UI in `src/extension.ts` to support your new provider.

**5.1: Add Provider Configuration Section**

Find the `getProviderConfigWebviewContent` function (around line 816) and add:

```html
<div id="your-provider-config" class="config-section" style="display: ${currentProvider === 'your-provider' ? 'block' : 'none'}">
    <h2>[Provider Name] Configuration</h2>
    <div class="field">
        <label for="your-provider-api-key">API Key:</label>
        <input type="password" id="your-provider-api-key" value="${yourProviderApiKey}" placeholder="Enter [Provider] API Key">
        <div class="help-text">
          <p>Get your API key from: <a href="https://provider.com/api-keys" target="_blank" class="api-key-link">[Provider] API Keys</a></p>
        </div>
    </div>
    <div class="field">
        <label for="your-provider-model">Model:</label>
        <select id="your-provider-model">
            <option value="model-1" ${yourProviderModel === 'model-1' ? 'selected' : ''}>Model 1</option>
            <option value="model-2" ${yourProviderModel === 'model-2' ? 'selected' : ''}>Model 2</option>
        </select>
    </div>
</div>
```

**5.2: Update Provider Selection Dropdown**

Add your provider to the provider selection dropdown:

```html
<select id="provider-select">
    <option value="google-gemini" ${currentProvider === 'google-gemini' ? 'selected' : ''}>Google Gemini</option>
    <option value="aws-bedrock" ${currentProvider === 'aws-bedrock' ? 'selected' : ''}>AWS Bedrock</option>
    <option value="your-provider" ${currentProvider === 'your-provider' ? 'selected' : ''}>[Provider Name]</option>
</select>
```

**5.3: Add JavaScript Handler**

Update the JavaScript in the webview to handle your provider:

```javascript
providerSelect.addEventListener('change', function() {
    const provider = providerSelect.value;
    awsConfig.style.display = provider === 'aws-bedrock' ? 'block' : 'none';
    googleConfig.style.display = provider === 'google-gemini' ? 'block' : 'none';
    yourProviderConfig.style.display = provider === 'your-provider' ? 'block' : 'none';  // Add this
});
```

**5.4: Add Save Handler**

Update the save configuration handler to save your provider's settings:

```typescript
case 'saveConfiguration':
  // ... existing code ...
  else if (provider === 'your-provider') {
    await config.update('yourProviderApiKey', message.yourProviderApiKey, vscode.ConfigurationTarget.Global);
    await config.update('yourProviderModel', message.yourProviderModel, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('[Provider Name] configuration saved successfully');
  }
  break;
```

**5.5: Update Service Creation Logic**

In the `generatePRDescription` command (around line 370), add handling for your provider:

```typescript
else if (modelProvider === 'your-provider') {
  const apiKey = config.get<string>('yourProviderApiKey') || '';
  const modelId = config.get<string>('yourProviderModel') || 'model-1';

  if (!apiKey) {
    vscode.window.showErrorMessage('[Provider] API key not configured.');
    return Promise.resolve();
  }

  aiService = AIServiceFactory.createService('your-provider', {
    apiKey,
    modelId
  });
}
```

**5.6: Update Tree View Display**

Update the `getChildren` method in `GitAIAssistantProvider` (around line 518) to display your provider:

```typescript
let providerDisplay = 'Google Gemini';
if (provider === 'aws-bedrock') {
  providerDisplay = 'AWS Bedrock';
} else if (provider === 'your-provider') {
  providerDisplay = '[Provider Name]';
}
```

#### Step 6: Test the Implementation

Before testing, ensure all changes are saved and compiled.

**6.1: Compile the Extension**
```bash
npm run compile
```

**6.2: Test in VS Code**
1. Press `F5` to launch the Extension Development Host
2. Open a git repository in the new VS Code window
3. Open the Git AI Assistant sidebar
4. Click "Configure Settings"
5. Select your new provider from the dropdown
6. Enter your API credentials
7. Save the configuration
8. Make some changes to files and stage them
9. Click "Generate PR Description"
10. Verify the AI generates a proper description

**6.3: Create a Unit Test**

Add a test file `src/test/suite/yourProvider.test.ts`:

```typescript
import { expect } from 'chai';
import { YourProviderService } from '../../aiService';

describe('YourProviderService', () => {
  it('should create an instance with valid config', () => {
    const service = new YourProviderService('test-api-key', 'model-1');
    expect(service).to.be.instanceOf(YourProviderService);
  });

  it('should generate PR description', async function() {
    this.timeout(30000); // Increase timeout for API calls

    const service = new YourProviderService(
      process.env.YOUR_PROVIDER_API_KEY || '',
      'model-1'
    );

    const gitDiff = 'diff --git a/file.ts...';
    const template = '## Summary\n\n## Changes';

    const result = await service.generatePRDescription(gitDiff, template);

    expect(result).to.be.a('string');
    expect(result.length).to.be.greaterThan(0);
  });
});
```

**6.4: Run Tests**
```bash
npm run test:unit
```

#### Step 7: Update Documentation

Update project documentation to include your new provider:

**7.1: Update README.md**

Add your provider to the features section:

```markdown
## Supported AI Providers

- **AWS Bedrock**: Enterprise-grade Claude 3.5 Sonnet
- **Google Gemini**: Free tier available with multiple models
- **[Provider Name]**: [Brief description]
```

Add configuration instructions:

```markdown
### [Provider Name] Configuration

1. Get your API key from [Provider URL]
2. Open Git AI Assistant settings
3. Select "[Provider Name]" as the provider
4. Enter your API key
5. Select your preferred model
6. Save configuration
```

**7.2: Update CHANGELOG.md**

Document the new feature:

```markdown
## [Version] - [Date]

### Added
- Support for [Provider Name] AI models
  - Model 1
  - Model 2
  - Model 3
```

---

## Practical Example: Adding OpenAI GPT

Let's walk through a complete, real-world example of adding OpenAI GPT support to the extension.

### Step 1: Install Dependencies

```bash
npm install @ai-sdk/openai --save
```

### Step 2: Import and Create Service Class

Add to `src/aiService.ts`:

```typescript
// Add this import at the top
import { openai } from '@ai-sdk/openai';

// Add this class after GoogleGeminiService
/**
 * OpenAI GPT implementation of the AI service
 */
export class OpenAIService extends BaseAIService {
  private apiKey: string;
  private modelId: string;

  // List of supported OpenAI models
  private static readonly SUPPORTED_MODELS = [
    'gpt-4-turbo-preview',
    'gpt-4',
    'gpt-3.5-turbo',
  ];

  /**
   * Create a new OpenAI Service
   * @param apiKey OpenAI API key
   * @param modelId OpenAI model ID (optional, defaults to gpt-4-turbo-preview)
   */
  constructor(apiKey: string, modelId: string = 'gpt-4-turbo-preview') {
    super();
    this.apiKey = apiKey;
    this.modelId = modelId;

    // Validate model ID
    if (!OpenAIService.SUPPORTED_MODELS.includes(modelId)) {
      console.warn(`Unsupported OpenAI model: ${modelId}. Falling back to gpt-4-turbo-preview`);
      this.modelId = 'gpt-4-turbo-preview';
    }
  }

  /**
   * Generate a PR description using OpenAI GPT
   * @param gitDiff The git diff to describe
   * @param template The PR template to use
   * @returns The generated PR description
   */
  async generatePRDescription(gitDiff: string, template: string): Promise<string> {
    // Set environment variable for OpenAI API key
    process.env.OPENAI_API_KEY = this.apiKey;

    // Create the prompt using the base class method
    const prompt = this.createPrompt(gitDiff, template);

    try {
      console.log(`Generating PR description with OpenAI model: ${this.modelId}`);

      // Use Vercel AI SDK to generate text with OpenAI
      // @ts-ignore - Types may not be properly configured for the AI SDK
      const result = await ai.generateText({
        // @ts-ignore - Using any to bypass type checking for model
        model: openai(this.modelId),
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that writes clear, concise pull request descriptions based on git diffs.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2000
      });

      // @ts-ignore - Extract the text from the result
      return result.text.trim();
    } catch (error) {
      console.error(`Error with OpenAI model ${this.modelId}:`, error);
      throw new Error(`Failed to generate PR description with OpenAI: ${(error as Error).message}`);
    }
  }
}
```

### Step 3: Update Factory

Modify the `AIServiceFactory`:

```typescript
static createService(
  provider: 'aws-bedrock' | 'google-gemini' | 'openai',
  config: any
): AIProvider {
  switch (provider) {
    case 'aws-bedrock':
      return new AWSBedrockService(
        config.region,
        config.accessKeyId,
        config.secretAccessKey,
        config.sessionToken
      );
    case 'google-gemini':
      return new GoogleGeminiService(config.apiKey, config.modelId);
    case 'openai':
      return new OpenAIService(config.apiKey, config.modelId);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
```

### Step 4: Add Configuration to package.json

```json
{
  "gitAIAssistant.modelProvider": {
    "type": "string",
    "enum": ["aws-bedrock", "google-gemini", "openai"],
    "default": "google-gemini",
    "description": "The AI model provider to use for generating PR descriptions"
  },
  "gitAIAssistant.openaiApiKey": {
    "type": "string",
    "default": "",
    "description": "OpenAI API Key"
  },
  "gitAIAssistant.openaiModel": {
    "type": "string",
    "enum": ["gpt-4-turbo-preview", "gpt-4", "gpt-3.5-turbo"],
    "default": "gpt-4-turbo-preview",
    "description": "OpenAI model to use"
  }
}
```

### Step 5: Update UI in extension.ts

**Update function signature** (around line 816):

```typescript
function getProviderConfigWebviewContent(
  currentProvider: string,
  awsAccessKeyId: string,
  awsSecretAccessKey: string,
  awsRegion: string,
  awsSessionToken: string,
  googleApiKey: string,
  googleModel: string,
  openaiApiKey: string,      // Add this
  openaiModel: string,        // Add this
  templateSource: string,
  customTemplate: string,
  defaultTemplate: string
): string {
```

**Add to provider selection dropdown**:

```html
<select id="provider-select">
    <option value="google-gemini" ${currentProvider === 'google-gemini' ? 'selected' : ''}>Google Gemini</option>
    <option value="aws-bedrock" ${currentProvider === 'aws-bedrock' ? 'selected' : ''}>AWS Bedrock</option>
    <option value="openai" ${currentProvider === 'openai' ? 'selected' : ''}>OpenAI GPT</option>
</select>
```

**Add configuration section**:

```html
<div id="openai-config" class="config-section" style="display: ${currentProvider === 'openai' ? 'block' : 'none'}">
    <h2>OpenAI Configuration</h2>
    <div class="field">
        <label for="openai-api-key">API Key:</label>
        <input type="password" id="openai-api-key" value="${openaiApiKey}" placeholder="Enter OpenAI API Key">
        <div class="help-text">
          <p>Get your API key from: <a href="https://platform.openai.com/api-keys" target="_blank" class="api-key-link">OpenAI API Keys</a></p>
        </div>
    </div>
    <div class="field">
        <label for="openai-model">Model:</label>
        <select id="openai-model">
            <option value="gpt-4-turbo-preview" ${openaiModel === 'gpt-4-turbo-preview' ? 'selected' : ''}>GPT-4 Turbo</option>
            <option value="gpt-4" ${openaiModel === 'gpt-4' ? 'selected' : ''}>GPT-4</option>
            <option value="gpt-3.5-turbo" ${openaiModel === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo</option>
        </select>
    </div>
</div>
```

**Update JavaScript handler**:

```javascript
const openaiConfig = document.getElementById('openai-config');

providerSelect.addEventListener('change', function() {
    const provider = providerSelect.value;
    awsConfig.style.display = provider === 'aws-bedrock' ? 'block' : 'none';
    googleConfig.style.display = provider === 'google-gemini' ? 'block' : 'none';
    openaiConfig.style.display = provider === 'openai' ? 'block' : 'none';
});
```

**Update save handler** (in the webview message handler):

```javascript
else if (provider === 'openai') {
    config.openaiApiKey = document.getElementById('openai-api-key').value;
    config.openaiModel = document.getElementById('openai-model').value;
}
```

**Update the message receiver** (around line 122):

```typescript
case 'saveConfiguration':
  // ... existing code ...
  else if (provider === 'openai') {
    await config.update('openaiApiKey', message.openaiApiKey, vscode.ConfigurationTarget.Global);
    await config.update('openaiModel', message.openaiModel, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage('OpenAI configuration saved successfully');
  }
  break;
```

**Update generatePRDescription command** (around line 445):

```typescript
else if (modelProvider === 'openai') {
  const apiKey = config.get<string>('openaiApiKey') || '';
  const modelId = config.get<string>('openaiModel') || 'gpt-4-turbo-preview';

  if (!apiKey) {
    vscode.window.showErrorMessage('OpenAI API key not configured. Please configure it in settings.');
    return Promise.resolve();
  }

  aiService = AIServiceFactory.createService('openai', {
    apiKey,
    modelId
  });
}
```

**Update tree view** (around line 529):

```typescript
let providerDisplay = 'Google Gemini';
if (provider === 'aws-bedrock') {
  providerDisplay = 'AWS Bedrock';
} else if (provider === 'openai') {
  providerDisplay = 'OpenAI GPT';
}
```

**Update configureProvider command call** (around line 93):

```typescript
const openaiApiKey = config.get<string>('openaiApiKey') || '';
const openaiModel = config.get<string>('openaiModel') || 'gpt-4-turbo-preview';

providerConfigPanel.webview.html = getProviderConfigWebviewContent(
  provider,
  awsAccessKeyId,
  awsSecretAccessKey,
  awsRegion,
  awsSessionToken,
  googleApiKey,
  googleGeminiModel,
  openaiApiKey,      // Add this
  openaiModel,        // Add this
  config.get<string>('templateSource', 'repository'),
  templateManager.getCustomTemplate() || '',
  config.get<string>('defaultTemplate', '')
);
```

### Step 6: Test

```bash
# Compile
npm run compile

# Test in VS Code
# Press F5 to launch Extension Development Host

# Manual testing steps:
# 1. Open sidebar
# 2. Click Configure Settings
# 3. Select "OpenAI GPT"
# 4. Enter API key
# 5. Select model
# 6. Save
# 7. Stage some changes
# 8. Generate PR description
```

### Step 7: Create Test Script

Create `scripts/test-openai.js`:

```javascript
require('dotenv').config();
const { OpenAIService } = require('../out/aiService');

async function testOpenAI() {
  console.log('Testing OpenAI service...');

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set in .env file');
    process.exit(1);
  }

  const service = new OpenAIService(apiKey, 'gpt-4-turbo-preview');

  const gitDiff = `diff --git a/src/example.ts b/src/example.ts
index 1234567..abcdefg 100644
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,3 +1,6 @@
+export function newFeature() {
+  return "Hello World";
+}
`;

  const template = `## Summary

## Changes

## Testing`;

  try {
    const result = await service.generatePRDescription(gitDiff, template);
    console.log('\nGenerated PR Description:');
    console.log(result);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

testOpenAI();
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "test:openai": "node scripts/test-openai.js"
  }
}
```

Run the test:

```bash
# Create .env file with your API key
echo "OPENAI_API_KEY=sk-..." > .env

# Run test
npm run test:openai
```

---

## Local Development & Testing

### Environment Setup

#### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/git-ai-assistant.git
cd git-ai-assistant

# Install dependencies
npm install
```

#### 2. Set Up API Credentials

Create a `.env` file in the project root:

```bash
# .env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
```

**Important**: Add `.env` to `.gitignore` to avoid committing credentials.

#### 3. Build the Extension

```bash
# Development build with watch mode
npm run webpack-dev

# Or one-time compilation
npm run compile
```

### Running Tests

#### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npx mocha --require ts-node/register src/test/suite/aiService.test.ts
```

#### Integration Tests with Real APIs

```bash
# Test AWS Bedrock
npm run test:bedrock:git

# Test Google Gemini
npm run test:gemini:git

# Test OpenAI (if you added it)
npm run test:openai
```

#### Manual Testing in VS Code

1. **Launch Extension Development Host**:
   - Press `F5` in VS Code
   - Or run "Debug: Start Debugging" from command palette

2. **Open a Git Repository**:
   - The extension requires an active git repository
   - Make sure you have at least one commit

3. **Configure the Extension**:
   - Open Git AI Assistant sidebar (click icon in activity bar)
   - Click "Configure Settings"
   - Select your AI provider
   - Enter credentials
   - Save configuration

4. **Test PR Generation**:
   - Make changes to files
   - Stage changes with `git add`
   - Click "Generate PR Description" in sidebar
   - Verify the AI generates appropriate content

5. **Check Console Logs**:
   - Open Developer Tools: `Help > Toggle Developer Tools`
   - Check Console tab for debug logs
   - Look for errors or warnings

### Debugging Tips

#### Enable Verbose Logging

Add more console logs to track execution:

```typescript
console.log('Step 1: Creating AI service...');
console.log('Config:', JSON.stringify(config, null, 2));
console.log('Step 2: Calling generatePRDescription...');
```

#### Debug AI Responses

Log the full prompt and response:

```typescript
async generatePRDescription(gitDiff: string, template: string): Promise<string> {
  const prompt = this.createPrompt(gitDiff, template);
  console.log('PROMPT:', prompt);

  const result = await ai.generateText({...});

  console.log('RESPONSE:', result.text);
  return result.text.trim();
}
```

#### Test with Simple Diffs

Create a minimal test case:

```bash
# Make a simple change
echo "test" > test.txt
git add test.txt

# Generate PR description
# Should be quick and easy to verify
```

#### Check Network Requests

Use VS Code's Network tab in Developer Tools to inspect API calls:
1. Open Developer Tools
2. Go to Network tab
3. Filter by "Fetch/XHR"
4. Generate PR description
5. Look for API requests to your AI provider

#### Common Issues

**Issue: "No staged changes detected"**
- **Cause**: No files are staged in git
- **Solution**: Run `git add` to stage files

**Issue: "API key not configured"**
- **Cause**: Credentials not saved properly
- **Solution**: Re-enter credentials and verify they're saved in VS Code settings

**Issue: "Failed to generate PR description"**
- **Cause**: API error, network issue, or invalid credentials
- **Solution**: Check console logs for detailed error message, verify API key is valid

**Issue: Extension not activating**
- **Cause**: Extension activation events not triggered
- **Solution**: Ensure you're in a git repository, check `activationEvents` in package.json

### Creating a Test Suite for New Providers

Create `src/test/suite/yourProvider.test.ts`:

```typescript
import { expect } from 'chai';
import { YourProviderService } from '../../aiService';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

describe('YourProviderService', () => {
  let service: YourProviderService;
  const apiKey = process.env.YOUR_PROVIDER_API_KEY || '';

  before(function() {
    if (!apiKey) {
      console.warn('YOUR_PROVIDER_API_KEY not set, skipping tests');
      this.skip();
    }
    service = new YourProviderService(apiKey, 'default-model');
  });

  it('should create an instance', () => {
    expect(service).to.be.instanceOf(YourProviderService);
  });

  it('should validate model IDs', () => {
    const invalidService = new YourProviderService(apiKey, 'invalid-model');
    // Should fall back to default model without throwing
    expect(invalidService).to.be.instanceOf(YourProviderService);
  });

  it('should generate PR description from git diff', async function() {
    this.timeout(30000); // AI API calls can take time

    const gitDiff = `diff --git a/README.md b/README.md
index 1234567..abcdefg 100644
--- a/README.md
+++ b/README.md
@@ -1 +1,2 @@
 # Test Project
+Added new feature for testing`;

    const template = `## Summary

## Changes

## Testing`;

    const result = await service.generatePRDescription(gitDiff, template);

    expect(result).to.be.a('string');
    expect(result.length).to.be.greaterThan(10);
    expect(result).to.include('Summary');

    console.log('Generated description:', result);
  });

  it('should handle errors gracefully', async function() {
    this.timeout(10000);

    const invalidService = new YourProviderService('invalid-key', 'default-model');
    const gitDiff = 'test diff';
    const template = 'test template';

    try {
      await invalidService.generatePRDescription(gitDiff, template);
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.include('Failed to generate');
    }
  });
});
```

Run the test:

```bash
npm run test:unit
```

---

## Code Reference

### Key Files and Their Purposes

#### Core AI Service Layer

**`src/aiService.ts`** (252 lines)
- **Purpose**: Contains all AI service implementations and the factory
- **Key Components**:
  - `AIProvider` interface (line 9)
  - `BaseAIService` abstract class (line 16)
  - `AWSBedrockService` class (line 58)
  - `GoogleGeminiService` class (line 151)
  - `AIServiceFactory` class (line 227)
- **When to Edit**: Adding new AI providers, modifying prompt structure, changing AI parameters

#### Extension Entry Point

**`src/extension.ts`** (1175 lines)
- **Purpose**: VS Code extension activation and command registration
- **Key Components**:
  - `activate()` function (line 21) - Extension initialization
  - `generatePRDescription` command (line 370) - Main PR generation logic
  - `configureProvider` command (line 68) - Settings UI
  - `getProviderConfigWebviewContent` (line 816) - HTML for settings panel
  - `GitAIAssistantProvider` class (line 506) - Sidebar tree view
- **When to Edit**: Adding UI elements, registering new commands, updating configuration handling

#### Git Integration

**`src/gitDiffReader.ts`**
- **Purpose**: Reads git diffs from staged changes or commits
- **Key Methods**:
  - `getDiff(source: string, commitCount: number)` - Get diff from specified source
  - `getStagedDiff()` - Get diff of staged changes
  - `getCommitDiff(count: number)` - Get diff of recent commits
- **When to Edit**: Changing diff format, adding new diff sources

#### Template Management

**`src/templateManager.ts`**
- **Purpose**: Manages PR templates (default, custom, repository-based)
- **Key Methods**:
  - `getTemplate(workspace)` - Get appropriate template
  - `saveCustomTemplate(template)` - Save user's custom template
  - `getCustomTemplate()` - Retrieve saved custom template
- **When to Edit**: Adding template variables, changing template priority

#### Configuration

**`package.json`**
- **Purpose**: VS Code extension manifest and configuration schema
- **Key Sections**:
  - `contributes.commands` (line 42) - Command definitions
  - `contributes.configuration` (line 95) - Settings schema
  - `contributes.views` (line 28) - Sidebar view registration
  - `dependencies` (line 214) - Required packages
- **When to Edit**: Adding new settings, registering commands, adding dependencies

### Important Functions and Classes

#### AIProvider Interface
```typescript
export interface AIProvider {
  generatePRDescription(gitDiff: string, template: string): Promise<string>;
}
```
**Purpose**: Contract that all AI services must implement
**Usage**: Implement this when creating new AI providers

#### BaseAIService.createPrompt()
```typescript
protected createPrompt(gitDiff: string, template: string): string
```
**Location**: `src/aiService.ts:31`
**Purpose**: Creates standardized prompt for AI models
**Usage**: Called by all AI service implementations to format input

#### AIServiceFactory.createService()
```typescript
static createService(
  provider: 'aws-bedrock' | 'google-gemini',
  config: any
): AIProvider
```
**Location**: `src/aiService.ts:234`
**Purpose**: Factory method to create AI service instances
**Usage**: Call this to instantiate AI services dynamically

#### Extension Commands

**Generate PR Description**
**Command ID**: `git-ai-assistant.generatePRDescription`
**Location**: `src/extension.ts:370`
**Purpose**: Main command that generates PR descriptions using AI

**Configure Provider**
**Command ID**: `git-ai-assistant.configureProvider`
**Location**: `src/extension.ts:68`
**Purpose**: Opens settings panel for AI provider configuration

### Extension Points

These are the key locations where you can extend functionality:

#### 1. Add New AI Provider
- **File**: `src/aiService.ts`
- **Steps**:
  1. Create new class extending `BaseAIService`
  2. Add case to `AIServiceFactory.createService()`
  3. Update type union in factory method signature

#### 2. Customize Prompt
- **File**: `src/aiService.ts`
- **Method**: `BaseAIService.createPrompt()` (line 31)
- **Impact**: Affects all AI providers

#### 3. Add Configuration Setting
- **File**: `package.json`
- **Section**: `contributes.configuration.properties` (line 97)
- **Required**: Also update UI in `extension.ts`

#### 4. Modify UI
- **File**: `src/extension.ts`
- **Function**: `getProviderConfigWebviewContent()` (line 816)
- **Format**: HTML string with embedded CSS and JavaScript

#### 5. Change AI Parameters
- **File**: `src/aiService.ts`
- **Location**: Inside each service's `generatePRDescription()` method
- **Parameters**: `temperature`, `top_p`, `max_tokens`

### Dependencies

#### Core Dependencies

**Vercel AI SDK** (`ai`, `@ai-sdk/*`)
- **Purpose**: Unified interface for multiple AI providers
- **Usage**: Primary way to call AI models
- **Docs**: https://sdk.vercel.ai/docs

**AWS SDK** (`aws-sdk`, `@ai-sdk/amazon-bedrock`)
- **Purpose**: AWS Bedrock API access
- **Usage**: Claude models through AWS
- **Docs**: https://docs.aws.amazon.com/bedrock/

**Google AI** (`@ai-sdk/google`)
- **Purpose**: Google Gemini API access
- **Usage**: Gemini models
- **Docs**: https://ai.google.dev/

#### VS Code API

**`vscode` module**
- **Purpose**: VS Code extension API
- **Key APIs Used**:
  - `vscode.commands` - Command registration
  - `vscode.window` - UI elements (webviews, notifications)
  - `vscode.workspace` - Configuration and workspace access
  - `vscode.TreeDataProvider` - Sidebar tree view

### Testing Utilities

**Test Files Location**: `src/test/suite/`

**Available Test Scripts**:
```bash
npm run test:unit          # Run all unit tests
npm run test:gemini:git    # Test Gemini with real git diff
npm run test:bedrock:git   # Test Bedrock with real git diff
```

**Test Helper Scripts**: `scripts/`
- `test-gemini.js` - Standalone Gemini test
- `runUnitTests.js` - Unit test runner

---

## Summary

This guide has covered:

1. **Architecture Overview**: Understanding the design patterns and component interactions
2. **Deep Dive**: Detailed explanation of each service, factory, and integration point
3. **Step-by-Step Guide**: Complete process for adding new AI providers
4. **Practical Example**: Real implementation of OpenAI GPT integration
5. **Testing**: Comprehensive testing strategies for local development
6. **Code Reference**: Quick reference for key files, functions, and extension points

### Quick Start Checklist for Adding New Provider

- [ ] Install required npm packages
- [ ] Create service class extending `BaseAIService`
- [ ] Implement `generatePRDescription()` method
- [ ] Update `AIServiceFactory`
- [ ] Add configuration properties to `package.json`
- [ ] Update webview UI in `extension.ts`
- [ ] Add JavaScript handlers for UI
- [ ] Update command handlers
- [ ] Create unit tests
- [ ] Manual testing in VS Code
- [ ] Update documentation

### Need Help?

- **Issues**: Report bugs or ask questions on GitHub Issues
- **Documentation**: Check README.md for user-facing documentation
- **Code Examples**: Look at existing `AWSBedrockService` and `GoogleGeminiService` implementations
- **VS Code API**: https://code.visualstudio.com/api
- **Vercel AI SDK**: https://sdk.vercel.ai/docs

---

**Last Updated**: January 2025
**Version**: 0.3.0
