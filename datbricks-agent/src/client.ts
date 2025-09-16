#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import readline from "readline";

/**
 * MCP Client for Databricks Server
 * Built following official MCP SDK patterns with proper StreamableHTTP support
 */
export class DatabricksMCPClient {
  private client: Client;
  private transport:
    | StreamableHTTPClientTransport
    | StdioClientTransport
    | null = null;
  private connected = false;

  constructor(private serverUrl?: string) {
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

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    try {
      if (this.serverUrl) {
        // HTTP transport for remote server
        console.log(`Connecting to MCP server at ${this.serverUrl}...`);
        this.transport = new StreamableHTTPClientTransport(
          new URL(this.serverUrl)
        );
      } else {
        // Stdio transport for local server
        console.log("Connecting to local MCP server via stdio...");
        this.transport = new StdioClientTransport({
          command: "node",
          args: ["databricks-mcp-server.js"],
        });
      }

      // Use type assertion to work around strict type checking
      await this.client.connect(this.transport as any);
      this.connected = true;
      console.log("✅ Connected to MCP server");
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("❌ Failed to connect to MCP server:", error.message);
        throw error;
      } else {
        console.error("❌ Failed to connect to MCP server:", error);
        throw error;
      }
    }
  }

  /**
   * List available tools from the server
   */
  async listTools(): Promise<Tool[]> {
    if (!this.connected) {
      throw new Error("Client not connected. Call connect() first.");
    }

    try {
      const response = await this.client.listTools();
      return response.tools;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Failed to list tools:", error.message);
        throw error;
      } else {
        console.error("Failed to list tools:", error);
        throw error;
      }
    }
  }

  /**
   * Execute a tool with parameters
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<CallToolResult> {
    if (!this.connected) {
      throw new Error("Client not connected. Call connect() first.");
    }

    try {
      console.log(`Calling tool: ${name}`);
      if (Object.keys(args).length > 0) {
        console.log(`Parameters:`, JSON.stringify(args, null, 2));
      }

      const result = await this.client.callTool({
        name,
        arguments: args,
      });

      // Return the result directly - it's already a CallToolResult
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Failed to call tool ${name}:`, error.message);
        throw error;
      } else {
        console.error(`Failed to call tool ${name}:`, error);
        throw error;
      }
    }
  }

  /**
   * Convenience methods for each Databricks tool
   */

  async runNotebook(
    notebookPath: string,
    baseParams: Record<string, unknown> = {},
    jobName: string = "AgentJob"
  ): Promise<CallToolResult> {
    return this.callTool("run_databricks_notebook", {
      notebook_path: notebookPath,
      base_params: baseParams,
      job_name: jobName,
    });
  }

  async trainAndRegisterModel(
    modelType: "shingrix-po" | "shingrix-ppo" | "digital-twin" = "shingrix-po",
    jobName: string = "DDT-Train-and-Register-Model",
    additionalParams: Record<string, unknown> = {}
  ): Promise<CallToolResult> {
    return this.callTool("train_and_register_model", {
      model_type: modelType,
      job_name: jobName,
      additional_params: additionalParams,
    });
  }

  async getLatestExperimentRun(experimentId: string): Promise<CallToolResult> {
    return this.callTool("get_latest_experiment_run", {
      experiment_id: experimentId,
    });
  }

  async getModelMetadata(experimentId: string): Promise<CallToolResult> {
    return this.callTool("get_model_metadata", {
      experiment_id: experimentId,
    });
  }

  async getRegisteredModelInfo(
    modelName: string,
    ucCatalog: string,
    ucSchema: string
  ): Promise<CallToolResult> {
    return this.callTool("get_registered_model_info", {
      model_name: modelName,
      uc_catalog: ucCatalog,
      uc_schema: ucSchema,
    });
  }

  async checkJobStatus(jobId: string, runId: string): Promise<CallToolResult> {
    return this.callTool("check_databricks_job_status", {
      job_id: jobId,
      run_id: runId,
    });
  }

  async getRunningJobRuns(): Promise<CallToolResult> {
    return this.callTool("get_latest_running_job_runs");
  }

  async getJobDetails(jobId: string): Promise<CallToolResult> {
    return this.callTool("get_job_details", {
      job_id: jobId,
    });
  }

  async convertEpochToDatetime(
    epochTimestamp: string
  ): Promise<CallToolResult> {
    return this.callTool("convert_epoch_to_datetime", {
      epoch_timestamp: epochTimestamp,
    });
  }

  async getTrainExperimentInfo(
    modelType: "shingrix-po" | "shingrix-ppo" | "digital-twin"
  ): Promise<CallToolResult> {
    return this.callTool("get_train_experiment_info", {
      model_type: modelType,
    });
  }

  async triggerAzureDevOpsPipeline(
    modelType: string,
    branch: string = "dev",
    platform: string = "databricks",
    environment: string = "dev"
  ): Promise<CallToolResult> {
    return this.callTool("trigger_azure_devops_pipeline", {
      model_type: modelType,
      branch,
      platform,
      environment,
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
        console.log("✅ Disconnected from MCP server");
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("Error disconnecting:", error.message);
        } else {
          console.error("Error disconnecting:", error);
        }
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
    console.log("🚀 Databricks MCP Client");
    console.log("========================");

    try {
      // Connect to server
      await this.client.connect();

      // Load available tools
      console.log("Loading available tools...");
      this.tools = await this.client.listTools();
      console.log(`✅ Loaded ${this.tools.length} tools`);

      // Show available tools
      this.showTools();

      // Start interactive session
      await this.interactiveSession();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("❌ Failed to start:", error.message);
      } else {
        console.error("❌ Failed to start:", error);
      }
      process.exit(1);
    }
  }

  private showTools(): void {
    console.log("\n📋 Available tools:");
    this.tools.forEach((tool, index) => {
      console.log(`  ${index + 1}. ${tool.name}`);
      console.log(`     ${tool.description || "No description"}`);
      if (
        tool.inputSchema &&
        typeof tool.inputSchema === "object" &&
        "properties" in tool.inputSchema
      ) {
        const properties = tool.inputSchema.properties as Record<string, any>;
        const params = Object.keys(properties);
        if (params.length > 0) {
          console.log(`     Parameters: ${params.join(", ")}`);
        }
      }
      console.log("");
    });
  }

  private async interactiveSession(): Promise<void> {
    console.log("🎮 Interactive session started");
    console.log('Type a command number, tool name, or "help" for assistance');
    console.log('Type "quit" to exit\n');

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const input = await this.promptUser("> ");
        const trimmed = input.trim();

        if (trimmed === "quit" || trimmed === "exit") {
          break;
        }

        if (trimmed === "help") {
          this.showHelp();
          continue;
        }

        if (trimmed === "tools" || trimmed === "list") {
          this.showTools();
          continue;
        }

        await this.executeCommand(trimmed);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("❌ Error:", error.message);
        } else {
          console.error("❌ Error:", error);
        }
      }
    }

    await this.client.disconnect();
    this.rl.close();
    console.log("👋 Goodbye!");
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
    const tool = this.tools.find((t) => t.name === command);
    if (tool) {
      await this.executeTool(tool);
      return;
    }

    // Handle preset commands
    switch (command) {
      case "quick-train":
        await this.quickTrain();
        break;
      case "status":
        await this.quickStatus();
        break;
      case "running":
        await this.showRunningJobs();
        break;
      default:
        console.log(`❌ Unknown command: ${command}`);
        console.log('Try a tool number, tool name, or "help" for assistance');
    }
  }

  private async executeTool(tool: Tool): Promise<void> {
    console.log(`\n🔧 Executing: ${tool.name}`);

    const params: Record<string, unknown> = {};

    // Get parameters if tool requires them
    if (
      tool.inputSchema &&
      typeof tool.inputSchema === "object" &&
      "properties" in tool.inputSchema
    ) {
      const properties = tool.inputSchema.properties as Record<string, any>;
      const required = (tool.inputSchema as any).required || [];

      for (const paramName of Object.keys(properties)) {
        const isRequired = required.includes(paramName);
        const prompt = isRequired
          ? `${paramName} (required): `
          : `${paramName} (optional, press Enter to skip): `;

        const value = await this.promptUser(prompt);

        if (value.trim() || isRequired) {
          // Try to parse as JSON if it looks like an object/array
          if (value.trim().startsWith("{") || value.trim().startsWith("[")) {
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
      console.log("✅ Result:");

      // Pretty print the result
      if (result.content) {
        result.content.forEach((content) => {
          if (content.type === "text") {
            // Try to parse as JSON for better formatting
            try {
              const parsed =
                typeof content.text === "string"
                  ? JSON.parse(content.text)
                  : content.text;
              console.log(JSON.stringify(parsed, null, 2));
            } catch {
              console.log(content.text);
            }
          }
        });
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("❌ Tool execution failed:", error.message);
      } else {
        console.error("❌ Tool execution failed:", error);
      }
    }

    console.log(""); // Add spacing
  }

  private async quickTrain(): Promise<void> {
    console.log("🏃 Quick training - shingrix-po model");
    try {
      const result = await this.client.trainAndRegisterModel("shingrix-po");
      console.log("✅ Training started:");
      if (result.content && result.content[0] && "text" in result.content[0]) {
        console.log(result.content[0].text);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("❌ Training failed:", error.message);
      } else {
        console.error("❌ Training failed:", error);
      }
    }
  }

  private async quickStatus(): Promise<void> {
    const jobId = await this.promptUser("Job ID: ");
    const runId = await this.promptUser("Run ID: ");

    if (jobId && runId) {
      try {
        const result = await this.client.checkJobStatus(jobId, runId);
        console.log("✅ Status:");
        if (
          result.content &&
          result.content[0] &&
          "text" in result.content[0]
        ) {
          console.log(result.content[0].text);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("❌ Status check failed:", error.message);
        } else {
          console.error("❌ Status check failed:", error);
        }
      }
    }
  }

  private async showRunningJobs(): Promise<void> {
    console.log("🏃 Getting running jobs...");
    try {
      const result = await this.client.getRunningJobRuns();
      console.log("✅ Running jobs:");
      if (result.content && result.content[0] && "text" in result.content[0]) {
        try {
          const text =
            typeof result.content[0].text === "string"
              ? result.content[0].text
              : String(result.content[0].text);
          const parsed = JSON.parse(text);
          console.log(JSON.stringify(parsed, null, 2));
        } catch {
          console.log(result.content[0].text);
        }
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("❌ Failed to get running jobs:", error.message);
      } else {
        console.error("❌ Failed to get running jobs:", error);
      }
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

// CLI when run directly (ESM compatible)
if (
  typeof import.meta !== "undefined" &&
  import.meta.url === `file://${process.argv[1]}`
) {
  const serverUrl = process.argv[2];
  const cli = new DatabricksMCPCLI(serverUrl);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    process.exit(0);
  });

  cli.start().catch(console.error);
}
