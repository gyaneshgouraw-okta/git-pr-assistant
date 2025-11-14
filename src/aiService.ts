/**
 * Interface for all AI providers
 * This interface defines the contract that all AI service implementations must follow
 */
export interface AIProvider {
  generatePRDescription(gitDiff: string, template: string): Promise<string>;
} 