import * as assert from 'assert';
import { suite, test } from 'mocha';
import { AIService } from '../../aiService';
import * as sinon from 'sinon';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

suite('AIService Tests', () => {
  let aiService: AIService;
  let mockBedrockClient: BedrockRuntimeClient;
  
  setup(() => {
    // Create a mock BedrockRuntimeClient
    mockBedrockClient = {
      send: sinon.stub().resolves({
        body: new TextEncoder().encode(JSON.stringify({
          completion: 'Generated PR description'
        }))
      })
    } as unknown as BedrockRuntimeClient;
    
    aiService = new AIService('test-region', 'test-access-key', 'test-secret-key', mockBedrockClient);
  });
  
  teardown(() => {
    sinon.restore();
  });
  
  test('generatePRDescription should call AWS Bedrock with correct parameters', async () => {
    // Arrange
    const gitDiff = 'test git diff';
    const template = 'test template';
    
    // Act
    const result = await aiService.generatePRDescription(gitDiff, template);
    
    // Assert
    assert.strictEqual(result, 'Generated PR description');
    assert.strictEqual((mockBedrockClient.send as sinon.SinonStub).calledOnce, true);
    
    const sentCommand = (mockBedrockClient.send as sinon.SinonStub).firstCall.args[0];
    assert.strictEqual(sentCommand instanceof InvokeModelCommand, true);
    
    // Verify the correct model ID is used
    assert.strictEqual(sentCommand.input.modelId, 'anthropic.claude-v2');
    
    // Verify the prompt includes the git diff and template
    const body = JSON.parse(new TextDecoder().decode(sentCommand.input.body as Uint8Array));
    assert.strictEqual(body.prompt.includes(gitDiff), true);
    assert.strictEqual(body.prompt.includes(template), true);
  });
  
  test('generatePRDescription should handle errors from AWS Bedrock', async () => {
    // Arrange
    const expectedError = new Error('AWS Bedrock error');
    (mockBedrockClient.send as sinon.SinonStub).rejects(expectedError);
    
    // Act & Assert
    await assert.rejects(
      async () => await aiService.generatePRDescription('git diff', 'template'),
      (err: Error) => {
        assert.strictEqual(err.message, 'Failed to generate PR description: AWS Bedrock error');
        return true;
      }
    );
  });
}); 