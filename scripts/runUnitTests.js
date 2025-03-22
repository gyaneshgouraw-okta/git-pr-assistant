#!/usr/bin/env node

/**
 * This script runs the unit tests directly without VS Code download
 */

console.log('Setting up mocks for unit tests...');

// Register mocks for various modules
const Module = require('module');
const originalRequire = Module.prototype.require;
const path = require('path');

// Create TextEncoder and TextDecoder mocks for the tests
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Create a mock environment for testing
global.mockEnv = {
  // Create a stub function that can be used in tests
  stub: (obj, method, implementation) => {
    const original = obj[method];
    obj[method] = implementation || function() {};
    obj[method].restore = () => { obj[method] = original; };
    obj[method].callCount = 0;
    obj[method].calls = [];
    obj[method].firstCall = { args: [] };
    
    // Wrap the function to track calls
    const wrapper = obj[method];
    obj[method] = function(...args) {
      wrapper.callCount++;
      wrapper.calls.push(args);
      if (wrapper.callCount === 1) {
        wrapper.firstCall.args = args;
      }
      return wrapper.apply(this, args);
    };
    
    return obj[method];
  }
};

// Override specific modules with mocks
Module.prototype.require = function(modulePath) {
  // Mock the vscode module
  if (modulePath === 'vscode') {
    console.log('Mocking vscode module');
    return {
      workspace: {
        getConfiguration: () => ({
          get: (key) => {
            if (key === 'defaultPRTemplate') {
              return '## Summary\n\n## Changes\n\n## Testing\n\n## Screenshots\n\n';
            }
            return '';
          }
        })
      },
      window: {
        showInformationMessage: () => {},
        showErrorMessage: () => {},
        showTextDocument: () => {},
        withProgress: (_, callback) => callback()
      },
      commands: {
        registerCommand: () => ({})
      },
      ProgressLocation: {
        Notification: 1
      },
      ExtensionContext: class {}
    };
  }
  
  // Mock child_process for the GitDiffReader tests
  if (modulePath === 'child_process') {
    console.log('Mocking child_process module');
    return {
      exec: function(cmd, callback) {
        // Allow this to be stubbed by sinon
        return {};
      }
    };
  }
  
  // Mock AWS SDK for the AIService tests
  if (modulePath === '@aws-sdk/client-bedrock-runtime') {
    console.log('Mocking AWS Bedrock module');
    return {
      BedrockRuntimeClient: class {
        constructor() {}
        send() {
          return {
            body: Buffer.from(JSON.stringify({ completion: 'Generated PR description' }))
          };
        }
      },
      InvokeModelCommand: class {
        constructor(params) {
          this.input = params;
        }
      }
    };
  }
  
  return originalRequire.call(this, modulePath);
};

// Get test files from argument or use default pattern
const testFiles = process.argv.slice(2);
if (testFiles.length === 0) {
  console.log('No test files specified, using default pattern');
  // Use compiled JS test files by default
  testFiles.push('./out/test/suite/**/*.test.js');
}

// Set up Mocha with proper arguments
const mochaArgs = [
  '--ui', 'tdd',
  '--colors',
  '--timeout', '10000'
].concat(testFiles);

// Override process.argv to pass arguments to Mocha
process.argv = [process.argv[0], process.argv[1], ...mochaArgs];

// Run the Mocha tests directly
console.log(`Running tests: ${testFiles.join(', ')}`);
require('mocha/bin/mocha'); 