import DatabricksMCPClient from "./client.js";

export class DatabricksAgent {
  private mcp: DatabricksMCPClient;

  constructor(serverUrl?: string) {
    this.mcp = new DatabricksMCPClient(serverUrl);
  }

  async connect() {
    await this.mcp.connect();
  }

  async disconnect() {
    await this.mcp.disconnect();
  }

  async handleRequest(request: string, params: Record<string, any> = {}) {
    switch (request) {
      // Existing convenience method mappings
      case "train":
        return await this.mcp.trainAndRegisterModel(
          params.modelType || "shingrix-po",
          params.jobName || "DDT-Train-and-Register-Model",
          params.additionalParams || {}
        );
      case "runNotebook":
        return await this.mcp.runNotebook(
          params.notebookPath,
          params.baseParams || {},
          params.jobName || "AgentJob"
        );
      case "jobStatus":
        return await this.mcp.checkJobStatus(params.jobId, params.runId);
      case "listTools":
        return await this.mcp.listTools();
      case "getModelMetadata":
        return await this.mcp.getModelMetadata(params.experimentId);
      case "getRegisteredModelInfo":
        return await this.mcp.getRegisteredModelInfo(
          params.modelName,
          params.ucCatalog,
          params.ucSchema
        );
      case "getLatestExperimentRun":
        return await this.mcp.getLatestExperimentRun(params.experimentId);
      case "getJobDetails":
        return await this.mcp.getJobDetails(params.jobId);
      case "getRunningJobs":
        return await this.mcp.getRunningJobRuns();
      case "convertEpochToDatetime":
        return await this.mcp.convertEpochToDatetime(params.epochTimestamp);
      case "getTrainExperimentInfo":
        return await this.mcp.getTrainExperimentInfo(params.modelType);
      case "triggerAzureDevOpsPipeline":
        return await this.mcp.triggerAzureDevOpsPipeline(
          params.modelType,
          params.branch,
          params.platform,
          params.environment
        );

      // Direct MCP tool mappings
      case "listClusters":
        return await this.mcp.callTool("list_clusters");
      case "runDatabricksNotebook":
        return await this.mcp.callTool("run_databricks_notebook", {
          notebook_path: params.notebookPath,
          base_params: params.baseParams,
          job_name: params.jobName,
        });
      case "trainAndRegisterModel":
        return await this.mcp.callTool("train_and_register_model", {
          model_type: params.modelType,
          job_name: params.jobName,
          additional_params: params.additionalParams,
        });
      case "getLatestExperimentRunDirect":
        return await this.mcp.callTool("get_latest_experiment_run", {
          experiment_id: params.experimentId,
        });
      case "getModelMetadataDirect":
        return await this.mcp.callTool("get_model_metadata", {
          experiment_id: params.experimentId,
        });
      case "getRegisteredModelInfoDirect":
        return await this.mcp.callTool("get_registered_model_info", {
          model_name: params.modelName,
          uc_catalog: params.ucCatalog,
          uc_schema: params.ucSchema,
        });
      case "checkDatabricksJobStatus":
        return await this.mcp.callTool("check_databricks_job_status", {
          job_id: params.jobId,
          run_id: params.runId,
        });
      case "getLatestRunningJobRuns":
        return await this.mcp.callTool("get_latest_running_job_runs");
      case "getJobDetailsDirect":
        return await this.mcp.callTool("get_job_details", {
          job_id: params.jobId,
        });
      case "convertEpochToDatetimeDirect":
        return await this.mcp.callTool("convert_epoch_to_datetime", {
          epoch_timestamp: params.epochTimestamp,
        });
      case "getTrainExperimentInfoDirect":
        return await this.mcp.callTool("get_train_experiment_info", {
          model_type: params.modelType,
        });
      case "triggerAzureDevOpsPipelineDirect":
        return await this.mcp.callTool("trigger_azure_devops_pipeline", {
          model_type: params.modelType,
          branch: params.branch,
          platform: params.platform,
          environment: params.environment,
        });

      // Additional common request patterns
      case "startCluster":
        // You'd need to add this tool to your server first
        return await this.mcp.callTool("start_cluster", {
          cluster_id: params.clusterId,
        });
      case "createCluster":
        // You'd need to add this tool to your server first
        return await this.mcp.callTool("create_cluster", {
          cluster_config: params.clusterConfig,
        });
      case "listJobs":
        // You'd need to add this tool to your server first
        return await this.mcp.callTool("list_jobs");
      case "listExperiments":
        // You'd need to add this tool to your server first
        return await this.mcp.callTool("list_experiments");

      default:
        throw new Error(
          `Unknown request: ${request}\nAvailable requests: ${this.getAvailableRequests().join(
            ", "
          )}`
        );
    }
  }

  /**
   * Get list of available request types for better error messages
   */
  private getAvailableRequests(): string[] {
    return [
      "train",
      "runNotebook",
      "jobStatus",
      "listTools",
      "getModelMetadata",
      "getRegisteredModelInfo",
      "getLatestExperimentRun",
      "getJobDetails",
      "getRunningJobs",
      "convertEpochToDatetime",
      "getTrainExperimentInfo",
      "triggerAzureDevOpsPipeline",
      "listClusters",
      "runDatabricksNotebook",
      "trainAndRegisterModel",
      "getLatestExperimentRunDirect",
      "getModelMetadataDirect",
      "getRegisteredModelInfoDirect",
      "checkDatabricksJobStatus",
      "getLatestRunningJobRuns",
      "getJobDetailsDirect",
      "convertEpochToDatetimeDirect",
      "getTrainExperimentInfoDirect",
      "triggerAzureDevOpsPipelineDirect",
    ];
  }
}

// Example usage (ESM compatible)
if (
  typeof import.meta !== "undefined" &&
  import.meta.url === `file://${process.argv[1]}`
) {
  (async () => {
    const agent = new DatabricksAgent(process.argv[2]);
    await agent.connect();

    // Example: train model
    const result = await agent.handleRequest("train", {
      modelType: "shingrix-po",
    });
    console.log("Result:", result);

    // Example: list clusters
    const clusters = await agent.handleRequest("listClusters");
    console.log("Clusters:", clusters);

    await agent.disconnect();
  })();
}
