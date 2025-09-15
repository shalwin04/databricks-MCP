import { DatabricksQueryParams, MCPToolResult, NotebookRunParams, TrainModelParams } from './mcp-client-new.js';

/**
 * MockMCPClient provides mock implementations for all MCP operations
 * This is used as a fallback when the real MCP server cannot be connected to
 */
export class MockMCPClient {
  private static availableTools = [
    'run_databricks_notebook',
    'train_and_register_model',
    'get_latest_experiment_run',
    'get_model_metadata',
    'get_registered_model_info',
    'check_databricks_job_status',
    'get_latest_running_job_runs',
    'get_job_details',
    'convert_epoch_to_datetime',
    'get_train_experiment_info',
    'trigger_azure_devops_pipeline',
    'list_clusters',
  ];

  async connect(): Promise<void> {
    console.log('🔄 Using mock MCP client (mock data only)');
  }

  async disconnect(): Promise<void> {
    console.log('🔄 Mock MCP client disconnected');
  }

  getAvailableTools(): any[] {
    return MockMCPClient.availableTools.map(name => ({ 
      name,
      description: `Mock implementation of ${name}`
    }));
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async checkConnection(): Promise<boolean> {
    return true;
  }

  get connected(): boolean {
    return true;
  }

  async reconnect(): Promise<void> {
    console.log('🔄 Mock MCP client reconnected');
  }

  // Mock implementations for all operations
  
  async executeQuery(params: DatabricksQueryParams): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          results: [{ test: 1 }],
          query: params.query,
          warehouse_id: params.warehouse_id,
          message: '[MOCK DATA] Query executed successfully'
        }, null, 2)
      }]
    };
  }

  async listClusters(): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          clusters: [
            {
              cluster_id: 'mock-cluster-1',
              cluster_name: 'Mock Cluster 1',
              state: 'RUNNING',
              node_type_id: 'Standard_DS3_v2',
              num_workers: 2
            },
            {
              cluster_id: 'mock-cluster-2',
              cluster_name: 'Mock Cluster 2',
              state: 'TERMINATED',
              node_type_id: 'Standard_DS3_v2',
              num_workers: 4
            }
          ],
          message: '[MOCK DATA] Clusters listed successfully'
        }, null, 2)
      }]
    };
  }

  async runNotebook(params: NotebookRunParams): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          job_id: '12345',
          run_id: '67890',
          notebook_path: params.notebook_path,
          base_params: params.base_params,
          job_name: params.job_name,
          message: '[MOCK DATA] Notebook run triggered successfully'
        }, null, 2)
      }]
    };
  }

  async trainAndRegisterModel(
    modelTypeOrParams: string | TrainModelParams,
    additionalParams?: Record<string, any>,
    jobName?: string
  ): Promise<MCPToolResult> {
    let modelType: string;
    let params: any = {};
    let job: string = 'DDT-Train-and-Register-Model';

    if (typeof modelTypeOrParams === 'string') {
      modelType = modelTypeOrParams;
      params = additionalParams || {};
      job = jobName || job;
    } else {
      modelType = modelTypeOrParams.model_type;
      params = modelTypeOrParams.additional_params || {};
      job = modelTypeOrParams.job_name || job;
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: `[MOCK DATA] Shingrix model training job has been triggered with job: 12345.`,
          job_id: '12345',
          run_id: '67890',
          experiment_id: '123',
          model_name: `${modelType}_model`,
          uc_catalog: 'main',
          uc_schema: 'ml_models'
        }, null, 2)
      }]
    };
  }

  async getLatestExperimentRun(experimentId: string): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          experiment_id: experimentId,
          run_id: 'mock-run-123',
          status: 'COMPLETED',
          start_time: Date.now() - 3600000,
          end_time: Date.now(),
          metrics: {
            accuracy: 0.95,
            f1_score: 0.94
          },
          message: '[MOCK DATA] Latest run retrieved successfully'
        }, null, 2)
      }]
    };
  }

  async getModelMetadata(experimentId: string): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          experiment_id: experimentId,
          name: '/Shared/ShingrixPO',
          artifact_location: 'dbfs:/databricks/mlflow-tracking/123456789',
          tags: {
            model_type: 'shingrix-po',
            environment: 'dev'
          },
          message: '[MOCK DATA] Model metadata retrieved successfully'
        }, null, 2)
      }]
    };
  }

  async getRegisteredModelInfo(
    modelName: string,
    ucCatalog: string,
    ucSchema: string
  ): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          name: `${ucCatalog}.${ucSchema}.${modelName}`,
          creation_timestamp: Date.now() - 86400000,
          last_updated_timestamp: Date.now(),
          user_id: 'mock-user-123',
          versions: [
            {
              version: '1',
              status: 'READY',
              creation_timestamp: Date.now() - 86400000,
              last_updated_timestamp: Date.now()
            }
          ],
          message: '[MOCK DATA] Registered model info retrieved successfully'
        }, null, 2)
      }]
    };
  }

  async getJobStatus(jobId: string, runId: string): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: `[MOCK DATA] Job ${jobId} (Run ${runId}) is currently in state: RUNNING.`
      }]
    };
  }

  async checkJobStatus(jobId: string, runId: string): Promise<MCPToolResult> {
    return this.getJobStatus(jobId, runId);
  }

  async getRunningJobs(): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          runs: [
            {
              job_id: 12345,
              run_id: 67890,
              state: 'RUNNING',
              start_time: Date.now() - 1800000
            }
          ],
          message: '[MOCK DATA] Running jobs retrieved successfully'
        }, null, 2)
      }]
    };
  }

  async getJobDetails(jobId: string): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          job_id: parseInt(jobId),
          creator_user_name: 'mock-user',
          settings: {
            name: 'Mock Job',
            tasks: [
              {
                task_key: 'task1',
                notebook_task: {
                  notebook_path: '/path/to/notebook',
                  base_parameters: {}
                },
                existing_cluster_id: 'mock-cluster-1'
              }
            ]
          },
          created_time: Date.now() - 86400000,
          message: '[MOCK DATA] Job details retrieved successfully'
        }, null, 2)
      }]
    };
  }

  async convertEpochToDatetime(epochTimestamp: string): Promise<MCPToolResult> {
    const timestamp = parseInt(epochTimestamp);
    const dt = new Date(timestamp * 1000).toLocaleString();
    
    return {
      content: [{
        type: 'text',
        text: `[MOCK DATA] Epoch ${epochTimestamp} -> ${dt}`
      }]
    };
  }

  async getTrainExperimentInfo(modelType: string): Promise<MCPToolResult> {
    const defaultParams = {
      baseline_table: "catalog.schema.baseline_table",
      env: "dev",
      experiment_id: "123",
      experiment_name: `/Shared/${modelType.charAt(0).toUpperCase() + modelType.slice(1)}`,
      model_name: `${modelType}_model`,
      monitoring_mode: "enabled",
      training_script_path: "/path/to/training/script",
      uc_catalog: "main",
      uc_schema: "ml_models"
    };

    const paramsDescriptions = {
      baseline_table: "Input table for baseline data.",
      env: "Environment to run the training (dev, prod, etc).",
      experiment_id: "MLflow experiment ID.",
      experiment_name: "MLflow experiment name.",
      model_name: "Name for the trained model.",
      monitoring_mode: "Enable/disable model monitoring.",
      training_script_path: "Path to the training script.",
      uc_catalog: "Unity Catalog catalog name.",
      uc_schema: "Unity Catalog schema name."
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          param_descriptions: paramsDescriptions,
          default_params: defaultParams,
          message: '[MOCK DATA] Training experiment info retrieved successfully'
        }, null, 2)
      }]
    };
  }

  async triggerAzureDevOpsPipeline(
    modelType: string,
    branch: string = 'dev',
    platform: string = 'databricks',
    environment: string = 'dev'
  ): Promise<MCPToolResult> {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          state: 'InProgress',
          run_id: '123456',
          url: 'https://dev.azure.com/org/project/_build/results?buildId=123456',
          created_date: new Date().toISOString(),
          message: `[MOCK DATA] Successfully triggered Azure DevOps pipeline for model ${modelType}.`
        }, null, 2)
      }]
    };
  }
}
