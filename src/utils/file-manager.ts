/* istanbul ignore file */
import fs from 'fs';
import path from 'path';

/**
 * File types that can be managed by the FileManager
 */
export enum FileType {
  SEED = 'seed',
  WALLET_BACKUP = 'wallet-backup',
  LOG = 'log',
  TRANSACTION_DB = 'transaction-db'
}

/**
 * Configuration for file operations
 */
export interface FileConfig {
  /**
   * Base directory for all files
   * @default '.storage'
   */
  baseDir?: string;
  
  /**
   * Whether to create directories if they don't exist
   * @default true
   */
  createDirs?: boolean;
  
  /**
   * File permissions for directories
   * @default 0o755
   */
  dirMode?: number;
  
  /**
   * File permissions for files
   * @default 0o644
   */
  fileMode?: number;
  
  /**
   * Whether to use agent-specific subdirectories
   * @default true
   */
  useAgentSubdirs?: boolean;
}

/**
 * Manages file operations and paths for different types of files
 */
export class FileManager {
  private static instance: FileManager | undefined;
  private config: Required<FileConfig>;
  
  private constructor(config: FileConfig = {}) {
    // Convert relative path to absolute path based on process execution directory
    const baseDir = config.baseDir || '.storage';
    const absoluteBaseDir = path.isAbsolute(baseDir) 
      ? baseDir 
      : path.resolve(process.cwd(), baseDir);

    this.config = {
      baseDir: absoluteBaseDir,
      createDirs: config.createDirs ?? true,
      dirMode: config.dirMode || 0o755,
      fileMode: config.fileMode || 0o644,
      useAgentSubdirs: config.useAgentSubdirs ?? true
    };
  }
  
  /**
   * Get the singleton instance of FileManager
   */
  public static getInstance(config?: FileConfig): FileManager {
    if (!FileManager.instance) {
      FileManager.instance = new FileManager(config);
    }
    return FileManager.instance;
  }

  public static resetInstance(): void {
    FileManager.instance = undefined;
  }
  
  /**
   * Get the path for a specific file type and agent
   */
  public getPath(fileType: FileType, agentId: string, filename?: string): string {
    const typeDir = this.getTypeDirectory(fileType);
    const agentDir = this.config.useAgentSubdirs ? path.join(typeDir, agentId) : typeDir;
    
    if (filename) {
      return path.join(agentDir, filename);
    }
    
    return agentDir;
  }
  
  /**
   * Get the directory for a specific file type
   */
  private getTypeDirectory(fileType: FileType): string {
    const typeDirs: Record<FileType, string> = {
      [FileType.SEED]: 'seeds',
      [FileType.WALLET_BACKUP]: 'wallet-backups',
      [FileType.LOG]: 'logs',
      [FileType.TRANSACTION_DB]: 'transaction-db'
    };
    
    return path.join(this.config.baseDir, typeDirs[fileType]);
  }
  
  /**
   * Ensure a directory exists
   */
  public ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      if (this.config.createDirs) {
        fs.mkdirSync(dirPath, { recursive: true, mode: this.config.dirMode });
      } else {
        throw new Error(`Directory does not exist: ${dirPath}`);
      }
    }
  }
  
  /**
   * Write data to a file
   */
  public writeFile(fileType: FileType, agentId: string, data: string | Buffer, filename: string): void {
    const filePath = this.getPath(fileType, agentId, filename);
    const dirPath = path.dirname(filePath);
    
    this.ensureDirectoryExists(dirPath);
    fs.writeFileSync(filePath, data, { mode: this.config.fileMode });
  }
  
  /**
   * Read data from a file
   */
  public readFile(fileType: FileType, agentId: string, filename: string): string {
    const filePath = this.getPath(fileType, agentId, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    return fs.readFileSync(filePath, 'utf-8');
  }
  
  /**
   * Check if a file exists
   */
  public fileExists(fileType: FileType, agentId: string, filename: string): boolean {
    const filePath = this.getPath(fileType, agentId, filename);
    return fs.existsSync(filePath);
  }
  
  /**
   * Delete a file
   */
  public deleteFile(fileType: FileType, agentId: string, filename: string): void {
    const filePath = this.getPath(fileType, agentId, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
  
  /**
   * List files in a directory
   */
  public listFiles(fileType: FileType, agentId: string): string[] {
    const dirPath = this.getPath(fileType, agentId);
    
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    
    return fs.readdirSync(dirPath);
  }
  
  /**
   * Get file stats
   */
  public getFileStats(fileType: FileType, agentId: string, filename: string): fs.Stats {
    const filePath = this.getPath(fileType, agentId, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    return fs.statSync(filePath);
  }
  
  /**
   * Create a read stream for a file
   */
  public createReadStream(fileType: FileType, agentId: string, filename: string): fs.ReadStream {
    const filePath = this.getPath(fileType, agentId, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    return fs.createReadStream(filePath);
  }
  
  /**
   * Create a write stream for a file
   */
  public createWriteStream(fileType: FileType, agentId: string, filename: string): fs.WriteStream {
    const filePath = this.getPath(fileType, agentId, filename);
    const dirPath = path.dirname(filePath);
    
    this.ensureDirectoryExists(dirPath);
    return fs.createWriteStream(filePath, { mode: this.config.fileMode });
  }
} 