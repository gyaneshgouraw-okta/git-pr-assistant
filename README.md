# Git AI Assistant

A VS Code extension that generates PR descriptions and commit messages using AI (AWS Bedrock Claude or Google Gemini).

## Features

- Automatically generates PR descriptions based on your local git diffs
- Supports multiple AI providers:
  - AWS Bedrock with Claude models
  - Google Gemini models
- Supports customizable PR templates
- Opens the generated PR description in a new editor tab so you can review and edit it
- Convenient sidebar panel for quick access to all features
- Easy configuration UI for AI provider credentials
- Modular architecture for easy addition of more AI providers in the future

## Requirements

- Visual Studio Code 1.60.0 or higher
- Git installed and accessible from the command line
- One of the following:
  - AWS account with access to Bedrock and Claude
  - Google API key with access to Gemini models

## Installation

1. Install the extension from the VS Code Marketplace
2. Configure your preferred AI provider credentials through the sidebar panel

## Usage

### Using the Sidebar Panel

1. Click on the Git AI Assistant icon in the VS Code Activity Bar (left sidebar)
2. In the sidebar panel, click on:
   - "Configure AWS Credentials" to set up your AWS access
   - "Configure Google Credentials" to set up your Google API key
   - "Generate PR Description" to create a PR description

### Using Commands

1. Make changes to your code and stage them with git
2. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Run the command "Generate PR Description and Commit Message"
4. Review and edit the generated description in the new editor tab
5. Copy the description to your PR when ready

## Configuration

This extension supports multiple AI providers that you can configure:

### AWS Bedrock

#### Using the Configuration UI

1. Click on "Configure AWS Credentials" in the sidebar panel
2. Enter your AWS Access Key ID and Secret Access Key
3. Select your preferred AWS Region
4. Click "Save Credentials & Use AWS Bedrock"

#### Using Settings 

You can also configure these settings in VS Code settings:

```json
{
  "gitAIAssistant.modelProvider": "aws-bedrock",
  "gitAIAssistant.awsAccessKeyId": "YOUR_AWS_ACCESS_KEY_ID",
  "gitAIAssistant.awsSecretAccessKey": "YOUR_AWS_SECRET_ACCESS_KEY",
  "gitAIAssistant.awsRegion": "us-east-1",
  "gitAIAssistant.defaultPRTemplate": "## Summary\n\n## Changes\n\n## Testing\n\n## Screenshots\n\n"
}
```

### Google Gemini

#### Using the Configuration UI

1. Click on "Configure Google Credentials" in the sidebar panel
2. Enter your Google API Key
3. Select your preferred Gemini model:
   - Gemini 1.5 Flash (default)
   - Gemini 1.5 Flash 8B (smaller model)
   - Gemini 2.0 Flash (experimental)
4. Click "Save Credentials & Use Google Gemini"

#### Using Settings

You can also configure these settings in VS Code settings:

```json
{
  "gitAIAssistant.modelProvider": "google-gemini",
  "gitAIAssistant.googleApiKey": "YOUR_GOOGLE_API_KEY",
  "gitAIAssistant.googleGeminiModel": "gemini-1.5-flash",
  "gitAIAssistant.defaultPRTemplate": "## Summary\n\n## Changes\n\n## Testing\n\n## Screenshots\n\n"
}
```

> ⚠️ Your credentials are stored securely in VS Code's settings storage.

## Development

### Prerequisites

- Node.js 14.x or higher
- npm 7.x or higher

### Setup

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension

### Testing the AI Integrations

You can test both AI integrations directly without running the VS Code extension:

#### AWS Bedrock Testing

1. Create a `.env` file in the root directory with your AWS credentials:
   ```
   AWS_ACCESS_KEY_ID=your_access_key_id
   AWS_SECRET_ACCESS_KEY=your_secret_access_key
   AWS_REGION=us-east-1
   ```

2. Run one of the AWS test scripts:
   ```bash
   # Run with built-in sample diff
   npm run test:bedrock
   
   # Run with actual uncommitted changes from your working directory
   npm run test:bedrock:git
   
   # Run with a custom diff file
   DIFF_FILE_PATH=./path/to/your/diff.txt npm run test:bedrock
   ```

#### Google Gemini Testing

1. Create a `.env` file in the root directory with your Google API key:
   ```
   GOOGLE_API_KEY=your_google_api_key
   GOOGLE_MODEL_ID=gemini-1.5-flash  # Optional, defaults to gemini-1.5-flash
   ```

2. Run one of the Google test scripts:
   ```bash
   # Run with built-in sample diff
   npm run test:gemini
   
   # Run with actual uncommitted changes from your working directory
   npm run test:gemini:git
   
   # Run with a custom diff file
   DIFF_FILE_PATH=./path/to/your/diff.txt npm run test:gemini
   ```

The `test:*:git` options are particularly useful when you want to:
- Generate a PR description for your current uncommitted changes
- Test how the AI would describe your work-in-progress
- Get a preview of your PR description before committing and creating a pull request

