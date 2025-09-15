#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import readline from 'readline';

/**
 * MCP Client for Databricks Server
 * Built following official MCP SDK patterns
 */
export class DatabricksMCPClient {
  private client: Client;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private connected = false;

  constructor(private serverUrl?: string) {
    this.client = new Client(
      {
        name: "databricks-mcp-client",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    try {
      if (this.serverUrl) {
        // HTTP/SSE transport for remote server
        console.log(`Connecting to MCP server at ${this.serverUrl}...`);
        this.transport = new SSEClientTransport(new URL(this.serverUrl));
      } else {
        // Stdio transport for local server
        console.log('Connecting to local MCP server via stdio...');
        this.transport = new StdioClientTransport({
          command: "node",
          args: ["databricks-mcp-server.js"],
        });
      }

      await this.client.connect(this.transport);
      this.connected = true;
      console.log('✅ Connected to MCP server');
      
    } catch (error: any) {
      console.error('❌ Failed to connect to MCP server:', error.message);
      throw error;
    }
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<Tool[]> {
    if (!this.connected) {
      throw new Error('Client not connected. Call connect() first.');
    }

    try {
      const request = {
        method: "tools/list",
        params: {}
      };
      // Pass Tool as the result schema (or ListToolsResult if available)
      const response = await this.client.request(request, Tool);
      return response.tools;
    } catch (error: any) {
      console.error('Failed to list tools:', error.message);
      throw error;
    }
  }

  /**
   * Execute a tool with parameters
   */
  async callTool(name: string, args: Record<string, any> = {}): Promise<CallToolResult> {
    if (!this.connected) {
      throw new Error('Client not connected. Call connect() first.');
    }

    try {
      const request: CallToolRequest = {
        method: "tools/call",
        params: {
          name,
          arguments: args
        }
      };

      console.log(`Calling tool: ${name}`);
      if (Object.keys(args).length > 0) {
        console.log(`Parameters:`, JSON.stringify(args, null, 2));
      }

      const result = await this.client.request(request, CallToolResult);
      return result;
    } catch (error: any) {
      console.error(`Failed to call tool ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Convenience methods for each Databricks tool
   */

  async runNotebook(notebookPath: string, baseParams: Record<string, any> = {}, jobName: string = 'AgentJob') {
    return this.callTool('run_databricks_notebook', {
      notebook_path: notebookPath,
      base_params: baseParams,
      job_name: jobName
    });
  }

  async trainAndRegisterModel(
    modelType: 'shingrix-po' | 'shingrix-ppo' | 'digital-twin' = 'shingrix-po',
    jobName: string = 'DDT-Train-and-Register-Model',
    additionalParams: Record<string, any> = {}
  ) {
    return this.callTool('train_and_register_model', {
      model_type: modelType,
      job_name: jobName,
      additional_params: additionalParams
    });
  }

  async getLatestExperimentRun(experimentId: string) {
    return this.callTool('get_latest_experiment_run', {
      experiment_id: experimentId
    });
  }

  async getModelMetadata(experimentId: string) {
    return this.callTool('get_model_metadata', {
      experiment_id: experimentId
    });
  }

  async getRegisteredModelInfo(modelName: string, ucCatalog: string, ucSchema: string) {
    return this.callTool('get_registered_model_info', {
      model_name: modelName,
      uc_catalog: ucCatalog,
      uc_schema: ucSchema
    });
  }

  async checkJobStatus(jobId: string, runId: string) {
    return this.callTool('check_databricks_job_status', {
      job_id: jobId,
      run_id: runId
    });
  }

  async getRunningJobRuns() {
    return this.callTool('get_latest_running_job_runs');
  }

  async getJobDetails(jobId: string) {
    return this.callTool('get_job_details', {
      job_id: jobId
    });
  }

  async convertEpochToDatetime(epochTimestamp: string) {
    return this.callTool('convert_epoch_to_datetime', {
      epoch_timestamp: epochTimestamp
    });
  }

  async getTrainExperimentInfo(modelType: 'shingrix-po' | 'shingrix-ppo' | 'digital-twin') {
    return this.callTool('get_train_experiment_info', {
      model_type: modelType
    });
  }

  async triggerAzureDevOpsPipeline(
    modelType: string,
    branch: string = 'dev',
    platform: string = 'databricks',
    environment: string = 'dev'
  ) {
    return this.callTool('trigger_azure_devops_pipeline', {
      model_type: modelType,
      branch,
      platform,
      environment
    });
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.connected && this.transport) {
      try {
        await this.client.close();
        this.connected = false;
        console.log('✅ Disconnected from MCP server');
      } catch (error: any) {
        console.error('Error disconnecting:', error.message);
      }
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Interactive CLI for the MCP client
 */
class DatabricksMCPCLI {
  private client: DatabricksMCPClient;
  private rl: readline.Interface;
  private tools: Tool[] = [];

  constructor(serverUrl?: string) {
    this.client = new DatabricksMCPClient(serverUrl);
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start(): Promise<void> {
    console.log('🚀 Databricks MCP Client');
    console.log('========================');

    try {
      // Connect to server
      await this.client.connect();
      
      // Load available tools
      console.log('Loading available tools...');
      this.tools = await this.client.listTools();
      console.log(`✅ Loaded ${this.tools.length} tools`);

      // Show available tools
      this.showTools();

      // Start interactive session
      await this.interactiveSession();

    } catch (error: any) {
      console.error('❌ Failed to start:', error.message);
      process.exit(1);
    }
  }

  private showTools(): void {
    console.log('\n📋 Available tools:');
    this.tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name}`);
      console.log(`     ${tool.description}`);
      if (tool.inputSchema?.properties) {
        const params = Object.keys(tool.inputSchema.properties);
        console.log(`     Parameters: ${params.join(', ')}`);
      }
      console.log('');
    });
  }

  private async interactiveSession(): Promise<void> {
    console.log('🎮 Interactive session started');
    console.log('Type a command number, tool name, or "help" for assistance');
    console.log('Type "quit" to exit\n');

    while (true) {
      try {
        const input = await this.promptUser('> ');
        const trimmed = input.trim();

        if (trimmed === 'quit' || trimmed === 'exit') {
          break;
        }

        if (trimmed === 'help') {
          this.showHelp();
          continue;
        }

        if (trimmed === 'tools' || trimmed === 'list') {
          this.showTools();
          continue;
        }

        await this.executeCommand(trimmed);

      } catch (error: any) {
        console.error('❌ Error:', error.message);
      }
    }

    await this.client.disconnect();
    this.rl.close();
    console.log('👋 Goodbye!');
  }

  private async executeCommand(command: string): Promise<void> {
    // Check if it's a number (tool index)
    const toolIndex = parseInt(command) - 1;
    if (!isNaN(toolIndex) && toolIndex >= 0 && toolIndex < this.tools.length) {
      const tool = this.tools[toolIndex];
      await this.executeTool(tool);
      return;
    }

    // Check if it's a tool name
    const tool = this.tools.find(t => t.name === command);
    if (tool) {
      await this.executeTool(tool);
      return;
    }

    // Handle preset commands
    switch (command) {
      case 'quick-train':
        await this.quickTrain();
        break;
      case 'status':
        await this.quickStatus();
        break;
      case 'running':
        await this.showRunningJobs();
        break;
      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Try a tool number, tool name, or "help" for assistance');
    }
  }

  private async executeTool(tool: Tool): Promise<void> {
    console.log(`\n🔧 Executing: ${tool.name}`);
    
    const params: Record<string, any> = {};
    
    // Get parameters if tool requires them
    if (tool.inputSchema?.properties) {
      const required = tool.inputSchema.required || [];
      
      for (const [paramName, paramSchema] of Object.entries(tool.inputSchema.properties)) {
        const isRequired = required.includes(paramName);
        const prompt = isRequired ? 
          `${paramName} (required): ` : 
          `${paramName} (optional, press Enter to skip): `;
        
        const value = await this.promptUser(prompt);
        
        if (value.trim() || isRequired) {
          // Try to parse as JSON if it looks like an object/array
          if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
            try {
              params[paramName] = JSON.parse(value);
            } catch {
              params[paramName] = value;
            }
          } else {
            params[paramName] = value || undefined;
          }
        }
      }
    }

    try {
      const result = await this.client.callTool(tool.name, params);
      console.log('✅ Result:');
      
      // Pretty print the result
      if (result.content) {
        result.content.forEach(content => {
          if (content.type === 'text') {
            // Try to parse as JSON for better formatting
            try {
              const parsed = JSON.parse(content.text);
              console.log(JSON.stringify(parsed, null, 2));
            } catch {
              console.log(content.text);
            }
          }
        });
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
      
    } catch (error: any) {
      console.error('❌ Tool execution failed:', error.message);
    }

    console.log(''); // Add spacing
  }

  private async quickTrain(): Promise<void> {
    console.log('🏃 Quick training - shingrix-po model');
    try {
      const result = await this.client.trainAndRegisterModel('shingrix-po');
      console.log('✅ Training started:');
      if (result.content && result.content[0]) {
        console.log(result.content[0].text);
      }
    } catch (error: any) {
      console.error('❌ Training failed:', error.message);
    }
  }

  private async quickStatus(): Promise<void> {
    const jobId = await this.promptUser('Job ID: ');
    const runId = await this.promptUser('Run ID: ');
    
    if (jobId && runId) {
      try {
        const result = await this.client.checkJobStatus(jobId, runId);
        console.log('✅ Status:');
        if (result.content && result.content[0]) {
          console.log(result.content[0].text);
        }
      } catch (error: any) {
        console.error('❌ Status check failed:', error.message);
      }
    }
  }

  private async showRunningJobs(): Promise<void> {
    console.log('🏃 Getting running jobs...');
    try {
      const result = await this.client.getRunningJobRuns();
      console.log('✅ Running jobs:');
      if (result.content && result.content[0]) {
        try {
          const parsed = JSON.parse(result.content[0].text);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(result.content[0].text);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to get running jobs:', error.message);
    }
  }

  private showHelp(): void {
    console.log(`
📖 Commands:
  help           - Show this help
  tools, list    - Show available tools
  <number>       - Execute tool by number (e.g., "1")
  <tool-name>    - Execute tool by name
  quick-train    - Quick train shingrix-po model
  status         - Check job status (prompts for IDs)
  running        - Show running jobs
  quit, exit     - Exit the CLI

🔧 Tool execution:
  - Enter tool number (1-${this.tools.length}) or exact tool name
  - You'll be prompted for required parameters
  - Optional parameters can be skipped by pressing Enter
    `);
  }

  private promptUser(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }
}

// Export for library usage
export default DatabricksMCPClient;

// CLI when run directly
if (require.main === module) {
  const serverUrl = process.argv[2];
  const cli = new DatabricksMCPCLI(serverUrl);
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    process.exit(0);
  });

  cli.start().catch(console.error);
}