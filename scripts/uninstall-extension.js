/**
 * Script to uninstall the extension and reload the editor window
 * Detects whether running in VS Code or Cursor and uses appropriate commands
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Load package.json to get extension details
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Extension details
const publisher = packageJson.publisher;
const extensionName = packageJson.name;
const extensionId = `${publisher}.${extensionName}`;

// Detect if we're running in Cursor or VS Code
function detectEditor() {
  try {
    // Try to get the editor name from environment variables
    if (process.env.TERM_PROGRAM === 'cursor') {
      return 'cursor';
    }
    
    // Check if we're in the Cursor application by checking process title or path
    const processList = execSync('ps -ef').toString();
    if (processList.includes('Cursor.app') || processList.includes('cursor.exe')) {
      return 'cursor';
    }

    // Default to VS Code if we can't definitively determine Cursor
    return 'vscode';
  } catch (error) {
    console.error('Error detecting editor:', error.message);
    // Default to VS Code if detection fails
    return 'vscode';
  }
}

// Uninstall the extension and reload the editor
async function uninstallAndReload() {
  const editor = detectEditor();
  console.log(`Detected editor: ${editor}`);

  try {
    console.log(`Uninstalling extension: ${extensionId}`);
    
    if (editor === 'cursor') {
      // Commands for Cursor
      console.log('Using Cursor commands...');
      try {
        execSync(`cursor --uninstall-extension ${extensionId}`);
        console.log('Extension uninstalled successfully.');
        console.log('Reloading Cursor window...');
        execSync('cursor --reload-window');
      } catch (error) {
        // Fallback to VS Code commands if Cursor-specific ones fail
        console.log('Cursor-specific commands failed, trying VS Code commands...');
        execSync(`code --uninstall-extension ${extensionId}`);
        console.log('Extension uninstalled successfully.');
        console.log('Reloading editor window...');
        execSync('code --reload-window');
      }
    } else {
      // Commands for VS Code
      console.log('Using VS Code commands...');
      execSync(`code --uninstall-extension ${extensionId}`);
      console.log('Extension uninstalled successfully.');
      console.log('Reloading VS Code window...');
      execSync('code --reload-window');
    }
    
    console.log('Operation completed successfully.');
  } catch (error) {
    console.error('Error during uninstall/reload:', error.message);
    console.log(`
Manual uninstall instructions:
1. Open Command Palette (Ctrl+Shift+P or Cmd+Shift+P)
2. Type "Extensions: Uninstall Extension"
3. Select "${extensionName}" from the list
4. Reload the window manually
`);
    process.exit(1);
  }
}

// Run the script
uninstallAndReload(); 