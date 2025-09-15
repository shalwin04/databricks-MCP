import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { StateGraph, END } from '@langchain/langgraph';
import { DatabricksMCPClient } from './mcp-client-new.js';
import {
  BaseMessage,
  AIMessage,
  HumanMessage,
  SystemMessage,
} from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

interface DatabricksToolResult {
  content: {
    type: 'text';
    text: string;
  }[];
  isError?: boolean;
}

// Define our state interface
interface AgentState {
  messages: BaseMessage[];
}

// Define function call type
interface FunctionCall {
  name: string;
  arguments: Record<string, unknown>;
}

// Define tool call type
interface ToolCall {
  id: string;
  type: 'function';
  function: FunctionCall;
}

// Define message types
type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

interface Message {
  content: string;
  role: MessageRole;
  tool_calls?: ToolCall[];
}

// Define the state schema using Zod
const stateSchema = z.object({
  messages: z.array(
    z.object({
      content: z.string(),
      role: z.enum(['user', 'assistant', 'system', 'tool']),
      tool_calls: z.array(
        z.object({
          id: z.string(),
          type: z.literal('function'),
          function: z.object({
            name: z.string(),
            arguments: z.record(z.unknown()),
          }),
        })
      ).optional(),
    })
  ),
});

export class DatabricksAgent {
  private model: ChatOpenAI;
  private mcpClient: DatabricksMCPClient;
  private tools: DynamicStructuredTool[];
  private graph: any;

  constructor(openaiApiKey?: string, mcpServerUrl?: string, databricksToken?: string) {
    this.model = new ChatOpenAI({
      apiKey: openaiApiKey || process.env.OPENAI_API_KEY,
      model: 'gpt-4',
      temperature: 0,
    });

    const token = databricksToken || process.env.DATABRICKS_TOKEN || '';
    this.mcpClient = new DatabricksMCPClient(mcpServerUrl, token);
    this.tools = [];
    this.initializeTools();
    this.graph = this.createGraph();
  }

