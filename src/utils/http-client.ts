/* istanbul ignore file */
import { config } from '../config.js';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class HttpClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `http://${config.walletServerHost}:${config.walletServerPort}`;
  }

  private async request<T>(
    method: string,
    path: string,
    data?: any
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      const responseData = await response.json() as T;

      if (!response.ok) {
        throw new HttpError(
          response.status,
          (responseData as any).message || 'HTTP request failed',
          responseData
        );
      }

      return responseData;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(
        500,
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, data: any): Promise<T> {
    return this.request<T>('POST', path, data);
  }
}

// Export a singleton instance
export const httpClient = new HttpClient(); 