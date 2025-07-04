/* istanbul ignore file */
import { FileManager, FileType } from './file-manager.js';
import path from 'path';

export class SeedManager {
  private static fileManager: FileManager;

  /**
   * Initialize the SeedManager with a custom storage path
   */
  static initialize(storagePath: string = '.storage'): void {
    // Convert relative path to absolute path based on process execution directory
    // const absoluteStoragePath = path.resolve(process.cwd(), storagePath);

    this.fileManager = FileManager.getInstance({
      dirMode: 0o700,  // More restrictive for seed directories
      fileMode: 0o600  // More restrictive for seed files
    });
  }

  /**
   * Initialize the seed storage for an agent
   */
  static async initializeAgentSeed(agentId: string, seed: string): Promise<void> {
    if (!this.fileManager) {
      this.initialize();
    }
    this.fileManager.writeFile(FileType.SEED, agentId, seed, 'seed');
  }

  /**
   * Get the seed for an agent
   */
  static getAgentSeed(agentId: string): string {
    if (!this.fileManager) {
      this.initialize();
    }
    if (!this.fileManager.fileExists(FileType.SEED, agentId, 'seed')) {
      throw new Error(`No seed found for agent ${agentId}`);
    }
    return this.fileManager.readFile(FileType.SEED, agentId, 'seed');
  }

  /**
   * Verify if an agent has a seed
   */
  static hasAgentSeed(agentId: string): boolean {
    if (!this.fileManager) {
      this.initialize();
    }
    return this.fileManager.fileExists(FileType.SEED, agentId, 'seed');
  }

  /**
   * Remove an agent's seed
   */
  static removeAgentSeed(agentId: string): void {
    if (!this.fileManager) {
      this.initialize();
    }
    if (this.fileManager.fileExists(FileType.SEED, agentId, 'seed')) {
      this.fileManager.deleteFile(FileType.SEED, agentId, 'seed');
    }
  }
} 