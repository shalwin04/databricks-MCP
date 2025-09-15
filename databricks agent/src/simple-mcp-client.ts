import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import * as dotenv from 'dotenv';

dotenv.config();

export class SimpleMCPClient {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;

  constructor(private serverUrl: string = process.env.MCP_SERVER_URL || 'http://localhost:4000/sse') {
    console.log(`MCP client connecting to: ${this.serverUrl}`);
  }

  async connect(): Promise<void> {
    try {
      // Use default options for SSEClientTransport (GET is default)
      this.transport = new SSEClientTransport(new URL(this.serverUrl), { 
        timeout: 120000 // Increase timeout to 2 minutes
      });
      
      this.client = new Client(
        {
          name: 'databricks-agent-client',
          version: '0.1.0', // Match server version
        },
        {
          capabilities: {
            tools: {} // Explicitly specify tools capability
          },
        }
      );

      await this.client.connect(this.transport);
      console.log('Connected to MCP server successfully');

      const toolsResult = await this.client.listTools();
      console.log('Available tools:', toolsResult.tools.map(t => t.name));

    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    console.log('Disconnected from MCP server');
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    if (!this.client) {
      throw new Error('MCP client not connected. Call connect() first.');
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: args,
      });
      return result;
    } catch (error) {
      console.error(`Error calling tool ${name}:`, error);
      throw error;
    }
  }

  get isConnected(): boolean {
    return this.client !== null && this.transport !== null;
  }
}
