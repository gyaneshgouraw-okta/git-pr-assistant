// Test script for AWS Bedrock integration
// Usage: 
// 1. Set environment variables:
//    export AWS_ACCESS_KEY_ID=your_access_key
//    export AWS_SECRET_ACCESS_KEY=your_secret_key
//    export AWS_REGION=us-east-1
// 2. Create a sample diff file or use the built-in example
// 3. Run: node test-bedrock.js [optional-diff-file-path]

const fs = require('fs');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Read AWS credentials from environment variables
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || 'us-east-1';

// Check if credentials are available
if (!accessKeyId || !secretAccessKey) {
  console.error('AWS credentials not found in environment variables.');
  console.error('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
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
    console.log('Initializing Bedrock client...');
    const client = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

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

    console.log('Calling AWS Bedrock...');
    const input = {
      modelId: 'anthropic.claude-v2',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: prompt,
        max_tokens_to_sample: 4000,
        temperature: 0.7,
        top_p: 0.9,
      }),
    };

    const command = new InvokeModelCommand(input);
    const response = await client.send(command);

    // Parse and print the response
    const responseBody = JSON.parse(Buffer.from(response.body).toString('utf8'));
    const prDescription = responseBody.completion;
    
    console.log('\n----- GENERATED PR DESCRIPTION -----\n');
    console.log(prDescription);
    console.log('\n----- END OF PR DESCRIPTION -----\n');
    
    return prDescription;
  } catch (error) {
    console.error('Error generating PR description:', error);
    throw error;
  }
}

// Get diff from file or use sample diff
async function getDiff() {
  const filePath = process.argv[2]; // Optional command-line argument for diff file
  
  if (filePath && fs.existsSync(filePath)) {
    console.log(`Reading diff from file: ${filePath}`);
    return fs.readFileSync(filePath, 'utf8');
  } else {
    console.log('Using sample diff (no file provided or file not found)');
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

// Main function
async function main() {
  try {
    const diff = await getDiff();
    await generatePRDescription(diff, template);
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

main(); 