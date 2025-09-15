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
      default:
        throw new Error(`Unknown request: ${request}`);
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
    // Example: train model
    const result = await agent.handleRequest("train", {
      modelType: "shingrix-po",
    });
    console.log("Result:", result);
    await agent.disconnect();
  })();
}
