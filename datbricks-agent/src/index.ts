#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import readline from "readline";
import chalk from "chalk";

// Load environment variables
dotenv.config();

interface DatabricksClientConfig {
  serverUrl?: string;
  timeout?: number;
  retries?: number;
}

class DatabricksClient {
  private client: Client;
  private transport: SSEClientTransport | null = null;
  private serverUrl: string;
  private isConnected: boolean = false;
  private sessionId: string | null = null;

  constructor(config: DatabricksClientConfig = {}) {
    this.serverUrl = config.serverUrl || process.env.MCP_SERVER_URL || "http://localhost:4000/mcp";

    this.client = new Client(
      {
        name: "databricks-mcp-client",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log(chalk.yellow("Client is already connected."));
      return;
    }

    console.log(chalk.blue(`Connecting to Databricks MCP server at ${this.serverUrl}...`));
    
    try {
      console.log(chalk.gray('Creating SSE transport...'));
      this.transport = new SSEClientTransport({
        href: this.serverUrl,
        headers: {
          'Content-Type': 'application/json'
        },
        onError: (error: unknown) => {
          console.error(chalk.red('Transport error:', error));
        }
      });

      console.log(chalk.gray('Initializing connection to server...'));
      await this.client.connect(this.transport);
      
      // Verify connection by attempting to list tools
      console.log(chalk.gray('Verifying connection by listing tools...'));
      const tools = await this.client.request(
        { method: "tools/list", params: {} },
        ListToolsRequestSchema
      );
      
      this.isConnected = true;
      console.log(chalk.green("✓ Connected to Databricks MCP server successfully!"));
      console.log(chalk.gray(`Available tools: ${tools.length}`));
    } catch (error: any) {
      console.error(chalk.red(`Failed to connect to server: ${error.message}`));
      if (this.isConnected) {
        console.log(chalk.yellow("Client is already connected."));
        return;
      }

      console.log(chalk.blue(`Connecting to Databricks MCP server at ${this.serverUrl}...`));

      try {
        this.transport = new SSEClientTransport({
          serverUrl: this.serverUrl,
          headers: {
            'Content-Type': 'application/json'
          },
          async connect(): Promise<void> {
            if (this.isConnected) {
              console.log(chalk.yellow("Client is already connected."));
              return;
            }

            console.log(chalk.blue(`Connecting to Databricks MCP server at ${this.serverUrl}...`));

            try {
              // Send initialization request and check for session ID
              const initResponse = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  jsonrpc: '2.0',
                  id: 1,
                  method: 'initialize',
                  params: {},
                }),
              });
              const sessionId = initResponse.headers.get('mcp-session-id');
              const responseText = await initResponse.text();
              console.log(chalk.gray('Raw initialization response:'), responseText.substring(0, 200));
              if (!sessionId) {
                throw new Error('No session ID returned from server during initialization');
              }
              this.sessionId = sessionId;
              console.log(chalk.green('✓ Session initialized with ID:'), this.sessionId);

              // Verify connection by listing tools
              const toolsResponse = await this.sendRpcRequest('tools/list', {});
              console.log(chalk.gray('Raw tools/list response:'), JSON.stringify(toolsResponse).substring(0, 200));
              this.isConnected = true;
              console.log(chalk.green("✓ Connected to Databricks MCP server successfully!"));
              console.log(chalk.gray(`Available tools: ${toolsResponse.result?.tools?.length ?? 0}`));
            } catch (error: any) {
              console.error(chalk.red(`Failed to connect to server: ${error.message}`));
              this.isConnected = false;
              throw error;
            }
          }

          // Generic method for sending JSON-RPC requests with session ID
          async sendRpcRequest(method: string, params: any): Promise<any> {
            if (!this.sessionId) {
              throw new Error('Session not initialized. Call connect() first.');
            }
            const response = await fetch(this.serverUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'mcp-session-id': this.sessionId,
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: Math.floor(Math.random() * 10000),
                method,
                params,
              }),
            });
            const text = await response.text();
            try {
              return JSON.parse(text);
            } catch (err) {
              throw new Error('Failed to parse response: ' + text.substring(0, 200));
            }
          }
        CallToolRequestSchema
      );
      
      return response;
    } catch (error: any) {
      console.error(chalk.red(`Failed to call tool ${name}: ${error.message}`));
      throw error;
    }
  }

  private ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error("Client is not connected. Call connect() first.");
    }
  }

  // Convenience methods for specific Databricks operations
  async runNotebook(notebookPath: string, baseParams: Record<string, any> = {}, jobName: string = "AgentJob"): Promise<any> {
    return this.callTool("run_databricks_notebook", {
      notebook_path: notebookPath,
      base_params: baseParams,
      job_name: jobName,
    });
  }

  async trainModel(modelType: string = "shingrix-po", additionalParams: Record<string, any> = {}, jobName: string = "DDT-Train-and-Register-Model"): Promise<any> {
    return this.callTool("train_and_register_model", {
      model_type: modelType,
      additional_params: additionalParams,
      job_name: jobName,
    });
  }

  async getLatestExperimentRun(experimentId: string): Promise<any> {
    return this.callTool("get_latest_experiment_run", {
      experiment_id: experimentId,
    });
  }

  async getModelMetadata(experimentId: string): Promise<any> {
    return this.callTool("get_model_metadata", {
      experiment_id: experimentId,
    });
  }

  async getRegisteredModelInfo(modelName: string, ucCatalog: string, ucSchema: string): Promise<any> {
    return this.callTool("get_registered_model_info", {
      model_name: modelName,
      uc_catalog: ucCatalog,
      uc_schema: ucSchema,
    });
  }

  async checkJobStatus(jobId: string, runId: string): Promise<any> {
    return this.callTool("check_databricks_job_status", {
      job_id: jobId,
      run_id: runId,
    });
  }

  async getRunningJobs(): Promise<any> {
    return this.callTool("get_latest_running_job_runs", {});
  }

  async getJobDetails(jobId: string): Promise<any> {
    return this.callTool("get_job_details", {
      job_id: jobId,
    });
  }

  async convertEpochToDateTime(epochTimestamp: string): Promise<any> {
    return this.callTool("convert_epoch_to_datetime", {
      epoch_timestamp: epochTimestamp,
    });
  }

  async getTrainExperimentInfo(modelType: string): Promise<any> {
    return this.callTool("get_train_experiment_info", {
      model_type: modelType,
    });
  }

  async triggerAzureDevOpsPipeline(modelType: string, branch: string = "dev", platform: string = "databricks", environment: string = "dev"): Promise<any> {
    return this.callTool("trigger_azure_devops_pipeline", {
      model_type: modelType,
      branch,
      platform,
      environment,
    });
  }
}

