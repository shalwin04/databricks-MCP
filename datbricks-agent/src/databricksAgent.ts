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
      // ===============================
      // CORE DATABRICKS OPERATIONS
      // ===============================
      case "runNotebook":
      case "run_notebook":
        return await this.mcp.runNotebook(
          params.notebookPath || params.notebook_path,
          params.baseParams || params.base_params || {},
          params.jobName || params.job_name || "AgentJob"
        );

      case "train":
      case "trainAndRegisterModel":
      case "train_and_register_model":
        return await this.mcp.trainAndRegisterModel(
          params.modelType || params.model_type || "shingrix-po",
          params.jobName || params.job_name || "DDT-Train-and-Register-Model",
          params.additionalParams || params.additional_params || {}
        );

      // ===============================
      // CLUSTER OPERATIONS
      // ===============================
      case "listClusters":
      case "list_clusters":
        return await this.mcp.listClusters();

      // ===============================
      // JOB OPERATIONS
      // ===============================
      case "listJobs":
      case "list_jobs":
        return await this.mcp.listJobs();

      case "getJobDetails":
      case "get_job_details":
        return await this.mcp.getJobDetails(params.jobId || params.job_id);

      case "deleteJob":
      case "delete_job":
        return await this.mcp.deleteJob(params.jobId || params.job_id);

      case "jobStatus":
      case "checkJobStatus":
      case "check_job_status":
      case "checkDatabricksJobStatus":
      case "check_databricks_job_status":
        return await this.mcp.checkJobStatus(
          params.jobId || params.job_id,
          params.runId || params.run_id
        );

      case "getRunningJobs":
      case "getRunningJobRuns":
      case "get_running_job_runs":
      case "getLatestRunningJobRuns":
      case "get_latest_running_job_runs":
        return await this.mcp.getRunningJobRuns();

      case "cancelJobRun":
      case "cancel_job_run":
        return await this.mcp.cancelJobRun(params.runId || params.run_id);

      // ===============================
      // MLFLOW EXPERIMENT OPERATIONS
      // ===============================
      case "listExperiments":
      case "list_experiments":
        return await this.mcp.listExperiments();

      case "createExperiment":
      case "create_experiment":
        return await this.mcp.createExperiment(params.name);

      case "deleteExperiment":
      case "delete_experiment":
        return await this.mcp.deleteExperiment(
          params.experimentId || params.experiment_id
        );

      case "getLatestExperimentRun":
      case "get_latest_experiment_run":
        return await this.mcp.getLatestExperimentRun(
          params.experimentId || params.experiment_id
        );

      case "getModelMetadata":
      case "get_model_metadata":
        return await this.mcp.getModelMetadata(
          params.experimentId || params.experiment_id
        );

      case "getTrainExperimentInfo":
      case "get_train_experiment_info":
        return await this.mcp.getTrainExperimentInfo(
          params.modelType || params.model_type
        );

      // ===============================
      // UNITY CATALOG OPERATIONS
      // ===============================
      case "listCatalogs":
      case "list_catalogs":
        return await this.mcp.listCatalogs();

      case "listSchemas":
      case "list_schemas":
        return await this.mcp.listSchemas(
          params.catalogName || params.catalog_name
        );

      case "listTables":
      case "list_tables":
        return await this.mcp.listTables(
          params.catalogName || params.catalog_name,
          params.schemaName || params.schema_name
        );

      case "listAllModels":
      case "list_all_models":
        return await this.mcp.listAllModels();

      case "getRegisteredModelInfo":
      case "get_registered_model_info":
        return await this.mcp.getRegisteredModelInfo(
          params.modelName || params.model_name,
          params.ucCatalog || params.uc_catalog,
          params.ucSchema || params.uc_schema
        );

      case "getModelVersions":
      case "get_model_versions":
        return await this.mcp.getModelVersions(
          params.fullName || params.full_name
        );

      // ===============================
      // WORKSPACE OPERATIONS
      // ===============================
      case "listWorkspaceObjects":
      case "list_workspace_objects":
        return await this.mcp.listWorkspaceObjects(params.path || "/");

      case "getWorkspaceStatus":
      case "get_workspace_status":
        return await this.mcp.getWorkspaceStatus(params.path);

      // ===============================
      // REPOSITORY OPERATIONS
      // ===============================
      case "listRepos":
      case "list_repos":
        return await this.mcp.listRepos();

      case "getRepoDetails":
      case "get_repo_details":
        return await this.mcp.getRepoDetails(params.repoId || params.repo_id);

      // ===============================
      // DBFS OPERATIONS
      // ===============================
      case "listDbfsFiles":
      case "list_dbfs_files":
        return await this.mcp.listDbfsFiles(params.path || "/");

      case "getDbfsFileInfo":
      case "get_dbfs_file_info":
        return await this.mcp.getDbfsFileInfo(params.path);

      // ===============================
      // LIBRARY OPERATIONS
      // ===============================
      case "listClusterLibraries":
      case "list_cluster_libraries":
        return await this.mcp.listClusterLibraries(
          params.clusterId || params.cluster_id
        );

      // ===============================
      // UTILITY OPERATIONS
      // ===============================
      case "convertEpochToDatetime":
      case "convert_epoch_to_datetime":
        return await this.mcp.convertEpochToDatetime(
          params.epochTimestamp || params.epoch_timestamp
        );

      // ===============================
      // AZURE DEVOPS INTEGRATION
      // ===============================
      case "triggerAzureDevOpsPipeline":
      case "trigger_azure_devops_pipeline":
        return await this.mcp.triggerAzureDevOpsPipeline(
          params.modelType || params.model_type,
          params.branch || "dev",
          params.platform || "databricks",
          params.environment || "dev"
        );

      // ===============================
      // DIRECT MCP TOOL CALLS
      // ===============================
      case "run_databricks_notebook":
        return await this.mcp.callTool("run_databricks_notebook", {
          notebook_path: params.notebook_path || params.notebookPath,
          base_params: params.base_params || params.baseParams,
          job_name: params.job_name || params.jobName,
        });

      case "train_and_register_model_direct":
        return await this.mcp.callTool("train_and_register_model", {
          model_type: params.model_type || params.modelType,
          job_name: params.job_name || params.jobName,
          additional_params:
            params.additional_params || params.additionalParams,
        });

      case "list_clusters_direct":
        return await this.mcp.callTool("list_clusters");

      case "list_jobs_direct":
        return await this.mcp.callTool("list_jobs");

      case "delete_job_direct":
        return await this.mcp.callTool("delete_job", {
          job_id: params.job_id || params.jobId,
        });

      case "cancel_job_run_direct":
        return await this.mcp.callTool("cancel_job_run", {
          run_id: params.run_id || params.runId,
        });

      case "list_experiments_direct":
        return await this.mcp.callTool("list_experiments");

      case "create_experiment_direct":
        return await this.mcp.callTool("create_experiment", {
          name: params.name,
        });

      case "delete_experiment_direct":
        return await this.mcp.callTool("delete_experiment", {
          experiment_id: params.experiment_id || params.experimentId,
        });

      case "list_workspace_objects_direct":
        return await this.mcp.callTool("list_workspace_objects", {
          path: params.path,
        });

      case "get_workspace_status_direct":
        return await this.mcp.callTool("get_workspace_status", {
          path: params.path,
        });

      case "list_catalogs_direct":
        return await this.mcp.callTool("list_catalogs");

      case "list_schemas_direct":
        return await this.mcp.callTool("list_schemas", {
          catalog_name: params.catalog_name || params.catalogName,
        });

      case "list_tables_direct":
        return await this.mcp.callTool("list_tables", {
          catalog_name: params.catalog_name || params.catalogName,
          schema_name: params.schema_name || params.schemaName,
        });

      case "list_all_models_direct":
        return await this.mcp.callTool("list_all_models");

      case "get_model_versions_direct":
        return await this.mcp.callTool("get_model_versions", {
          full_name: params.full_name || params.fullName,
        });

      case "list_repos_direct":
        return await this.mcp.callTool("list_repos");

      case "get_repo_details_direct":
        return await this.mcp.callTool("get_repo_details", {
          repo_id: params.repo_id || params.repoId,
        });

      case "list_dbfs_files_direct":
        return await this.mcp.callTool("list_dbfs_files", {
          path: params.path,
        });

      case "get_dbfs_file_info_direct":
        return await this.mcp.callTool("get_dbfs_file_info", {
          path: params.path,
        });

      case "list_cluster_libraries_direct":
        return await this.mcp.callTool("list_cluster_libraries", {
          cluster_id: params.cluster_id || params.clusterId,
        });

      // ===============================
      // META OPERATIONS
      // ===============================
      case "listTools":
      case "list_tools":
        return await this.mcp.listTools();

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
      // Core operations
      "runNotebook",
      "run_notebook",
      "train",
      "trainAndRegisterModel",
      "train_and_register_model",

      // Cluster operations
      "listClusters",
      "list_clusters",

      // Job operations
      "listJobs",
      "list_jobs",
      "getJobDetails",
      "get_job_details",
      "deleteJob",
      "delete_job",
      "jobStatus",
      "checkJobStatus",
      "check_job_status",
      "checkDatabricksJobStatus",
      "check_databricks_job_status",
      "getRunningJobs",
      "getRunningJobRuns",
      "get_running_job_runs",
      "getLatestRunningJobRuns",
      "get_latest_running_job_runs",
      "cancelJobRun",
      "cancel_job_run",

      // MLflow operations
      "listExperiments",
      "list_experiments",
      "createExperiment",
      "create_experiment",
      "deleteExperiment",
      "delete_experiment",
      "getLatestExperimentRun",
      "get_latest_experiment_run",
      "getModelMetadata",
      "get_model_metadata",
      "getTrainExperimentInfo",
      "get_train_experiment_info",

      // Unity Catalog operations
      "listCatalogs",
      "list_catalogs",
      "listSchemas",
      "list_schemas",
      "listTables",
      "list_tables",
      "listAllModels",
      "list_all_models",
      "getRegisteredModelInfo",
      "get_registered_model_info",
      "getModelVersions",
      "get_model_versions",

      // Workspace operations
      "listWorkspaceObjects",
      "list_workspace_objects",
      "getWorkspaceStatus",
      "get_workspace_status",

      // Repository operations
      "listRepos",
      "list_repos",
      "getRepoDetails",
      "get_repo_details",

      // DBFS operations
      "listDbfsFiles",
      "list_dbfs_files",
      "getDbfsFileInfo",
      "get_dbfs_file_info",

      // Library operations
      "listClusterLibraries",
      "list_cluster_libraries",

      // Utility operations
      "convertEpochToDatetime",
      "convert_epoch_to_datetime",

      // Azure DevOps integration
      "triggerAzureDevOpsPipeline",
      "trigger_azure_devops_pipeline",

      // Meta operations
      "listTools",
      "list_tools",
    ];
  }

  /**
   * Execute any MCP tool directly by name with parameters
   */
  async executeTool(toolName: string, params: Record<string, any> = {}) {
    return await this.mcp.callTool(toolName, params);
  }

  /**
   * Get information about available tools
   */
  async getAvailableTools() {
    return await this.mcp.listTools();
  }

  /**
   * Check if the client is connected to the MCP server
   */
  isConnected(): boolean {
    return this.mcp.isConnected();
  }

  /**
   * Batch execute multiple requests
   */
  async batchExecute(
    requests: Array<{ request: string; params?: Record<string, any> }>
  ) {
    const results = [];
    for (const { request, params } of requests) {
      try {
        const result = await this.handleRequest(request, params || {});
        results.push({ request, success: true, result });
      } catch (error) {
        results.push({
          request,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }

  /**
   * Execute a workflow of related operations
   */
  async executeWorkflow(
    workflowName: string,
    params: Record<string, any> = {}
  ) {
    switch (workflowName) {
      case "full_model_training":
        return await this.executeFullModelTrainingWorkflow(params);

      case "model_deployment":
        return await this.executeModelDeploymentWorkflow(params);

      case "cluster_management":
        return await this.executeClusterManagementWorkflow(params);

      case "experiment_cleanup":
        return await this.executeExperimentCleanupWorkflow(params);

      default:
        throw new Error(`Unknown workflow: ${workflowName}`);
    }
  }

  /**
   * Full model training workflow
   */
  private async executeFullModelTrainingWorkflow(params: Record<string, any>) {
    const results = [];

    try {
      // 1. Get training experiment info
      const expInfo = await this.handleRequest("getTrainExperimentInfo", {
        modelType: params.modelType || "shingrix-po",
      });
      results.push({
        step: "get_experiment_info",
        success: true,
        result: expInfo,
      });

      // 2. Start training
      const training = await this.handleRequest("train", {
        modelType: params.modelType || "shingrix-po",
        jobName: params.jobName || "Workflow-Training",
        additionalParams: params.additionalParams || {},
      });
      results.push({ step: "start_training", success: true, result: training });

      // 3. Monitor job status (if job_id and run_id are available)
      if (params.jobId && params.runId) {
        const status = await this.handleRequest("checkJobStatus", {
          jobId: params.jobId,
          runId: params.runId,
        });
        results.push({ step: "check_status", success: true, result: status });
      }

      return { workflow: "full_model_training", success: true, results };
    } catch (error) {
      return {
        workflow: "full_model_training",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results,
      };
    }
  }

  /**
   * Model deployment workflow
   */
  private async executeModelDeploymentWorkflow(params: Record<string, any>) {
    const results = [];

    try {
      // 1. Get model info
      if (params.modelName && params.ucCatalog && params.ucSchema) {
        const modelInfo = await this.handleRequest("getRegisteredModelInfo", {
          modelName: params.modelName,
          ucCatalog: params.ucCatalog,
          ucSchema: params.ucSchema,
        });
        results.push({
          step: "get_model_info",
          success: true,
          result: modelInfo,
        });
      }

      // 2. Trigger Azure DevOps pipeline
      const deployment = await this.handleRequest(
        "triggerAzureDevOpsPipeline",
        {
          modelType: params.modelType,
          branch: params.branch || "dev",
          platform: params.platform || "databricks",
          environment: params.environment || "dev",
        }
      );
      results.push({
        step: "trigger_deployment",
        success: true,
        result: deployment,
      });

      return { workflow: "model_deployment", success: true, results };
    } catch (error) {
      return {
        workflow: "model_deployment",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results,
      };
    }
  }

  /**
   * Cluster management workflow
   */
  private async executeClusterManagementWorkflow(params: Record<string, any>) {
    const results = [];

    try {
      // 1. List all clusters
      const clusters = await this.handleRequest("listClusters");
      results.push({ step: "list_clusters", success: true, result: clusters });

      // 2. List cluster libraries if cluster ID provided
      if (params.clusterId) {
        const libraries = await this.handleRequest("listClusterLibraries", {
          clusterId: params.clusterId,
        });
        results.push({
          step: "list_libraries",
          success: true,
          result: libraries,
        });
      }

      return { workflow: "cluster_management", success: true, results };
    } catch (error) {
      return {
        workflow: "cluster_management",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results,
      };
    }
  }

  /**
   * Experiment cleanup workflow
   */
  private async executeExperimentCleanupWorkflow(params: Record<string, any>) {
    const results = [];

    try {
      // 1. List all experiments
      const experiments = await this.handleRequest("listExperiments");
      results.push({
        step: "list_experiments",
        success: true,
        result: experiments,
      });

      // 2. Delete specific experiment if provided
      if (params.experimentId) {
        const deletion = await this.handleRequest("deleteExperiment", {
          experimentId: params.experimentId,
        });
        results.push({
          step: "delete_experiment",
          success: true,
          result: deletion,
        });
      }

      return { workflow: "experiment_cleanup", success: true, results };
    } catch (error) {
      return {
        workflow: "experiment_cleanup",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        results,
      };
    }
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

    try {
      // Example: Execute full model training workflow
      const workflowResult = await agent.executeWorkflow(
        "full_model_training",
        {
          modelType: "shingrix-po",
          jobName: "Example-Workflow-Training",
        }
      );
      console.log("Workflow Result:", JSON.stringify(workflowResult, null, 2));

      // Example: Batch execute multiple operations
      const batchResult = await agent.batchExecute([
        { request: "listClusters" },
        { request: "listJobs" },
        { request: "listExperiments" },
      ]);
      console.log("Batch Result:", JSON.stringify(batchResult, null, 2));
    } catch (error) {
      console.error("Error:", error);
    } finally {
      await agent.disconnect();
    }
  })();
}
