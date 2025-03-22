import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitDiffReader {
  /**
   * Get the git diff from the current working directory
   * @returns Promise with the git diff output
   */
  async getDiff(): Promise<string> {
    try {
      const { stdout } = await execAsync('git diff');
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get git diff: ${(error as Error).message}`);
    }
  }
} 