// Interactive CLI functionality
class DatabricksCliClient {
  private client: DatabricksClient;
  private rl: readline.Interface;

  constructor() {
    this.client = new DatabricksClient();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start(): Promise<void> {
    console.log(chalk.green.bold("🚀 Databricks MCP Client"));
    console.log(chalk.gray("Type 'help' for available commands, 'exit' to quit\n"));

    try {
      await this.client.connect();
      await this.showMainMenu();
    } catch (error: any) {
      console.error(chalk.red(`Failed to start client: ${error.message}`));
      process.exit(1);
    }
  }

  private async showMainMenu(): Promise<void> {
    while (true) {
      try {
        const command = await this.prompt(chalk.cyan("databricks> "));
        
        if (command.toLowerCase() === 'exit' || command.toLowerCase() === 'quit') {
          await this.client.disconnect();
          this.rl.close();
          break;
        }

        await this.handleCommand(command);
      } catch (error: any) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
    }
  }

  private async handleCommand(command: string): Promise<void> {
    const parts = command.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case 'help':
        this.showHelp();
        break;
      
      case 'list-tools':
        await this.listTools();
        break;
      
      case 'train':
        await this.trainModelInteractive();
        break;
      
      case 'status':
        await this.checkStatusInteractive();
        break;
      
      case 'jobs':
        await this.listRunningJobs();
        break;
      
      case 'notebook':
        await this.runNotebookInteractive();
        break;
      
      case 'model-info':
        await this.getModelInfoInteractive();
        break;
      
      case 'deploy':
        await this.deployModelInteractive();
        break;
      
      case 'experiment':
        await this.getExperimentInfoInteractive();
        break;
      
      default:
        if (command.trim()) {
          console.log(chalk.red(`Unknown command: ${cmd}. Type 'help' for available commands.`));
        }
        break;
    }
  }

  private showHelp(): void {
    console.log(chalk.yellow("\n📋 Available Commands:"));
    console.log(chalk.white("  help              - Show this help message"));
    console.log(chalk.white("  list-tools        - List all available tools"));
    console.log(chalk.white("  train             - Train a model interactively"));
    console.log(chalk.white("  status            - Check job status"));
    console.log(chalk.white("  jobs              - List running jobs"));
    console.log(chalk.white("  notebook          - Run a notebook"));
    console.log(chalk.white("  model-info        - Get model information"));
    console.log(chalk.white("  deploy            - Deploy model via Azure DevOps"));
    console.log(chalk.white("  experiment        - Get experiment information"));
    console.log(chalk.white("  exit              - Exit the client\n"));
  }

  private async listTools(): Promise<void> {
    try {
      const tools = await this.client.listTools();
      console.log(chalk.yellow("\n🔧 Available Tools:"));
      tools.forEach((tool, index) => {
        console.log(chalk.white(`  ${index + 1}. ${tool.name}`));
        console.log(chalk.gray(`     ${tool.description}`));
      });
      console.log();
    } catch (error: any) {
      console.error(chalk.red(`Failed to list tools: ${error.message}`));
    }
  }