  private initializeTools(): void {
    // Run Databricks notebook
    const runNotebookTool = new DynamicStructuredTool({
      name: 'run_databricks_notebook',
      description: 'Run a Databricks notebook on a running cluster',
      schema: z.object({
        notebook_path: z.string().describe('Path to the notebook in Databricks workspace'),
        base_params: z.record(z.unknown()).optional().describe('Optional parameters to pass to the notebook'),
        job_name: z.string().optional().describe('Optional job name'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.runNotebook({
            notebook_path: args.notebook_path,
            base_params: args.base_params || {},
            job_name: args.job_name
          });
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('run_databricks_notebook', error);
        }
      },
    });

    // Train and register model
    const trainModelTool = new DynamicStructuredTool({
      name: 'train_and_register_model',
      description: 'Train, log and register a model on Databricks',
      schema: z.object({
        model_type: z.enum(['shingrix-po', 'shingrix-ppo', 'digital-twin']).default('shingrix-po').describe('Type of model to train'),
        additional_params: z.record(z.unknown()).optional().describe('Additional parameters for training'),
        job_name: z.string().optional().describe('Name for the training job'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.trainAndRegisterModel(
            args.model_type,
            args.additional_params || {},
            args.job_name
          );
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('train_and_register_model', error);
        }
      },
    });

    // Get latest experiment run
    const getLatestRunTool = new DynamicStructuredTool({
      name: 'get_latest_experiment_run',
      description: 'Get the latest run from a Databricks ML experiment',
      schema: z.object({
        experiment_id: z.string().describe('ML experiment ID'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.getLatestExperimentRun(args.experiment_id);
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('get_latest_experiment_run', error);
        }
      },
    });

    // Get model metadata
    const getModelMetadataTool = new DynamicStructuredTool({
      name: 'get_model_metadata',
      description: 'Get metadata for a Databricks ML experiment',
      schema: z.object({
        experiment_id: z.string().describe('ML experiment ID'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.getModelMetadata(args.experiment_id);
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('get_model_metadata', error);
        }
      },
    });

    // Get registered model info
    const getModelInfoTool = new DynamicStructuredTool({
      name: 'get_registered_model_info',
      description: 'Get information about a registered model from Unity Catalog',
      schema: z.object({
        model_name: z.string().describe('Name of the model'),
        uc_catalog: z.string().describe('Unity Catalog catalog name'),
        uc_schema: z.string().describe('Unity Catalog schema name'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.getRegisteredModelInfo(
            args.model_name,
            args.uc_catalog,
            args.uc_schema
          );
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('get_registered_model_info', error);
        }
      },
    });

    // Check job status
    const checkJobStatusTool = new DynamicStructuredTool({
      name: 'check_databricks_job_status',
      description: 'Check the status of a Databricks job',
      schema: z.object({
        job_id: z.string().describe('Job ID'),
        run_id: z.string().describe('Run ID'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.checkJobStatus(args.job_id, args.run_id);
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('check_databricks_job_status', error);
        }
      },
    });

    // Get running jobs
    const getRunningJobsTool = new DynamicStructuredTool({
      name: 'get_latest_running_job_runs',
      description: 'Get all currently running Databricks job runs',
      schema: z.object({}),
      func: async () => {
        try {
          const result = await this.mcpClient.getRunningJobs();
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('get_latest_running_job_runs', error);
        }
      },
    });

    // Get job details
    const getJobDetailsTool = new DynamicStructuredTool({
      name: 'get_job_details',
      description: 'Get details for a specific Databricks job',
      schema: z.object({
        job_id: z.string().describe('Job ID'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.getJobDetails(args.job_id);
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('get_job_details', error);
        }
      },
    });

    // Convert epoch to datetime
    const convertEpochTool = new DynamicStructuredTool({
      name: 'convert_epoch_to_datetime',
      description: 'Convert an epoch timestamp to readable date and time',
      schema: z.object({
        epoch_timestamp: z.string().describe('Epoch timestamp to convert'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.convertEpochToDatetime(args.epoch_timestamp);
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('convert_epoch_to_datetime', error);
        }
      },
    });

    // Get training experiment info
    const getTrainInfoTool = new DynamicStructuredTool({
      name: 'get_train_experiment_info',
      description: 'Get information about training parameters for a model type',
      schema: z.object({
        model_type: z.enum(['shingrix-po', 'shingrix-ppo', 'digital-twin']).describe('Type of model'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.getTrainExperimentInfo(args.model_type);
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('get_train_experiment_info', error);
        }
      },
    });

    // Trigger Azure DevOps pipeline
    const triggerPipelineTool = new DynamicStructuredTool({
      name: 'trigger_azure_devops_pipeline',
      description: 'Trigger an Azure DevOps pipeline for model deployment',
      schema: z.object({
        model_type: z.string().describe('Type of model to deploy'),
        branch: z.string().default('dev').describe('Git branch to deploy from'),
        platform: z.string().default('databricks').describe('Deployment platform'),
        environment: z.string().default('dev').describe('Deployment environment'),
      }),
      func: async (args) => {
        try {
          const result = await this.mcpClient.triggerAzureDevOpsPipeline(
            args.model_type,
            args.branch,
            args.platform,
            args.environment
          );
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('trigger_azure_devops_pipeline', error);
        }
      },
    });

    // List clusters tool
    const listClustersTool = new DynamicStructuredTool({
      name: 'list_clusters',
      description: 'List all available Databricks clusters',
      schema: z.object({}),
      func: async () => {
        try {
          const result = await this.mcpClient.listClusters();
          return this.formatToolResult(result);
        } catch (error) {
          return this.formatError('list_clusters', error);
        }
      },
    });

    // Add all tools to the array
    this.tools = [
      runNotebookTool,
      trainModelTool,
      getLatestRunTool,
      getModelMetadataTool,
      getModelInfoTool,
      checkJobStatusTool,
      getRunningJobsTool,
      getJobDetailsTool,
      convertEpochTool,
      getTrainInfoTool,
      triggerPipelineTool,
      listClustersTool,
    ];
  }

  private formatToolResult(result: DatabricksToolResult): string {
    // Extract text content
    const textContent = result.content.map(item => item.text).join('\n');
    
    // If error, return as is
    if (result.isError) {
      return textContent;
    }
    
    // Try to parse and format JSON responses nicely
    try {
      const parsed = JSON.parse(textContent);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not valid JSON, return as plain text
      return textContent;
    }
  }

  private formatError(toolName: string, error: any): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error in ${toolName}: ${errorMessage}`;
  }

  private createGraph() {
    const workflow = new StateGraph({
      channels: {
        messages: [],
      },
    });

    // Add nodes
    workflow.addNode('agent', {
      accept: ['messages'],
      do: this.agentNode(),
      return: ['messages'],
    });

    workflow.addNode('tools', {
      accept: ['messages'],
      do: this.toolNode(),
      return: ['messages'],
    });

    // Set up edges
    workflow.addEdge('agent', 'tools');
    workflow.addEdge('tools', 'agent');

    // Add conditional edge from agent
    workflow.addConditionalEdges('agent', (state) => {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];
      return lastMessage.tool_calls?.length > 0 ? 'tools' : END;
    });

    workflow.setEntryPoint('agent');

    return workflow.compile();
  }

  private agentNode() {
    return async (state: any) => {
      const messages = [...state.messages];
      const systemMessage = new SystemMessage(
        `You are a knowledgeable Databricks assistant who can help with tasks like training models, running notebooks, checking jobs, and more.
        
        You have access to the following capabilities:
        - Training and registering ML models (shingrix-po, shingrix-ppo, digital-twin)
        - Running notebooks on Databricks clusters
        - Managing and monitoring ML experiments and jobs
        - Checking job statuses and getting run details
        - Retrieving model metadata and registered model information
        - Triggering Azure DevOps pipelines for model deployment
        - Converting timestamps and managing cluster information
        
        When users ask about model training, provide helpful information about the supported model types and their parameters. Always be specific about what actions you're taking and provide clear status updates.
        
        Available tools: ${this.tools.map((tool) => `${tool.name}: ${tool.description}`).join('\n')}`
      );
      
      const result = await this.model.invoke(
        [systemMessage, ...messages],
        {
          tools: this.tools,
        }
      );
      
      messages.push(result);
      
      if (result.tool_calls && result.tool_calls.length > 0) {
        return { messages, action: 'tools' };
      }
      
      return { messages, action: END };
    };
  }

  private toolNode() {
    return async (state: any) => {
      const messages = [...state.messages];
      const lastMessage = messages[messages.length - 1];
      
      if (!lastMessage.tool_calls) {
        return { messages };
      }
      
      console.log('\nExecuting tool:', lastMessage.tool_calls[0].name);
      
      for (const toolCall of lastMessage.tool_calls) {
        try {
          const tool = this.tools.find((t) => t.name === toolCall.name);
          if (!tool) {
            throw new Error(`Tool ${toolCall.name} not found`);
          }
          
          const args = toolCall.args;
          const result = await tool.invoke(args);
          
          messages.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: result,
          });
        } catch (error) {
          messages.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
      
      return { messages };
    };
  }

  private shouldContinue(state: AgentState) {
    const messages = state.messages || [];
    const lastMessage = messages[messages.length - 1];
    return (lastMessage as AIMessage)?.tool_calls?.length > 0 ? 'tools' : END;
  }

  async initialize(): Promise<void> {
    console.log('Initializing Databricks Agent...');
    try {
      await this.mcpClient.connect();
      
      // Verify connection health
      const isHealthy = await this.mcpClient.healthCheck();
      if (!isHealthy) {
        console.warn('MCP client health check failed, but continuing with limited functionality');
      } else {
        console.log('MCP client health check passed');
      }
      
      console.log('Agent initialized successfully!');
    } catch (error) {
      console.error('Error connecting to MCP server:', error);
      console.warn('Agent will continue with limited functionality');
    }
  }

  async cleanup(): Promise<void> {
    await this.mcpClient.disconnect();
    console.log('Agent cleaned up successfully!');
  }

  async invoke(message: string): Promise<string> {
    try {
      const state = {
        messages: [new HumanMessage(message)],
      };

      const result = await this.graph.invoke(state);
      const lastMessage = result.messages[result.messages.length - 1];
      
      return lastMessage.content;
    } catch (error) {
      console.error('Error in agent invoke:', error);
      // Try to reconnect if there's a connection issue
      if (error instanceof Error && error.message.includes('connection')) {
        console.log('Attempting to reconnect due to connection error...');
        try {
          await this.mcpClient.reconnect();
          // Retry the operation
          const state = {
            messages: [new HumanMessage(message)],
          };
          const result = await this.graph.invoke(state);
          const lastMessage = result.messages[result.messages.length - 1];
          return lastMessage.content;
        } catch (reconnectError) {
          return `Connection error occurred and reconnection failed: ${reconnectError instanceof Error ? reconnectError.message : String(reconnectError)}`;
        }
      }
      
      return `Error processing request: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async stream(message: string) {
    try {
      const state = {
        messages: [new HumanMessage(message)],
      };

      const stream = await this.graph.stream(state);
      return stream;
    } catch (error) {
      console.error('Error in agent stream:', error);
      throw error;
    }
  }

  // Method to get available tools information
  getAvailableOperations(): string[] {
    return this.tools.map(tool => `${tool.name}: ${tool.description}`);
  }
}