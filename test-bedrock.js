// Test script for AWS Bedrock integration using Vercel AI SDK
// Usage: 
// 1. Add your AWS credentials to the .env file
// 2. Run: node test-bedrock.js [optional-diff-file-path]
// 3. Or just run: node test-bedrock.js --git (to use uncommitted changes)

// Load environment variables from .env file
require('dotenv').config();

// Required for AWS4Fetch
global.crypto = require('crypto');

const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);

// Import the Vercel AI SDK
const { bedrock } = require('@ai-sdk/amazon-bedrock');
const ai = require('ai');

// Read AWS credentials from .env file
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || 'us-east-1';
const sessionToken = process.env.AWS_SESSION_TOKEN;
const diffFilePath = process.env.DIFF_FILE_PATH || process.argv[2]; // Command line arg takes precedence
const useGitChanges = diffFilePath === '--git' || process.env.USE_GIT_CHANGES === 'true';

// Check if credentials are available
if (!accessKeyId || !secretAccessKey) {
  console.error('AWS credentials not found in .env file.');
  console.error('Please add your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to the .env file.');
  process.exit(1);
}

// Sample PR template
const template = `## Summary

## Changes

## Testing

## Screenshots
`;

async function generatePRDescription(diff, template) {
  try {
    console.log('Initializing AWS Bedrock client with Vercel AI SDK...');
    
    // Set environment variables for the Bedrock SDK to use
    process.env.AWS_ACCESS_KEY_ID = accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
    process.env.AWS_REGION = region;
    if (sessionToken) {
      process.env.AWS_SESSION_TOKEN = sessionToken;
    }
    
    // Model ID to use
    const MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    
    console.log(`Using model: ${MODEL_ID}`);
    console.log('Generating PR description...');
    
    // Use the Vercel AI SDK generateText function
    const { text: generatedText } = await ai.generateText({
      model: bedrock(MODEL_ID),
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that writes clear, concise pull request descriptions based on git diffs.'
        },
        {
          role: 'user',
          content: `I need you to create a pull request description based on the following git diff.
Use the template provided below to structure your response.

GIT DIFF:
\`\`\`
${diff}
\`\`\`

TEMPLATE:
\`\`\`
${template}
\`\`\`

Please fill in the template with details about the changes in the git diff. Be concise and clear about the purpose of the changes, what was modified, and any important details reviewers should know.

Don't include the template markers (like "## Summary") in places they don't belong, and maintain the overall structure of the template. Complete sentences are preferred.`
        }
      ],
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 2000
    });

    console.log('\n----- GENERATED PR DESCRIPTION -----\n');
    console.log(generatedText);
    console.log('\n----- END OF PR DESCRIPTION -----\n');
    
    return generatedText;
  } catch (error) {
    console.error('Error generating PR description:', error);
    throw error;
  }
}

// Get git diff for uncommitted changes (both staged and unstaged)
async function getGitDiff() {
  try {
    console.log('Getting uncommitted changes from git...');
    
    // Get unstaged changes
    const { stdout: unstagedDiff } = await execPromise('git diff');
    
    // Get staged changes
    const { stdout: stagedDiff } = await execPromise('git diff --staged');
    
    // Combine both diffs
    const combinedDiff = unstagedDiff + stagedDiff;
    
    if (!combinedDiff.trim()) {
      console.warn('No uncommitted changes found in the repository.');
      return null;
    }
    
    return combinedDiff;
  } catch (error) {
    console.error('Error getting git diff:', error);
    return null;
  }
}

// Get diff from file, git changes, or use sample diff
async function getDiff() {
  // First priority: Use git changes if explicitly requested
  if (useGitChanges) {
    console.log('Using uncommitted git changes...');
    const gitDiff = await getGitDiff();
    if (gitDiff) {
      return gitDiff;
    }
    console.log('No git changes found, falling back to alternatives...');
  }
  
  // Second priority: Check for file path
  if (diffFilePath && diffFilePath !== '--git' && fs.existsSync(diffFilePath)) {
    console.log(`Reading diff from file: ${diffFilePath}`);
    return fs.readFileSync(diffFilePath, 'utf8');
  }
  
  // Last resort: Use sample diff
  console.log('Using sample diff (no file provided or git changes found)');
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

// Main function
async function main() {
  try {
    console.log('Using AWS credentials from .env file');
    console.log(`Region: ${region}`);
    
    const diff = await getDiff();
    await generatePRDescription(diff, template);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

main();