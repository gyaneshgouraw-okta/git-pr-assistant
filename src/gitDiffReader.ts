import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitDiffReader {
  /**
   * Get the git diff based on the configured source (staged changes or recent commits)
   * @param diffSource Source of the diff: 'staged' or 'commits'
   * @param commitCount Number of recent commits to include when source is 'commits'
   * @returns Promise with the git diff output or null if no changes detected
   */
  async getDiff(diffSource: string = 'staged', commitCount: number = 1): Promise<string | null> {
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
    
      console.log(`Getting git diff with source: ${diffSource}, commit count: ${commitCount}`);
      
      let diff = '';
      
      if (diffSource === 'commits') {
        // Get diff for the specified number of commits only
        diff = await this.getCommitDiff(commitCount).catch(err => {
          console.log('Failed to get commit diff:', err.message);
          return '';
        });
        console.log(`Commit diff length: ${diff.length}`);
      } else {
        // For staged source, combine staged and unstaged changes
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
        
        // Combine both diffs for staged source
        diff = unstagedDiff + stagedDiff;
      }
      
      console.log(`Diff length: ${diff.length}, trimmed length: ${diff.trim().length}`);
      
      if (diff.trim()) {
        console.log('Returning diff');
        return diff;
      }
      
      // If no diff is available, return null
      console.log('No git diff available. Returning null.');
      return null;
    } catch (error) {
      console.error('Error in getDiff:', (error as Error).message);
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
   * Get diff for a specific number of recent commits
   * @param count Number of recent commits to include in the diff
   */
  private async getCommitDiff(count: number): Promise<string> {
    try {
      console.log(`Running git diff for last ${count} commits...`);
      
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
      
      // Create the command to get diffs for the specified number of commits
      // HEAD~N..HEAD gets the diff between N commits ago and current HEAD
      const command = count === 1 
        ? 'git show HEAD --patch'  // For single commit, use git show which is more detailed
        : `git diff HEAD~${count}..HEAD`;  // For multiple commits
      
      console.log(`Executing command: ${command}`);
      const { stdout } = await execAsync(command, { cwd });
      console.log(`Commit diff command returned ${stdout.length} characters`);
      return stdout;
    } catch (error) {
      console.error('Error in getCommitDiff:', (error as Error).message);
      throw new Error(`Failed to get commit diff: ${(error as Error).message}`);
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