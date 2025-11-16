# Git AI Assistant

A VS Code extension that generates PR descriptions using GitHub Copilot. No API keys required - just use your existing Copilot subscription!

   ![Git-Ai-Assistant](resources/final-view-2.gif)

## ✨ Features

### Core Functionality
- 🤖 **AI-Powered PR Descriptions** - Automatically generates comprehensive PR descriptions using GitHub Copilot
- 🎨 **Modern Material Design UI** - Beautiful, responsive webview interface with VS Code theme integration
- 🚀 **Zero Configuration Required** - No API keys needed - leverages your existing Copilot subscription
- 📝 **Customizable Templates** - Use built-in templates or create your own custom PR templates
- 🔄 **Flexible Diff Sources** - Generate from staged changes or recent commits (1-20 commits)
- 🎯 **Multiple Access Points** - Available via sidebar panel, SCM panel, and command palette

### User Interface
- 📊 **Dedicated Sidebar Panel** - Quick access to all features with real-time status indicators
- 🔧 **SCM Integration** - Built-in PR Assistant panel directly in Source Control view
- 🎛️ **Advanced Configuration UI** - Two-column responsive layout for easy setup
- ✅ **Status Monitoring** - Real-time GitHub Copilot availability and extension health checks
- 🎨 **Theme-Aware Design** - Seamlessly integrates with your VS Code theme

### Customization Options
- 🤖 **Multiple Copilot Models** - Choose from all available GitHub Copilot models
- 📄 **Template Management** - Create and manage custom PR templates
- 🔀 **Diff Source Selection** - Pick between staged changes or specific commit ranges
- ⚙️ **Persistent Settings** - All configurations saved globally across workspaces

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

### 🎯 Method 1: Using the Sidebar Panel (Recommended)

1. **Open the Extension**
   - Click on the Git AI Assistant icon (hexagonal pattern) in the VS Code Activity Bar (left sidebar)

2. **Quick Actions**
   - Click "Generate" under the "Quick Actions" section to create a PR description
   - The extension will use your configured settings to generate the description

3. **Configuration**
   - Click "Configure Settings" to open the advanced configuration panel
   - View real-time status of GitHub Copilot and extension health
   - See your current AI model, template, and diff source settings at a glance

### 🔧 Method 2: Using the SCM Panel

1. **Access via Source Control**
   - Open the Source Control view (Ctrl+Shift+G or Cmd+Shift+G)
   - Look for the "PR Assistant" panel at the bottom of the Source Control view

2. **Quick Generation**
   - Click "Generate PR Description" button
   - View current configuration (diff source and AI model status)
   - Click "Configure Settings" to adjust options

### ⌨️ Method 3: Using Command Palette

1. Make changes to your code and stage them with git (or ensure you have recent commits)
2. Open the command palette (Ctrl+Shift+P or Cmd+Shift+P)
3. Run the command "Generate PR Description"
4. Review and edit the generated description in the new editor tab
5. Copy the description to your PR when ready

### 📋 Generated Output

- The PR description opens in a new **Markdown editor tab**
- You can edit and refine the description before using it
- The description follows your selected template format
- Copy the final content directly to your pull request

## ⚙️ Configuration

The extension features a modern, two-column configuration interface with responsive design. Access it by clicking "Configure Settings" from any panel.

   ![Configuration](resources/aprovider-generate.gif)

### 🤖 Copilot Model Selection

1. Open the configuration panel via "Configure Settings"
2. In the **Copilot Model Selection** card (left column):
   - Select your preferred GitHub Copilot model from the dropdown
   - The dropdown displays all available Copilot models with their family information
   - Models are automatically detected from your VS Code instance
3. Click "Save Configuration" to apply changes

**Available Models**: The extension supports all GitHub Copilot models available in your VS Code installation.

### 📊 Diff Source Configuration

Choose where to get the changes for your PR description:

#### Option 1: Staged Changes (Default)
- Uses changes staged with `git add`
- Perfect for incremental PR creation
- Gives you fine-grained control over what's included

#### Option 2: Recent Commits
- Uses changes from your recent commit history
- Specify 1-20 commits to include
- Ideal for creating PRs after completing work

**How to Configure:**
1. Open the configuration panel
2. In the **Diff Source Configuration** card (left column):
   - Select "Staged Changes" or "Recent Commits"
   - If using commits, set the number (1-20) in the "Number of Recent Commits" field
3. Click "Save Configuration"

### 📄 Template Management

Customize how your PR descriptions are formatted:

#### Built-in Default Template
- Includes sections: Changes, Testing, Impact, and Checklist
- Professional format with emojis for better readability
- Follows industry best practices

#### Custom Template
- Create your own PR description format
- Use Markdown syntax with placeholders
- Stored globally and persists across workspaces

**How to Configure:**
1. Open the configuration panel
2. In the **Template Configuration** card (right column):
   - Select "Default Template" or "Custom Template"
   - If custom, enter your template content in the text area
   - Use Markdown formatting and add your own sections
3. Click "Save Configuration"

### ⚡ Quick Settings (VS Code Settings.json)

Advanced users can configure directly in settings:

