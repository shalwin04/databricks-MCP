import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  CallToolResult,
  ListToolsResult,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

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

export interface NotebookRunParams {
  notebook_path: string;
  base_params?: Record<string, any>;
  job_name?: string;
}

export interface TrainModelParams {
  model_type: string;
  additional_params?: Record<string, any>;
  job_name?: string;
}

export class DatabricksMCPClient {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private sessionId: string | null = null;
  private serverUrl: string;
  private token: string;
  private availableTools: Tool[] = [];
  private _isConnected: boolean = false;
  
  constructor(serverUrl: string = 'http://localhost:4000/mcp', token: string = '') {
    this.serverUrl = serverUrl;
    this.token = token;
  }

  /**
   * Connects to the MCP server
   */
  async connect(): Promise<void> {
    try {
      console.log(`Connecting to MCP server at ${this.serverUrl}...`);
      
      // First, initialize the session with a POST request
      await this.initializeSession();
      
      if (!this.sessionId) {
        throw new Error('No session ID received from server');
      }

      console.log('Creating SSE transport...');
      // Create transport with session ID
      const url = new URL(this.serverUrl);
      url.searchParams.set('mcp-session-id', this.sessionId);
      
      // Create transport
      this.transport = new SSEClientTransport(url);
      
      console.log('Creating MCP client...');
      // Create client
      this.client = new Client(
        {
          name: 'databricks-agent-client',
          version: '1.0.0',
          protocolVersion: '2025-06-18'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      console.log('Connecting to server...');
      // Connect to server with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 30000); // 30 second timeout

      try {
        await this.client.connect(this.transport);
        console.log('Successfully connected to server.');
        this._isConnected = true;
      } catch (error) {
        console.error('Error during client.connect():', error);
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      
      try {
        await Promise.race([connectPromise, timeoutPromise]);
        console.log('Connected to MCP server successfully!');
        this._isConnected = true;
      } catch (connectError) {
        console.error('Connection error or timeout:', connectError);
        // If it's a timeout, we'll continue but mark as not connected
        this._isConnected = false;
        console.log('Continuing with limited functionality');
      }

      // Get available tools
      await this.loadAvailableTools();
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      this._isConnected = false;
      throw error;
    }
  }

  /**
   * Initialize the MCP session with a POST request
   */
  private async initializeSession(): Promise<void> {
    try {
      console.log('Initializing MCP session...');
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      const initBody = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          clientInfo: {
            name: 'databricks-agent-client',
            version: '1.0.0'
          },
          protocolVersion: '2025-06-18',
          clientCapabilities: {
            tools: {}
          }
        }
      };

      console.log('Sending initialization request...');
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(initBody)
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize session: ${response.status} ${response.statusText}`);
      }

      // Check for session ID in response headers
      this.sessionId = response.headers.get('mcp-session-id');
      if (!this.sessionId) {
        throw new Error('No session ID received from server');
      }
      console.log(`Received session ID: ${this.sessionId}`);

      const data = await response.json();
      if (data.error) {
        throw new Error(`Server returned error: ${data.error.message}`);
      }
      
      console.log('Session initialized:', data.result?.protocolVersion || 'unknown protocol');
      
    } catch (error) {
      console.error('Failed to initialize MCP session:', error);
      throw error;
    }
  }

  /**
   * Disconnects from the MCP server
   */
  async disconnect(): Promise<void> {
    try {
      if (this.sessionId) {
        // Send shutdown request
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'mcp-session-id': this.sessionId
          };
          
          if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
          }

          const response = await fetch(this.serverUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'shutdown',
              params: {}
            }),
          });

          if (response.ok) {
            console.log('Session shutdown successfully');
          } else {
            console.warn(`Shutdown request failed: ${response.status} ${response.statusText}`);
          }
        } catch (shutdownError) {
          console.warn('Error during session shutdown:', shutdownError);
        }
      }
      
      if (this.transport) {
        try {
          await this.transport.close();
        } catch (transportError) {
          console.warn('Error closing transport:', transportError);
        }
        this.transport = null;
      }
      
      if (this.client) {
        try {
          await this.client.close();
        } catch (clientError) {
          console.warn('Error closing client:', clientError);
        }
        this.client = null;
      }
      
      this._isConnected = false;
      this.sessionId = null;
      this.availableTools = [];
      console.log('Disconnected from MCP server');
    } catch (error) {
      console.error('Error during disconnect:', error);
      // Reset client state even if there was an error
      this.client = null;
      this.transport = null;
      this._isConnected = false;
      this.sessionId = null;
      this.availableTools = [];
      throw error;
    }
  }

  /**
   * Loads available tools from the MCP server
   */
  private async loadAvailableTools(): Promise<void> {
    if (!this.client || !this._isConnected) {
      console.warn('Cannot load tools: Client not connected');
      this.availableTools = [];
      return;
    }

    try {
      console.log('Requesting available tools from MCP server...');
      
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 30000); // 30 second timeout

      try {
        const toolsResult = await this.client.listTools();
        this.availableTools = toolsResult.tools || [];
        console.log(`Loaded ${this.availableTools.length} available tools:`, 
          this.availableTools.map(t => t.name).join(', '));
      } catch (error) {
        console.error('Error during tools listing:', error);
        this.availableTools = [];
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      console.error('Failed to load available tools:', error);
      this.availableTools = [];
    }
  }

  /**
   * Checks if the client is connected to the MCP server
   */
  async checkConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Try to list tools as a connection check
      await this.client.listTools();
      this._isConnected = true;
      return true;
    } catch (error) {
      console.error('Connection check failed:', error);
      this._isConnected = false;
      return false;
    }
  }

  /**
   * Returns the connection status
   */
  get connected(): boolean {
    return this._isConnected;
  }

  /**
   * Gets the list of available tools
   */
  getAvailableTools(): Tool[] {
    return this.availableTools;
  }

  /**
   * Calls a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<MCPToolResult> {
    if (!this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`Calling tool: ${name} with args:`, args);
      const result = await this.client.callTool({
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

  // Specific methods for Databricks operations
  
  /**
   * Executes a SQL query on Databricks
   */
  async executeQuery(params: DatabricksQueryParams): Promise<MCPToolResult> {
    return this.callTool('databricks_query', { 
      query: params.query,
      warehouse_id: params.warehouse_id
    });
  }

  /**
   * Lists all available Databricks clusters
   */
  async listClusters(): Promise<MCPToolResult> {
    return this.callTool('list_clusters', {});
  }

  /**
   * Runs a notebook on Databricks
   */
  async runNotebook(params: NotebookRunParams): Promise<MCPToolResult> {
    return this.callTool('run_databricks_notebook', {
      notebook_path: params.notebook_path,
      base_params: params.base_params || {},
      job_name: params.job_name || 'AgentJob',
    });
  }

  /**
   * Trains and registers a model on Databricks
   */
  async trainAndRegisterModel(
    modelTypeOrParams: string | TrainModelParams, 
    additionalParams?: Record<string, any>,
    jobName?: string
  ): Promise<MCPToolResult> {
    // Support both new and old method signatures
    if (typeof modelTypeOrParams === 'string') {
      return this.callTool('train_and_register_model', {
        model_type: modelTypeOrParams,
        additional_params: additionalParams || {},
        job_name: jobName || 'DDT-Train-and-Register-Model',
      });
    } else {
      return this.callTool('train_and_register_model', {
        model_type: modelTypeOrParams.model_type,
        additional_params: modelTypeOrParams.additional_params || {},
        job_name: modelTypeOrParams.job_name || 'DDT-Train-and-Register-Model',
      });
    }
  }

  /**
   * Gets the latest run from an experiment
   */
  async getLatestExperimentRun(experimentId: string): Promise<MCPToolResult> {
    return this.callTool('get_latest_experiment_run', {
      experiment_id: experimentId,
    });
  }

  /**
   * Gets metadata for a model
   */
  async getModelMetadata(experimentId: string): Promise<MCPToolResult> {
    return this.callTool('get_model_metadata', {
      experiment_id: experimentId,
    });
  }

  /**
   * Gets information about a registered model
   */
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

  /**
   * Checks the status of a Databricks job
   */
  async getJobStatus(jobId: string, runId: string): Promise<MCPToolResult> {
    return this.callTool('check_databricks_job_status', {
      job_id: jobId,
      run_id: runId,
    });
  }
  
  /**
   * Alias for getJobStatus - for compatibility with agent
   */
  async checkJobStatus(jobId: string, runId: string): Promise<MCPToolResult> {
    return this.getJobStatus(jobId, runId);
  }

  /**
   * Gets all running jobs
   */
  async getRunningJobs(): Promise<MCPToolResult> {
    return this.callTool('get_latest_running_job_runs', {});
  }

  /**
   * Gets details for a job
   */
  async getJobDetails(jobId: string): Promise<MCPToolResult> {
    return this.callTool('get_job_details', {
      job_id: jobId,
    });
  }

  /**
   * Converts an epoch timestamp to a readable datetime
   */
  async convertEpochToDatetime(epochTimestamp: string): Promise<MCPToolResult> {
    return this.callTool('convert_epoch_to_datetime', {
      epoch_timestamp: epochTimestamp,
    });
  }

  /**
   * Gets training experiment info for a model type
   */
  async getTrainExperimentInfo(modelType: string): Promise<MCPToolResult> {
    return this.callTool('get_train_experiment_info', {
      model_type: modelType,
    });
  }

  /**
   * Triggers an Azure DevOps pipeline for model deployment
   */
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

  /**
   * Performs a health check on the MCP server
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }
      
      // Try to list tools as a health check
      await this.client.listTools();
      return true;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Attempts to reconnect to the MCP server
   */
  async reconnect(): Promise<void> {
    console.log('Attempting to reconnect...');
    await this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    await this.connect();
  }
}