When using the `--git` flag, the scripts will:
1. Get all uncommitted changes (both staged and unstaged) using `git diff` and `git diff --staged`
2. Combine them into a single diff
3. Generate a PR description based on those actual changes

### VS Code Extension Testing

This project follows Test-Driven Development (TDD) principles. There are several ways to run the tests:

```bash
# Run full VS Code integration tests (requires downloading VS Code)
npm test

# Run full tests with SSL verification disabled
npm run test:nossl

# Run tests directly with mocked VS Code API (no download required)
npm run test:direct

# Run just the template manager tests (most reliable for quick testing)
npm run test:template
```

The project includes comprehensive unit tests for all components:
- GitDiffReader: Tests for reading git diffs
- TemplateManager: Tests for managing PR templates
- AIService: Tests for generating PR descriptions with AWS Bedrock and Google Gemini

### Packaging and Deployment

#### Creating a VSIX package

To create a VSIX file that can be installed in VS Code:

```bash
# Generate a .vsix file in the root directory
npm run package
```

This will create a file named `git-ai-assistant-0.1.0.vsix` (or similar, based on version) in your project root.

#### Installing the extension locally

To install the extension from the VSIX file:

1. Open VS Code
2. Click on the Extensions view icon in the Activity Bar
3. Click on the "..." (More Actions) menu
4. Select "Install from VSIX..."
5. Navigate to and select your VSIX file

Alternatively, you can install it from the command line:

```bash
code --install-extension git-ai-assistant-0.1.0.vsix
```

#### Publishing to the VS Code Marketplace

Before publishing, update the following in your `package.json`:

1. Set a proper `publisher` name (you'll need to [create a publisher](https://marketplace.visualstudio.com/manage) on the VS Code Marketplace)
2. Ensure your `repository` URL is correct
3. Consider adding more metadata like `keywords`, `homepage`, etc.

Then, to publish:

1. Create a [Personal Access Token](https://dev.azure.com/your-organization/_usersSettings/tokens) with the appropriate permissions
2. Login to the marketplace: `vsce login <your-publisher-name>`
3. Publish the extension: `npm run publish`

Or you can publish in one step with your token:

```bash
vsce publish -p <your-personal-access-token>
```

### Uninstalling the Extension

To uninstall the extension, you can use the built-in npm script:

```bash
npm run uninstall
```

This will automatically detect your editor (VS Code or Cursor) and handle the uninstallation process accordingly.

## License

MIT 

# Git AI Assistant Diagrams

This directory contains a set of diagrams that illustrate the architecture and workflow of the Git AI Assistant VS Code extension. These diagrams are provided in DrawIO (diagrams.net) format, which allows for easy editing and customization.

## Available Diagrams

1. **Architecture Overview** (`architecture-overview.drawio`)
   - Shows the main components of the Git AI Assistant and how they interact
   - Visualizes the relationship between core modules like GitDiffReader, TemplateManager, and AIServiceFactory

2. **PR Description Generation Flow** (`pr-description-flow.drawio`)
   - Illustrates the sequential steps when generating a PR description
   - Shows data flow from user command through various components to final output

3. **Configuration UI Flow** (`configuration-ui-flow.drawio`)
   - Demonstrates how users interact with the configuration interface
   - Shows navigation between different configuration screens and settings persistence

4. **Component Message Flow** (`component-message-flow.drawio`)
   - Depicts how messages and data are exchanged between components
   - Highlights the communication paths between UI, core modules, and VS Code settings

5. **HTML Visualization** (`git-ai-assistant-diagrams.html`)
   - A standalone HTML file containing rendered versions of all diagrams
   - Useful for quick reference without needing to open an editor

## How to Use These Diagrams

### Viewing Diagrams

1. **HTML Version**: 
   - Open `git-ai-assistant-diagrams.html` in any web browser for a quick visual reference

2. **DrawIO Files**:
   - Open any `.drawio` file using [diagrams.net](https://app.diagrams.net/) (online or desktop app)
   - You can also use the DrawIO VS Code extension to view and edit diagrams directly in VS Code

### Editing Diagrams

1. Using diagrams.net website:
   - Go to [diagrams.net](https://app.diagrams.net/)
   - Click "Open Existing Diagram" and select the .drawio file
   - Make your changes and save

2. Using the desktop app:
   - Download [Draw.io Desktop](https://github.com/jgraph/drawio-desktop/releases)
   - Open the app and open the .drawio file
   - Edit and save as needed

3. Using VS Code:
   - Install the DrawIO VS Code extension
   - Open the .drawio file directly in VS Code
   - Make changes and save

## Purpose of These Diagrams

These diagrams serve as both documentation and learning tools:

- **For New Developers**: Quickly understand the overall structure and flow of the application
- **For Existing Team**: Reference for discussing changes and enhancements
- **For Documentation**: Visual aids to include in user and developer documentation

Feel free to update and extend these diagrams as the application evolves! 