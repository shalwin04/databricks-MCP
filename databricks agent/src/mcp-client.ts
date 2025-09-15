import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  CallToolResult,
  ListToolsResult,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

export interface DatabricksQueryParams {
  query: string;
  warehouse_id?: string;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface DatabricksCluster {
  cluster_id: string;
  cluster_name: string;
  state: string;
  node_type_id: string;
  num_workers: number;
}

export class DatabricksMCPClient {
  public mcpClient: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private serverUrl: string;
  private availableTools: Tool[] = [];

  constructor(serverUrl: string = 'http://localhost:4000/mcp') {
    this.serverUrl = serverUrl;
  }

  async connect(): Promise<void> {
    try {
      console.log(`Connecting to MCP server at ${this.serverUrl}...`);
      
      // Create transport
      this.transport = new SSEClientTransport(new URL(this.serverUrl));
      
      // Create client
      this.mcpClient = new Client(
        {
          name: 'databricks-agent-client',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Connect to server
      await this.mcpClient.connect(this.transport);
      console.log('Connected to MCP server successfully!');

      // Get available tools
      await this.loadAvailableTools();
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.close();
      this.mcpClient = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    console.log('Disconnected from MCP server');
  }

  private async loadAvailableTools(): Promise<void> {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }

    try {
      const toolsResult = await this.mcpClient.listTools();
      this.availableTools = toolsResult.tools || [];
      console.log(`Loaded ${this.availableTools.length} available tools:`, 
        this.availableTools.map(t => t.name).join(', '));
    } catch (error) {
      console.error('Failed to load available tools:', error);
      throw error;
    }
  }

  getAvailableTools(): Tool[] {
    return this.availableTools;
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`Calling tool: ${name} with args:`, args);
      const result = await this.mcpClient.callTool({
        name,
        arguments: args,
      });

      return {
        content: Array.isArray(result.content) ? result.content : [],
        isError: typeof result.isError === 'boolean'
          ? result.isError
          : (result.isError !== undefined ? Boolean(result.isError) : undefined),
      };
    } catch (error) {
      console.error(`Error calling tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error calling tool ${name}: ${error instanceof Error ? error.message : String(error)}`,
          }
        ],
        isError: true,
      };
    }
  }

  // Specific methods for common Databricks operations
  async executeQuery(params: DatabricksQueryParams): Promise<MCPToolResult> {
    return this.callTool('databricks_query', params as unknown as Record<string, unknown>);
  }

  async listClusters(): Promise<MCPToolResult> {
    return this.callTool('list_clusters');
  }

  async runNotebook(
    notebookPath: string, 
    baseParams: Record<string, any> = {}, 
    jobName: string = 'AgentJob'
  ): Promise<MCPToolResult> {
    return this.callTool('run_databricks_notebook', {
      notebook_path: notebookPath,
      base_params: baseParams,
      job_name: jobName,
    });
  }

  async trainAndRegisterModel(
    modelType: string = 'shingrix-po',
    additionalParams: Record<string, any> = {},
    jobName: string = 'DDT-Train-and-Register-Model'
  ): Promise<MCPToolResult> {
    return this.callTool('train_and_register_model', {
      model_type: modelType,
      additional_params: additionalParams,
      job_name: jobName,
    });
  }

  async getLatestExperimentRun(experimentId: string): Promise<MCPToolResult> {
    return this.callTool('get_latest_experiment_run', {
      experiment_id: experimentId,
    });
  }

  async getModelMetadata(experimentId: string): Promise<MCPToolResult> {
    return this.callTool('get_model_metadata', {
      experiment_id: experimentId,
    });
  }

  async getRegisteredModelInfo(
    modelName: string,
    ucCatalog: string,
    ucSchema: string
  ): Promise<MCPToolResult> {
    return this.callTool('get_registered_model_info', {
      model_name: modelName,
      uc_catalog: ucCatalog,
      uc_schema: ucSchema,
    });
  }

  async checkJobStatus(jobId: string, runId: string): Promise<MCPToolResult> {
    return this.callTool('check_databricks_job_status', {
      job_id: jobId,
      run_id: runId,
    });
  }

  async getRunningJobs(): Promise<MCPToolResult> {
    return this.callTool('get_latest_running_job_runs', {});
  }

  async getJobDetails(jobId: string): Promise<MCPToolResult> {
    return this.callTool('get_job_details', {
      job_id: jobId,
    });
  }

  async convertEpochToDatetime(epochTimestamp: string): Promise<MCPToolResult> {
    return this.callTool('convert_epoch_to_datetime', {
      epoch_timestamp: epochTimestamp,
    });
  }

  async getTrainExperimentInfo(modelType: string): Promise<MCPToolResult> {
    return this.callTool('get_train_experiment_info', {
      model_type: modelType,
    });
  }

  async triggerAzureDevOpsPipeline(
    modelType: string,
    branch: string = 'dev',
    platform: string = 'databricks',
    environment: string = 'dev'
  ): Promise<MCPToolResult> {
    return this.callTool('trigger_azure_devops_pipeline', {
      model_type: modelType,
      branch,
      platform,
      environment,
    });
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.mcpClient) {
        return false;
      }
      
      // Try to list tools as a health check
      await this.mcpClient.listTools();
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  // Reconnection method
  async reconnect(): Promise<void> {
    console.log('Attempting to reconnect...');
    await this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await this.connect();
  }
}