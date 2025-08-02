#!/usr/bin/env tsx

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestSuite {
  name: string;
  command: string;
  args: string[];
  timeout: number;
  description: string;
}

interface TestResult {
  suiteName: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

class FullE2ETestRunner {
  private results: TestResult[] = [];
  private testAgentId = 'test-agent-e2e-full';
  private testSeedPath: string;

  constructor() {
    this.testSeedPath = path.join(__dirname, '../.storage/seeds', `${this.testAgentId}.seed`);
  }

  async setupTestEnvironment(): Promise<void> {
    console.log('🚀 Setting up comprehensive E2E test environment...');
    
    // Create test seed file
    await fs.mkdir(path.dirname(this.testSeedPath), { recursive: true });
    await fs.writeFile(this.testSeedPath, 'test-seed-for-e2e-full-testing-only');
    
    console.log('✅ Test environment setup completed');
  }

  async runTestSuite(suite: TestSuite): Promise<TestResult> {
    console.log(`\n🎯 Running test suite: ${suite.name}`);
    console.log(`📝 Description: ${suite.description}`);
    
    const startTime = Date.now();
    
    try {
      const output = await this.executeCommand(suite.command, suite.args, suite.timeout);
      const duration = Date.now() - startTime;
      
      console.log(`✅ Test suite passed: ${suite.name} (${duration}ms)`);
      return {
        suiteName: suite.name,
        passed: true,
        duration,
        output
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      console.log(`❌ Test suite failed: ${suite.name} (${duration}ms)`);
      console.log(`   Error: ${errorMessage}`);
      
      return {
        suiteName: suite.name,
        passed: false,
        duration,
        output: '',
        error: errorMessage
      };
    }
  }

  private async executeCommand(command: string, args: string[], timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          AGENT_ID: this.testAgentId,
          NODE_ENV: 'test'
        }
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}\nStdout: ${stdout}\nStderr: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        process.kill('SIGTERM');
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      process.on('close', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  async runAllTests(): Promise<void> {
    console.log('🎯 Running comprehensive E2E test suite...');
    
    const testSuites: TestSuite[] = [
      {
        name: 'Unit Tests',
        command: 'yarn',
        args: ['test:unit'],
        timeout: 60000,
        description: 'Run all unit tests to ensure core functionality works'
      },
      {
        name: 'Integration Tests',
        command: 'yarn',
        args: ['test:integration'],
        timeout: 120000,
        description: 'Run integration tests with mock services'
      },
      {
        name: 'Jest E2E Tests',
        command: 'yarn',
        args: ['test:e2e'],
        timeout: 180000,
        description: 'Run comprehensive E2E tests using Jest and MCP SDK'
      },
      {
        name: 'STDIO Protocol Tests',
        command: 'tsx',
        args: ['scripts/test-e2e-stdio.ts'],
        timeout: 120000,
        description: 'Test STDIO interface directly using JSON-RPC'
      }
    ];

    console.log(`\n📋 Test Plan: ${testSuites.length} test suites`);
    testSuites.forEach((suite, index) => {
      console.log(`  ${index + 1}. ${suite.name} - ${suite.description}`);
    });

    for (const suite of testSuites) {
      const result = await this.runTestSuite(suite);
      this.results.push(result);
    }
  }

  async runHealthCheck(): Promise<void> {
    console.log('\n🏥 Running system health check...');
    
    const healthChecks = [
      {
        name: 'Node.js Version',
        command: 'node',
        args: ['--version'],
        timeout: 5000,
        description: 'Check Node.js version'
      },
      {
        name: 'TypeScript Compilation',
        command: 'yarn',
        args: ['build:mcp'],
        timeout: 60000,
        description: 'Ensure TypeScript compiles without errors'
      },
      {
        name: 'Dependencies Check',
        command: 'yarn',
        args: ['check'],
        timeout: 30000,
        description: 'Verify all dependencies are properly installed'
      }
    ];

    for (const check of healthChecks) {
      const result = await this.runTestSuite(check);
      this.results.push(result);
    }
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test environment...');
    
    // Clean up test seed file
    try {
      await fs.unlink(this.testSeedPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
    
    console.log('✅ Cleanup completed');
  }

  printResults(): void {
    console.log('\n📊 Comprehensive E2E Test Results:');
    console.log('=' .repeat(60));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`Total test suites: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`Average duration: ${Math.round(totalDuration / this.results.length)}ms`);
    
    if (failed > 0) {
      console.log('\n❌ Failed test suites:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.suiteName}: ${result.error}`);
      });
    }
    
    console.log('\n📋 Detailed Results:');
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const duration = result.duration > 1000 ? `${Math.round(result.duration / 1000)}s` : `${result.duration}ms`;
      console.log(`  ${status} ${result.suiteName} (${duration})`);
    });

    // Print performance summary
    console.log('\n⚡ Performance Summary:');
    const sortedResults = [...this.results].sort((a, b) => b.duration - a.duration);
    sortedResults.slice(0, 3).forEach((result, index) => {
      const duration = result.duration > 1000 ? `${Math.round(result.duration / 1000)}s` : `${result.duration}ms`;
      console.log(`  ${index + 1}. ${result.suiteName}: ${duration}`);
    });
  }

  generateReport(): void {
    console.log('\n📄 Generating test report...');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
        totalDuration: this.results.reduce((sum, r) => sum + r.duration, 0)
      },
      results: this.results.map(result => ({
        suiteName: result.suiteName,
        passed: result.passed,
        duration: result.duration,
        error: result.error
      }))
    };

    const reportPath = path.join(__dirname, '../test-results', 'e2e-full-report.json');
    
    fs.mkdir(path.dirname(reportPath), { recursive: true })
      .then(() => fs.writeFile(reportPath, JSON.stringify(report, null, 2)))
      .then(() => console.log(`✅ Test report saved to: ${reportPath}`))
      .catch(error => console.error('❌ Failed to save test report:', error));
  }
}

async function main(): Promise<void> {
  const runner = new FullE2ETestRunner();
  
  try {
    console.log('🚀 Starting comprehensive E2E test execution...');
    console.log('=' .repeat(60));
    
    await runner.setupTestEnvironment();
    await runner.runHealthCheck();
    await runner.runAllTests();
    
    runner.printResults();
    runner.generateReport();
    
    const failedTests = runner.results.filter(r => !r.passed).length;
    if (failedTests > 0) {
      console.log(`\n❌ ${failedTests} test suites failed`);
      console.log('💡 Check the detailed output above for debugging information');
      process.exit(1);
    } else {
      console.log('\n✅ All test suites passed!');
      console.log('🎉 Your MCP server is ready for production!');
      process.exit(0);
    }
  } catch (error) {
    console.error('💥 E2E test execution failed:', error);
    process.exit(1);
  } finally {
    await runner.cleanup();
  }
}

// Run the tests
main().catch(console.error); 