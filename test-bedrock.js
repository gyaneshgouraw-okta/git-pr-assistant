// Test script for AWS Bedrock integration using AWS SDK
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
const AWS = require('aws-sdk');

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
    console.log('Initializing AWS Bedrock client...');
    
    // Configure the AWS Bedrock environment variables
    process.env.AWS_ACCESS_KEY_ID = accessKeyId;
    process.env.AWS_SECRET_ACCESS_KEY = secretAccessKey;
    process.env.AWS_REGION = region;
    if (sessionToken) {
      process.env.AWS_SESSION_TOKEN = sessionToken;
    }
    
    // Configure AWS credentials
    AWS.config.update({
      region: region,
      credentials: new AWS.Credentials({
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
        sessionToken: sessionToken
      })
    });
    
    // Create Bedrock Runtime client
    const bedrockRuntime = new AWS.BedrockRuntime();
    
    // Focus on just the most likely available models
    const CLAUDE_MODELS = [
      'anthropic.claude-3-5-sonnet-20241022-v2:0'
    ];
    
    // Prepare the prompt for Claude model
    console.log('Preparing prompt for Claude model...');
    const prompt = `
You are a helpful AI assistant. Your task is to create a detailed pull request (PR) description based on the git diff provided below.

Below is a git diff showing code changes:
\`\`\`
${diff}
\`\`\`

Please create a comprehensive PR description following this template:
${template}

The description should:
1. Summarize the changes clearly
2. List the most important changes and their impact
3. Explain any testing that was done or should be done
4. Note any visual changes if applicable

Please be technical, precise, and focus on the actual code changes in the diff.
`;
    
    // Try each Claude model until one works
    let lastError = null;
    
    for (const MODEL_ID of CLAUDE_MODELS) {
      try {
        console.log(`Trying with model: ${MODEL_ID}`);
        
        console.log('Calling AWS Bedrock using AWS SDK...');
        
        // Claude 3.5 specific request format
        const requestBody = {
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          temperature: 0.7,
          top_p: 0.9,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        };
        
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        // Invoke the model
        const response = await bedrockRuntime.invokeModel({
          modelId: MODEL_ID,
          contentType: 'application/json',
          accept: 'application/json',
          body: JSON.stringify(requestBody)
        }).promise();
        
        // Parse the response
        const responseBody = JSON.parse(response.body.toString());
        console.log('Response:', JSON.stringify(responseBody, null, 2));
        
        // Extract the generated text
        let prDescription = '';
        if (responseBody.content && Array.isArray(responseBody.content)) {
          // Modern Claude 3.x format
          prDescription = responseBody.content[0].text;
        } else if (responseBody.completion) {
          // Older Claude format
          prDescription = responseBody.completion;
        } else {
          // Fallback if neither format is found
          prDescription = JSON.stringify(responseBody);
        }
        
        console.log('\n----- GENERATED PR DESCRIPTION -----\n');
        console.log(prDescription);
        console.log('\n----- END OF PR DESCRIPTION -----\n');
        
        return prDescription;
      } catch (error) {
        console.error(`Error with model ${MODEL_ID}:`, error);
        lastError = error;
        // Continue trying with the next model
      }
    }
    
    // If we reach here, all models failed
    throw new Error(`Failed to generate PR description with any Claude model: ${lastError?.message}`);
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