```json
{
  "gitAIAssistant.copilotModelId": "copilot-model-id-here",
  "gitAIAssistant.diffSource": "staged",        // or "commits"
  "gitAIAssistant.commitCount": 1,              // 1-20 commits when using "commits"
  "gitAIAssistant.templateSource": "default"    // or "custom"
}
```

**Note**: The configuration UI is the recommended way to manage settings as it provides validation and model selection assistance.

## 🎨 User Interface Overview

### Main Sidebar Panel

The dedicated Git AI Assistant sidebar panel provides a centralized control center:

- **Quick Actions Section**
  - One-click "Generate" button with visual feedback
  - Card-based design for better organization

- **Configuration Section**
  - Real-time display of current AI model with status indicator
  - At-a-glance view of template and diff source settings
  - Quick access to configuration panel

- **Service Status Section**
  - GitHub Copilot availability indicator (Ready/Not Available/Unknown)
  - Extension version information
  - Color-coded status chips (green/red/yellow)

### SCM Integration Panel

Lightweight PR Assistant directly in your Source Control view:

- Compact design that doesn't obstruct your workflow
- Shows current diff source configuration
- AI model configuration status
- Direct access to all features without leaving Source Control

### Configuration Webview

Modern, responsive configuration interface:

- **Two-Column Layout**: Optimized for larger screens
- **Responsive Design**: Adapts to smaller viewports
- **Material Design Principles**: Clean cards, proper spacing, visual hierarchy
- **Theme Integration**: Automatically matches your VS Code theme
- **Real-time Validation**: Immediate feedback on configuration changes
- **Conditional Sections**: UI adapts based on your selections

## 🚀 Workflow Examples

### Example 1: Creating a PR from Staged Changes

```bash
# 1. Make your changes
git add src/feature.ts

# 2. Open Git AI Assistant sidebar
# 3. Click "Generate" button
# 4. Review and copy the generated description
```

### Example 2: Creating a PR from Multiple Commits

```bash
# 1. Complete your work with multiple commits
git commit -m "Add feature"
git commit -m "Add tests"
git commit -m "Update docs"

# 2. Open Configuration panel
# 3. Select "Recent Commits" and set count to 3
# 4. Click "Generate PR Description"
# 5. Review the comprehensive description
```

### Example 3: Using Custom Templates

1. Open Configuration panel
2. Select "Custom Template"
3. Enter your organization's PR template format
4. Save configuration
5. All future PR descriptions will follow your custom format

## 🛠️ Troubleshooting

### GitHub Copilot Not Available

**Issue**: Extension shows "GitHub Copilot: Not Available"

**Solutions**:
- Ensure you have an active GitHub Copilot subscription
- Check that the GitHub Copilot extension is installed and enabled
- Sign in to GitHub Copilot in VS Code
- Restart VS Code after installation

### No Changes Detected

**Issue**: "No staged changes detected" or "No changes found in commits"

**Solutions**:
- For staged changes: Run `git add` to stage your changes
- For commits: Ensure you have commits in your history
- Check you're in a valid git repository
- Try increasing the commit count in configuration

### Model Not Found

**Issue**: Selected model shows as "Not found" or unavailable

**Solutions**:
- Open the configuration panel and refresh the model list
- Verify GitHub Copilot is properly authenticated
- Try selecting a different model from the dropdown
- Restart VS Code if models aren't loading

## 📦 Extension Details

- **Current Version**: 0.5.0
- **VS Code Compatibility**: 1.60.0 or higher
- **Category**: SCM Providers, Productivity Tools
- **License**: MIT
- **Publisher**: gyaneshgouraw

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Report Issues**: Found a bug? [Open an issue](https://github.com/your-username/git-ai-assistant/issues)
2. **Suggest Features**: Have ideas for improvements? We'd love to hear them
3. **Submit PRs**: Fork the repo and submit pull requests
4. **Improve Documentation**: Help make our docs better

## 📚 Developer Documentation

For developers wanting to contribute or understand the codebase:

- **[overview.md](./overview.md)** - VS Code extension development fundamentals and patterns
- **[AGENTS.md](./AGENTS.md)** - Architecture guide and how to add new AI providers

### Quick Start for Developers

```bash
# Clone the repository
git clone https://github.com/your-username/git-ai-assistant.git

# Install dependencies
npm install

# Compile and watch for changes
npm run webpack-dev

# Run tests
npm test

# Package extension
npm run package
```

## 🔄 Changelog

### Version 0.5.0 (Latest)
- Enhanced sidebar icon with modern hexagonal design
- Improved configuration webview with responsive layout
- Added Material Design UI components
- Enhanced template management features
- Better status indicators and real-time updates

### Version 0.4.0
- Added SCM webview support
- Implemented advanced configuration options
- Enhanced diff source selection
- Improved error handling

## 🌟 Key Technologies

- **VS Code Extension API**: Leveraging the latest extension capabilities
- **GitHub Copilot API**: Direct integration with Copilot models
- **WebView API**: Modern UI with HTML/CSS/JavaScript
- **Git Integration**: Native git diff and commit analysis
- **TypeScript**: Type-safe development with full intellisense

## 📄 License

MIT License - see LICENSE file for details

---

**Made with ❤️ by the community** | **Powered by GitHub Copilot** 🤖


