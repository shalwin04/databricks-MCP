import { DatabricksMCPClient } from './mcp-client-new.js';

export class SimpleDatabricksAgent {
  private mcpClient: DatabricksMCPClient;

  constructor(mcpServerUrl?: string) {
    this.mcpClient = new DatabricksMCPClient(mcpServerUrl);
  }

  async initialize(): Promise<void> {
    console.log('Initializing Simple Agent...');
    try {
      await this.mcpClient.connect();
      console.log('Agent initialized successfully!');
    } catch (error) {
      console.error('Error connecting to MCP server:', error);
    }
  }

  async cleanup(): Promise<void> {
    await this.mcpClient.disconnect();
    console.log('Agent cleaned up successfully!');
  }
}