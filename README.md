# Git AI Assistant

A VS Code extension that generates PR descriptions using GitHub Copilot. No API keys required - just use your existing Copilot subscription!

   ![Git-Ai-Assistant](resources/final-view.gif)
## Features

- Automatically generates PR descriptions based on your local git diffs
- Uses GitHub Copilot models directly through VS Code
- No API key management required
- Supports customizable PR templates
- Opens the generated PR description in a new editor tab so you can review and edit it
- Convenient sidebar panel for quick access to all features
- Choose from all available Copilot models

## Requirements

- Visual Studio Code 1.60.0 or higher
- Git installed and accessible from the command line
- **Active GitHub Copilot subscription** (required)
- GitHub Copilot extension enabled in VS Code

## Installation

1. Install the extension from the VS Code Marketplace
2. Ensure you have an active GitHub Copilot subscription
3. Select your preferred Copilot model through the configuration panel

## Usage

### Using the Sidebar Panel

1. Click on the Git AI Assistant icon in the VS Code Activity Bar (left sidebar)
2. In the sidebar panel, click on:
   - "Configure Settings" to select your Copilot model and configure other options
   - "Generate PR Description" to create a PR description from your changes

### Using Commands

1. Make changes to your code and stage them with git
2. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Run the command "Generate PR Description"
4. Review and edit the generated description in the new editor tab
5. Copy the description to your PR when ready

## Configuration

### Selecting a Copilot Model

1. Click on "Configure Settings" in the sidebar panel
2. Select your preferred GitHub Copilot model from the dropdown
3. The dropdown will show all available Copilot models in your VS Code instance
4. Click "Save Configuration"

   ![Configuration](resources/aprovider-generate.gif)

### Settings

You can also configure these settings in VS Code settings:

```json
{
  "gitAIAssistant.copilotModelId": "copilot-model-id-here",
  "gitAIAssistant.diffSource": "staged",
  "gitAIAssistant.commitCount": 1,
  "gitAIAssistant.templateSource": "default"
}
```

### Diff Source Configuration

You can choose between two sources for generating PR descriptions:

1. **Staged Changes** (default): Uses the currently staged changes in your git repository
2. **Recent Commits**: Uses a specific number of recent commits

#### Using the Configuration UI

1. Click on "Configure Settings" in the sidebar panel
2. Scroll down to the "PR Description Source" section
3. Select either "Staged Changes" or "Recent Commits"
4. If you select "Recent Commits", specify the number of commits to include (1-20)
5. Click "Save Configuration"

#### Using Settings

You can also configure these settings in VS Code settings:

```json
{
  "gitAIAssistant.diffSource": "staged", // or "commits"
  "gitAIAssistant.commitCount": 1 // Number of commits to consider when diffSource is "commits"
}
```

## Developer Documentation

For developers wanting to contribute or understand the codebase:

- **[overview.md](./overview.md)** - VS Code extension development fundamentals and patterns
- **[AGENTS.md](./AGENTS.md)** - Architecture guide and how to add new AI providers

## License

MIT 


