import {
  ChatOpenAI,
  DynamicStructuredTool,
  HumanMessage,
  SystemMessage,
  Tool
} from '@langchain/core';
import { z } from 'zod';
import {
  END,
  StateGraph,
} from '@langchain/langgraph';
import { DatabricksMCPClient, DatabricksQueryParams, MCPToolResult, NotebookRunParams, TrainModelParams } from './mcp-client-new.js';

export class DatabricksAgent {
  private model: ChatOpenAI;
  private mcpClient: DatabricksMCPClient;
  private tools: DynamicStructuredTool[];
  private graph: StateGraph;
  
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
    // SQL query tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'databricks_query',
        description: 'Execute a SQL query on Databricks',
        schema: z.object({
          query: z.string().describe('The SQL query to execute'),
          warehouse_id: z.string().optional().describe('Optional warehouse ID to use')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.executeQuery({
              query: args.query,
              warehouse_id: args.warehouse_id
            });
            return result.content[0]?.text || 'No results returned';
          } catch (error) {
            return `Error executing query: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // List clusters tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'list_clusters',
        description: 'List all available Databricks clusters',
        schema: z.object({}),
        func: async () => {
          try {
            const result = await this.mcpClient.listClusters();
            return result.content[0]?.text || 'No clusters found';
          } catch (error) {
            return `Error listing clusters: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // Run notebook tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'run_databricks_notebook',
        description: 'Run a notebook on Databricks',
        schema: z.object({
          notebook_path: z.string().describe('The path to the notebook'),
          base_params: z.record(z.any()).optional().describe('Parameters to pass to the notebook'),
          job_name: z.string().optional().describe('Name for the job')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.runNotebook({
              notebook_path: args.notebook_path,
              base_params: args.base_params || {},
              job_name: args.job_name
            });
            return result.content[0]?.text || 'No result returned';
          } catch (error) {
            return `Error running notebook: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // Train and register model tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'train_and_register_model',
        description: 'Train and register a model on Databricks',
        schema: z.object({
          model_type: z.string().describe('The model type to train (e.g., "shingrix-po")'),
          additional_params: z.record(z.any()).optional().describe('Additional parameters'),
          job_name: z.string().optional().describe('Name for the job')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.trainAndRegisterModel({
              model_type: args.model_type,
              additional_params: args.additional_params || {},
              job_name: args.job_name
            });
            return result.content[0]?.text || 'No result returned';
          } catch (error) {
            return `Error training model: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // Get experiment run info
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_latest_experiment_run',
        description: 'Get the latest run from an experiment',
        schema: z.object({
          experiment_id: z.string().describe('The experiment ID')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.getLatestExperimentRun(args.experiment_id);
            return result.content[0]?.text || 'No run found';
          } catch (error) {
            return `Error getting experiment run: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // Get model metadata tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_model_metadata',
        description: 'Get metadata for a model',
        schema: z.object({
          experiment_id: z.string().describe('The experiment ID')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.getModelMetadata(args.experiment_id);
            return result.content[0]?.text || 'No metadata found';
          } catch (error) {
            return `Error getting model metadata: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // Get registered model info tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_registered_model_info',
        description: 'Get information about a registered model',
        schema: z.object({
          model_name: z.string().describe('The name of the model'),
          uc_catalog: z.string().describe('The UC catalog name'),
          uc_schema: z.string().describe('The UC schema name')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.getRegisteredModelInfo(
              args.model_name,
              args.uc_catalog,
              args.uc_schema
            );
            return result.content[0]?.text || 'No model info found';
          } catch (error) {
            return `Error getting registered model info: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // Check job status tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'check_job_status',
        description: 'Check the status of a Databricks job',
        schema: z.object({
          job_id: z.string().describe('The job ID'),
          run_id: z.string().describe('The run ID')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.checkJobStatus(args.job_id, args.run_id);
            return result.content[0]?.text || 'No status found';
          } catch (error) {
            return `Error checking job status: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // Get running jobs tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_running_jobs',
        description: 'Get all running jobs',
        schema: z.object({}),
        func: async () => {
          try {
            const result = await this.mcpClient.getRunningJobs();
            return result.content[0]?.text || 'No running jobs found';
          } catch (error) {
            return `Error getting running jobs: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // Get job details tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_job_details',
        description: 'Get details for a job',
        schema: z.object({
          job_id: z.string().describe('The job ID')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.getJobDetails(args.job_id);
            return result.content[0]?.text || 'No job details found';
          } catch {
            return `Error getting job details for job ID ${args.job_id}`;
          }
        }
      })
    );
    
    // Get experiment info tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'get_train_experiment_info',
        description: 'Get training experiment info for a model type',
        schema: z.object({
          model_type: z.string().describe('The model type (e.g., "shingrix-po")')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.getTrainExperimentInfo(args.model_type);
            return result.content[0]?.text || 'No experiment info found';
          } catch (error) {
            return `Error getting training experiment info: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
    
    // Trigger Azure DevOps pipeline tool
    this.tools.push(
      new DynamicStructuredTool({
        name: 'trigger_azure_devops_pipeline',
        description: 'Trigger an Azure DevOps pipeline for model deployment',
        schema: z.object({
          model_type: z.string().describe('The model type to deploy'),
          branch: z.string().optional().describe('The branch to use (default: "dev")'),
          platform: z.string().optional().describe('The platform (default: "databricks")'),
          environment: z.string().optional().describe('The environment (default: "dev")')
        }),
        func: async (args) => {
          try {
            const result = await this.mcpClient.triggerAzureDevOpsPipeline(
              args.model_type,
              args.branch,
              args.platform,
              args.environment
            );
            return result.content[0]?.text || 'No pipeline info returned';
          } catch (error) {
            return `Error triggering Azure DevOps pipeline: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
      })
    );
  }
  
  private createGraph(): StateGraph {
    const graph = new StateGraph({
      channels: {
        messages: {},
      },
    });
    
    graph.addNode('agent', this.agentNode());
    graph.addNode('tools', this.toolNode());
    
    graph.setEntryPoint('agent');
    
    graph.addEdge('agent', 'tools', { condition: (state) => state.action === 'tools' });
    graph.addEdge('tools', 'agent');
    
    graph.addEdge('agent', END, { condition: (state) => state.action === END });
    
    return graph.compile();
  }
  
  private agentNode() {
    return async (state: any) => {
      const messages = [...state.messages];
      const systemMessage = new SystemMessage(
        `You are a knowledgeable Databricks assistant who can help with tasks like training models, running notebooks, checking jobs, and more.
        
        Think step by step and provide detailed explanations of your thought process.
        
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