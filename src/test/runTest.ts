import * as path from 'path';
import * as vscode from 'vscode-test';

async function main() {
  try {
    // Disable SSL certificate validation for testing purposes
    // WARNING: This should only be used for testing, not in production
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    console.log('Running tests from:', extensionTestsPath);
    
    // Download VS Code, unzip it and run the tests
    await vscode.runTests({
      extensionDevelopmentPath,
      extensionTestsPath
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main(); 