import * as assert from 'assert';
import { suite, test } from 'mocha';
import { GitDiffReader } from '../../gitDiffReader';
import * as sinon from 'sinon';
import * as childProcess from 'child_process';

suite('GitDiffReader Tests', () => {
  test('getDiff should return the git diff output', async () => {
    // Arrange
    const expectedDiff = 'sample git diff output';
    const execStub = sinon.stub(childProcess, 'exec').callsFake((cmd: string, callback: any) => {
      callback(null, expectedDiff, '');
      return {} as childProcess.ChildProcess;
    });
    
    const gitDiffReader = new GitDiffReader();
    
    try {
      // Act
      const result = await gitDiffReader.getDiff();
      
      // Assert
      assert.strictEqual(result, expectedDiff);
      assert.strictEqual(execStub.called, true);
      const callArgs = execStub.firstCall.args[0];
      assert.strictEqual(callArgs, 'git diff');
    } finally {
      execStub.restore();
    }
  });
  
  test('getDiff should throw an error if git command fails', async () => {
    // Arrange
    const expectedError = new Error('git command failed');
    const execStub = sinon.stub(childProcess, 'exec').callsFake((cmd: string, callback: any) => {
      callback(expectedError, '', 'error output');
      return {} as childProcess.ChildProcess;
    });
    
    const gitDiffReader = new GitDiffReader();
    
    try {
      // Act & Assert
      await assert.rejects(
        async () => await gitDiffReader.getDiff(),
        (err: Error) => {
          assert.strictEqual(err.message, 'Failed to get git diff: git command failed');
          return true;
        }
      );
      assert.strictEqual(execStub.called, true);
    } finally {
      execStub.restore();
    }
  });
}); 