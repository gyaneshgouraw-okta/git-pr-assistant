import * as assert from 'assert';
import { suite, test } from 'mocha';
import { TemplateManager, TemplateSource } from '../../templateManager';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

suite('TemplateManager Tests', () => {
  let templateManager: TemplateManager;
  let mockContext: vscode.ExtensionContext;
  const defaultTemplate = '## Summary\n\n## Changes\n\n## Testing\n\n## Screenshots\n\n';
  
  setup(() => {
    // Create a mock VS Code extension context
    mockContext = {
      globalState: {
        get: sinon.stub().returns(undefined),
        update: sinon.stub().resolves(undefined)
      }
    } as unknown as vscode.ExtensionContext;
    
    // Create a stub for VS Code workspace configurations
    const getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration');
    const mockConfiguration = {
      get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
        if (key === 'defaultTemplate') {
          return defaultTemplate;
        }
        if (key === 'templateSource') {
          return defaultValue || TemplateSource.Repository;
        }
        return defaultValue || undefined;
      })
    };
    getConfigurationStub.returns(mockConfiguration as any);
    
    templateManager = new TemplateManager(mockContext);
  });
  
  teardown(() => {
    sinon.restore();
  });
  
  test('getTemplate should return the default template if no custom template exists', async () => {
    // Act
    const template = await templateManager.getTemplate();
    
    // Assert
    assert.strictEqual(template, defaultTemplate);
    assert.strictEqual((mockContext.globalState.get as sinon.SinonStub).calledOnce, true);
  });
  
  test('getTemplate should return the custom template if it exists', async () => {
    // Arrange
    const customTemplate = 'Custom PR Template';
    (mockContext.globalState.get as sinon.SinonStub).returns(customTemplate);
    
    // Act
    const template = await templateManager.getTemplate();
    
    // Assert
    assert.strictEqual(template, customTemplate);
    assert.strictEqual((mockContext.globalState.get as sinon.SinonStub).calledOnce, true);
  });
  
  test('saveCustomTemplate should save the template to global state', async () => {
    // Arrange
    const newTemplate = 'New PR Template';
    
    // Act
    templateManager.saveCustomTemplate(newTemplate);
    
    // Assert
    assert.strictEqual((mockContext.globalState.update as sinon.SinonStub).calledOnce, true);
    assert.strictEqual(
      (mockContext.globalState.update as sinon.SinonStub).firstCall.args[0],
      'prTemplate'
    );
    assert.strictEqual(
      (mockContext.globalState.update as sinon.SinonStub).firstCall.args[1],
      newTemplate
    );
  });
}); 