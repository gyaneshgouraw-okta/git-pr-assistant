# Git AI Assistant

A VS Code extension that generates PR descriptions and commit messages using AI (AWS Bedrock and Claude).

## Features

- Automatically generates PR descriptions based on your local git diffs
- Uses AWS Bedrock and Claude AI for intelligent text generation
- Supports customizable PR templates
- Opens the generated PR description in a new editor tab so you can review and edit it

## Requirements

- Visual Studio Code 1.60.0 or higher
- Git installed and accessible from the command line
- AWS account with access to Bedrock and Claude

## Installation

1. Install the extension from the VS Code Marketplace
2. Configure your AWS credentials in the extension settings

## Configuration

This extension requires the following configuration:

1. AWS Access Key ID and Secret Access Key with permissions to access Bedrock
2. AWS Region where Bedrock is available
3. (Optional) Custom PR template

You can configure these settings in VS Code settings:

```json
{
  "gitAIAssistant.awsAccessKeyId": "YOUR_AWS_ACCESS_KEY_ID",
  "gitAIAssistant.awsSecretAccessKey": "YOUR_AWS_SECRET_ACCESS_KEY",
  "gitAIAssistant.awsRegion": "us-east-1",
  "gitAIAssistant.defaultPRTemplate": "## Summary\n\n## Changes\n\n## Testing\n\n## Screenshots\n\n"
}
```

> ⚠️ It's recommended to use VS Code's built-in secrets storage for the AWS credentials for enhanced security.

## Usage

1. Make changes to your code and stage them with git
2. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Run the command "Generate PR Description and Commit Message"
4. Review and edit the generated description in the new editor tab
5. Copy the description to your PR when ready

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

## License

MIT 