  private async trainModelInteractive(): Promise<void> {
    try {
      const modelType = await this.prompt("Model type (shingrix-po/shingrix-ppo/digital-twin) [shingrix-po]: ") || "shingrix-po";
      const jobName = await this.prompt("Job name [DDT-Train-and-Register-Model]: ") || "DDT-Train-and-Register-Model";
      
      console.log(chalk.blue("\n🚀 Starting model training..."));
      const response = await this.client.trainModel(modelType, {}, jobName);
      console.log(chalk.green("✓ Training job started!"));
      console.log(JSON.stringify(response, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`Training failed: ${error.message}`));
    }
  }

  private async checkStatusInteractive(): Promise<void> {
    try {
      const jobId = await this.prompt("Job ID: ");
      const runId = await this.prompt("Run ID: ");
      
      const response = await this.client.checkJobStatus(jobId, runId);
      console.log(chalk.green("\n📊 Job Status:"));
      console.log(JSON.stringify(response, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`Status check failed: ${error.message}`));
    }
  }

  private async listRunningJobs(): Promise<void> {
    try {
      console.log(chalk.blue("🔄 Fetching running jobs..."));
      const response = await this.client.getRunningJobs();
      console.log(chalk.green("\n📋 Running Jobs:"));
      console.log(JSON.stringify(response, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`Failed to list jobs: ${error.message}`));
    }
  }

  private async runNotebookInteractive(): Promise<void> {
    try {
      const notebookPath = await this.prompt("Notebook path: ");
      const jobName = await this.prompt("Job name [AgentJob]: ") || "AgentJob";
      
      console.log(chalk.blue("\n📓 Running notebook..."));
      const response = await this.client.runNotebook(notebookPath, {}, jobName);
      console.log(chalk.green("✓ Notebook execution started!"));
      console.log(JSON.stringify(response, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`Notebook execution failed: ${error.message}`));
    }
  }

  private async getModelInfoInteractive(): Promise<void> {
    try {
      const modelName = await this.prompt("Model name: ");
      const ucCatalog = await this.prompt("Unity Catalog [main]: ") || "main";
      const ucSchema = await this.prompt("Schema [ml_models]: ") || "ml_models";
      
      console.log(chalk.blue("\n🔍 Fetching model info..."));
      const response = await this.client.getRegisteredModelInfo(modelName, ucCatalog, ucSchema);
      console.log(chalk.green("\n📝 Model Information:"));
      console.log(JSON.stringify(response, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`Failed to get model info: ${error.message}`));
    }
  }

  private async deployModelInteractive(): Promise<void> {
    try {
      const modelType = await this.prompt("Model type: ");
      const branch = await this.prompt("Branch [dev]: ") || "dev";
      const environment = await this.prompt("Environment [dev]: ") || "dev";
      
      console.log(chalk.blue("\n🚀 Triggering deployment pipeline..."));
      const response = await this.client.triggerAzureDevOpsPipeline(modelType, branch, "databricks", environment);
      console.log(chalk.green("✓ Deployment pipeline triggered!"));
      console.log(JSON.stringify(response, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`Deployment failed: ${error.message}`));
    }
  }

  private async getExperimentInfoInteractive(): Promise<void> {
    try {
      const experimentId = await this.prompt("Experiment ID: ");
      
      console.log(chalk.blue("\n🔬 Fetching experiment info..."));
      const response = await this.client.getLatestExperimentRun(experimentId);
      console.log(chalk.green("\n📊 Latest Experiment Run:"));
      console.log(JSON.stringify(response, null, 2));
    } catch (error: any) {
      console.error(chalk.red(`Failed to get experiment info: ${error.message}`));
    }
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }
}

// Programmatic API usage example
async function exampleUsage() {
  const client = new DatabricksClient();
  
  try {
    // Connect to the server
    await client.connect();
    
    // List available tools
    const tools = await client.listTools();
    console.log("Available tools:", tools.map(t => t.name));
    
    // Train a model
    const trainResult = await client.trainModel("shingrix-po", {
      experiment_name: "MyExperiment",
      model_name: "my_custom_model"
    });
    console.log("Training result:", trainResult);
    
    // Check running jobs
    const runningJobs = await client.getRunningJobs();
    console.log("Running jobs:", runningJobs);
    
    // Disconnect
    await client.disconnect();
    
  } catch (error: any) {
    console.error("Example usage failed:", error.message);
  }
}

// Main execution
async function main() {
  console.log(chalk.green.bold('\n🚀 Starting Databricks MCP Client...\n'));
  
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Databricks MCP Client

Usage:
  npm start                 - Start interactive CLI
  npm start -- --example   - Run programmatic example
  npm start -- --help      - Show this help

Environment Variables:
  MCP_SERVER_URL - Server URL (default: http://localhost:4000/mcp)
    `);
    return;
  }
  
  if (args.includes('--example')) {
    await exampleUsage();
    return;
  }
  
  // Start interactive CLI by default
  const cli = new DatabricksCliClient();
  await cli.start();
}

// Export for programmatic use
export { DatabricksClient };

// Run CLI if this file is executed directly
console.log(chalk.blue('Starting application...'));

// Always run in CLI mode when executed directly
main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});