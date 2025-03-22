/**
 * Mock for VS Code API used in tests
 */

// Mock function creator
const createMockFunction = () => {
  const fn = () => undefined;
  fn.mockImplementation = (implementation: Function) => {
    return (...args: any[]) => implementation(...args);
  };
  fn.calls = [] as any[][];
  fn.mockClear = () => { fn.calls = []; };
  return fn;
};

// Create a mock workspace
export const workspace = {
  getConfiguration: () => ({
    get: (key: string) => {
      if (key === 'defaultPRTemplate') {
        return '## Summary\n\n## Changes\n\n## Testing\n\n## Screenshots\n\n';
      }
      return '';
    }
  })
};

// Create a mock window
export const window = {
  showInformationMessage: createMockFunction(),
  showErrorMessage: createMockFunction(),
  showTextDocument: createMockFunction(),
  withProgress: (...args: any[]) => {
    const [_, callback] = args;
    return callback();
  }
};

// Create a mock commands
export const commands = {
  registerCommand: createMockFunction()
};

// Create a mock ExtensionContext
export interface ExtensionContext {
  subscriptions: Array<{ dispose(): any }>;
  workspaceState: any;
  globalState: {
    get<T>(key: string): T | undefined;
    update(key: string, value: any): Thenable<void>;
  };
  extensionPath: string;
  asAbsolutePath(relativePath: string): string;
}

// Create a mock ProgressLocation
export enum ProgressLocation {
  Notification = 1
}

// Export everything
export default {
  workspace,
  window,
  commands,
  ProgressLocation
}; 