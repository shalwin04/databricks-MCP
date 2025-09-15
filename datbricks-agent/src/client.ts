// import { Client } from '@modelcontextprotocol/sdk/client/index.js';
// import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
// import {
//   CallToolResult,
//   ListToolsResult,
//   Tool,
// } from '@modelcontextprotocol/sdk/types.js';
// import axios from 'axios';
// import dotenv from 'dotenv';

// dotenv.config();

// export interface MCPToolResult {
//   content: {
//     type: 'text';
//     text: string;
//   }[];
//   isError?: boolean;
// }

// export class DatabricksMCPClient {
//   private client: Client | null = null;
//   private transport: SSEClientTransport | null = null;
//   private availableTools: Tool[] = [];
//   private _isConnected = false;

//   constructor(
//     private serverUrl: string = process.env.MCP_SERVER_URL || 'http://localhost:4000/mcp',
//     private databricksToken: string = process.env.DATABRICKS_TOKEN || ''
//   ) {}

//   get connected(): boolean {
//     return this._isConnected;
//   }

//   /**
//    * Connects to the MCP server
//    */
//   async connect(): Promise<void> {
//     try {
//       console.log('Connecting to MCP server at:', this.serverUrl);
      
//       this.transport = new SSEClientTransport({
//         serverUrl: this.serverUrl,
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${this.databricksToken}`,
//         },
//       });

//       this.client = new Client(this.transport);
//       await this.client.connect();
//       this._isConnected = true;

//       // Load available tools
//       await this.loadAvailableTools();
      
//       console.log('Successfully connected to MCP server');
//     } catch (error) {
//       console.error('Failed to connect to MCP server:', error);
//       this._isConnected = false;
//       throw error;
//     }
//   }

//   /**
//    * Disconnects from the MCP server
//    */
//   async disconnect(): Promise<void> {
//     if (this.client) {
//       await this.client.close();
//       this.client = null;
//     }
//     if (this.transport) {
//       await this.transport.close();
//       this.transport = null;
//     }
//     this._isConnected = false;
//     this.availableTools = [];
//     console.log('Disconnected from MCP server');
//   }

//   /**
//    * Loads available tools from the MCP server
//    */
//   private async loadAvailableTools(): Promise<void> {
//     if (!this.client || !this._isConnected) {
//       console.warn('Cannot load tools: Client not connected');
//       this.availableTools = [];
//       return;
//     }

//     try {
//       console.log('Requesting available tools from MCP server...');
      
//       const controller = new AbortController();
//       const timeout = setTimeout(() => {
//         controller.abort();
//       }, 30000); // 30 second timeout

//       try {
//         const toolsResult = await this.client.listTools();
//         this.availableTools = toolsResult.tools || [];
//         console.log(`Loaded ${this.availableTools.length} available tools:`, 
//           this.availableTools.map(t => t.name).join(', '));
//       } catch (error) {
//         console.error('Error during tools listing:', error);
//         this.availableTools = [];
//       } finally {
//         clearTimeout(timeout);
//       }
//     } catch (error) {
//       console.error('Error loading available tools:', error);
//       this.availableTools = [];
//     }
//   }

//   /**
//    * Returns the list of available tools
//    */
//   getAvailableTools(): Tool[] {
//     return this.availableTools;
//   }

//   /**
//    * Checks if the client is connected to the MCP server
//    */
//   async healthCheck(): Promise<boolean> {
//     try {
//       const response = await axios.get(`${this.serverUrl}/health`);
//       return response.status === 200;
//     } catch (error) {
//       console.error('Health check failed:', error);
//       return false;
//     }
//   }

//   /**
//    * Calls a tool on the MCP server
//    */
//   async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
//     if (!this.client) {
//       throw new Error('MCP client not connected');
//     }

//     try {
//       console.log(`Calling tool: ${name} with args:`, args);
//       const result = await this.client.callTool({
//         name,
//         arguments: args,
//       });

//       return {
//         content: Array.isArray(result.content) ? result.content : [],
//         isError: result.isError,
//       };
//     } catch (error) {
//       console.error(`Error calling tool ${name}:`, error);
//       return {
//         content: [
//           {
//             type: 'text',
//             text: `Error calling tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
//           }
//         ],
//         isError: true,
//       };
//     }
//   }
// }