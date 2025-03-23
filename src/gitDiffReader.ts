import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitDiffReader {
  /**
   * Get the git diff from the current working directory
   * @returns Promise with the git diff output or null if no changes detected
   */
  async getDiff(): Promise<string | null> {
    try {
      // Log current directory to help with debugging
      try {
        const { stdout: pwd } = await execAsync('pwd');
        console.log('Current working directory:', pwd.trim());
        
        // Also check if we're in a git repository
        const { stdout: gitRoot } = await execAsync('git rev-parse --show-toplevel').catch(e => ({ stdout: 'Not a git repository' }));
        console.log('Git repository root:', gitRoot.trim());
      } catch (e) {
        console.log('Error getting current directory:', (e as Error).message);
      }
    
      // First try to get both staged and unstaged changes
      console.log('Attempting to get git diff...');
      
      // Try to get unstaged changes
      const unstagedDiff = await this.getUnstagedDiff().catch(err => {
        console.log('Failed to get unstaged changes:', err.message);
        return '';
      });
      console.log(`Unstaged diff length: ${unstagedDiff.length}`);
      
      // Try to get staged changes
      const stagedDiff = await this.getStagedDiff().catch(err => {
        console.log('Failed to get staged changes:', err.message);
        return '';
      });
      console.log(`Staged diff length: ${stagedDiff.length}`);
      
      // Combine both diffs
      const combinedDiff = unstagedDiff + stagedDiff;
      console.log(`Combined diff length: ${combinedDiff.length}, trimmed length: ${combinedDiff.trim().length}`);
      
      if (combinedDiff.trim()) {
        console.log('Returning combined diff');
        return combinedDiff;
      }
      
      // If no diff is available, return null instead of a sample diff
      console.log('No git diff available. Returning null.');
      return null;
    } catch (error) {
      console.error('Error in getDiff:', (error as Error).message);
      // Return null instead of a sample diff
      return null;
    }
  }
  
  /**
   * Get unstaged changes
   */
  private async getUnstagedDiff(): Promise<string> {
    try {
      console.log('Running git diff command...');
      
      // Get workspace folder to use as cwd
      let cwd = undefined;
      try {
        if (require('vscode').workspace.workspaceFolders?.length > 0) {
          cwd = require('vscode').workspace.workspaceFolders[0].uri.fsPath;
          console.log('Using workspace folder as cwd:', cwd);
        }
      } catch (e) {
        console.log('Error getting workspace folder:', (e as Error).message);
      }
      
      const { stdout } = await execAsync('git diff', { cwd });
      console.log(`Unstaged diff command returned ${stdout.length} characters`);
      return stdout;
    } catch (error) {
      console.error('Error in getUnstagedDiff:', (error as Error).message);
      throw new Error(`Failed to get unstaged diff: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get staged changes
   */
  private async getStagedDiff(): Promise<string> {
    try {
      console.log('Running git diff --staged command...');
      
      // Get workspace folder to use as cwd
      let cwd = undefined;
      try {
        if (require('vscode').workspace.workspaceFolders?.length > 0) {
          cwd = require('vscode').workspace.workspaceFolders[0].uri.fsPath;
          console.log('Using workspace folder as cwd:', cwd);
        }
      } catch (e) {
        console.log('Error getting workspace folder:', (e as Error).message);
      }
      
      const { stdout } = await execAsync('git diff --staged', { cwd });
      console.log(`Staged diff command returned ${stdout.length} characters`);
      return stdout;
    } catch (error) {
      console.error('Error in getStagedDiff:', (error as Error).message);
      throw new Error(`Failed to get staged diff: ${(error as Error).message}`);
    }
  }
  
  /**
   * Get a sample diff when no git diff is available
   */
  private getSampleDiff(): string {
    return `
diff --git a/src/components/Button.js b/src/components/Button.js
index 1234567..abcdefg 100644
--- a/src/components/Button.js
+++ b/src/components/Button.js
@@ -10,7 +10,7 @@ class Button extends Component {
  
  render() {
    return (
-      <button className="btn" onClick={this.handleClick}>
+      <button className="btn btn-primary" onClick={this.handleClick} aria-label={this.props.label}>
        {this.props.children}
      </button>
    );
@@ -18,6 +18,10 @@ class Button extends Component {
  
  handleClick = (e) => {
    console.log('Button clicked');
+    if (this.props.onClick) {
+      this.props.onClick(e);
+    }
+    
+    this.trackAnalytics('button_click');
  }
}`;
  }
} 