# Git AI Assistant

A VS Code extension that generates PR descriptions and commit messages using AI (AWS Bedrock and Claude).

## Features

- Automatically generates PR descriptions based on your local git diffs
- Uses AWS Bedrock and Claude AI for intelligent text generation
- Supports customizable PR templates
- Opens the generated PR description in a new editor tab so you can review and edit it
- Convenient sidebar panel for quick access to all features
- Easy configuration UI for AWS credentials

## Requirements

- Visual Studio Code 1.60.0 or higher
- Git installed and accessible from the command line
- AWS account with access to Bedrock and Claude

## Installation

1. Install the extension from the VS Code Marketplace
2. Configure your AWS credentials through the sidebar panel

## Usage

### Using the Sidebar Panel

1. Click on the Git AI Assistant icon in the VS Code Activity Bar (left sidebar)
2. In the sidebar panel, click on:
   - "Configure AWS Credentials" to set up your AWS access
   - "Generate PR Description" to create a PR description

### Using Commands

1. Make changes to your code and stage them with git
2. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Run the command "Generate PR Description and Commit Message"
4. Review and edit the generated description in the new editor tab
5. Copy the description to your PR when ready

## Configuration

This extension requires AWS credentials for accessing Bedrock services:

### Using the Configuration UI

1. Click on "Configure AWS Credentials" in the sidebar panel
2. Enter your AWS Access Key ID and Secret Access Key
3. Select your preferred AWS Region
4. Click "Save Credentials"

### Using Settings 

Alternatively, you can configure these settings in VS Code settings:

```json
{
  "gitAIAssistant.awsAccessKeyId": "YOUR_AWS_ACCESS_KEY_ID",
  "gitAIAssistant.awsSecretAccessKey": "YOUR_AWS_SECRET_ACCESS_KEY",
  "gitAIAssistant.awsRegion": "us-east-1",
  "gitAIAssistant.defaultPRTemplate": "## Summary\n\n## Changes\n\n## Testing\n\n## Screenshots\n\n"
}
```

> ⚠️ Your credentials are stored securely in VS Code's settings storage.

## Architecture

The extension consists of three main components:

1. **GitDiffReader**: Reads the current git diff from the repository
2. **TemplateManager**: Manages PR templates, including loading default templates and saving custom ones
3. **AIService**: Interfaces with AWS Bedrock to generate PR descriptions using Claude AI

## Development

### Prerequisites

- Node.js 14.x or higher
- npm 7.x or higher

### Setup

1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension

### Testing

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
- AIService: Tests for generating PR descriptions with AWS Bedrock

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

## License

MIT 