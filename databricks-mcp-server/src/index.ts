#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";

// Load environment variables
dotenv.config();

// Configuration interfaces
interface ModelConfig {
  [key: string]: {
    baseline_table: string;
    env: string;
    experiment_id: string;
    experiment_name: string;
    model_name: string;
    monitoring_mode: string;
    training_script_path: string;
    uc_catalog: string;
    uc_schema: string;
  };
}

interface PipelineConfig {
  [key: string]: {
    pipeline_id: number;
    parameters: Record<string, any>;
  };
}

// Mock configurations - replace with your actual configs
const MODEL_CONFIG: ModelConfig = {
  "shingrix-po": {
    baseline_table: "catalog.schema.baseline_table",
    env: "dev",
    experiment_id: "123",
    experiment_name: "/Shared/ShingrixPO",
    model_name: "shingrix_po_model",
    monitoring_mode: "enabled",
    training_script_path: "/path/to/training/script",
    uc_catalog: "main",
    uc_schema: "ml_models",
  },
  "shingrix-ppo": {
    baseline_table: "catalog.schema.baseline_table_ppo",
    env: "dev",
    experiment_id: "124",
    experiment_name: "/Shared/ShingrixPPO",
    model_name: "shingrix_ppo_model",
    monitoring_mode: "enabled",
    training_script_path: "/path/to/training/script",
    uc_catalog: "main",
    uc_schema: "ml_models",
  },
  "digital-twin": {
    baseline_table: "catalog.schema.digital_twin_table",
    env: "dev",
    experiment_id: "125",
    experiment_name: "/Shared/DigitalTwin",
    model_name: "digital_twin_model",
    monitoring_mode: "enabled",
    training_script_path: "/path/to/training/script",
    uc_catalog: "main",
    uc_schema: "ml_models",
  },
};

const PIPELINE_CONFIG: PipelineConfig = {
  "shingrix-po": {
    pipeline_id: 1,
    parameters: {
      model_type: "shingrix-po",
      environment: "dev",
    },
  },
  "shingrix-ppo": {
    pipeline_id: 2,
    parameters: {
      model_type: "shingrix-ppo",
      environment: "dev",
    },
  },
  "digital-twin": {
    pipeline_id: 3,
    parameters: {
      model_type: "digital-twin",
      environment: "dev",
    },
  },
};

class DatabricksClient {
  private host: string;
  private token: string;
  private baseUrl: string;

  constructor() {
    this.host = process.env.DATABRICKS_HOST || "";
    this.token = process.env.DATABRICKS_TOKEN || "";

    if (!this.host || !this.token) {
      throw new Error(
        "DATABRICKS_HOST and DATABRICKS_TOKEN must be set in environment variables"
      );
    }

    this.baseUrl = `${this.host}/api/2.1`;
  }

  private async makeRequest(
    endpoint: string,
    method: string = "GET",
    data?: any
  ): Promise<any> {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        data,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`Databricks API error: ${error.message}`);
    }
  }

  async listClusters(): Promise<any> {
    return this.makeRequest("/clusters/list");
  }

  async startCluster(clusterId: string): Promise<any> {
    return this.makeRequest("/clusters/start", "POST", {
      cluster_id: clusterId,
    });
  }

  async createCluster(config: any): Promise<any> {
    return this.makeRequest("/clusters/create", "POST", config);
  }

  async createJob(jobSettings: any): Promise<any> {
    return this.makeRequest("/jobs/create", "POST", jobSettings);
  }

  async runNow(jobId: number): Promise<any> {
    return this.makeRequest("/jobs/run-now", "POST", { job_id: jobId });
  }

  async getRun(runId: number): Promise<any> {
    return this.makeRequest(`/jobs/runs/get?run_id=${runId}`);
  }

  async getJob(jobId: number): Promise<any> {
    return this.makeRequest(`/jobs/get?job_id=${jobId}`);
  }

  async listRuns(activeOnly: boolean = false): Promise<any> {
    const params = activeOnly ? "?active_only=true" : "";
    return this.makeRequest(`/jobs/runs/list${params}`);
  }

  async getExperiment(experimentId: string): Promise<any> {
    return this.makeRequest(
      `/mlflow/experiments/get?experiment_id=${experimentId}`
    );
  }

  async getExperimentByName(name: string): Promise<any> {
    return this.makeRequest(
      `/mlflow/experiments/get-by-name?experiment_name=${encodeURIComponent(
        name
      )}`
    );
  }

  async createExperiment(name: string): Promise<any> {
    return this.makeRequest("/mlflow/experiments/create", "POST", { name });
  }

  async searchRuns(
    experimentIds: string[],
    orderBy: string[] = [],
    maxResults: number = 1000
  ): Promise<any> {
    return this.makeRequest("/mlflow/runs/search", "POST", {
      experiment_ids: experimentIds,
      order_by: orderBy,
      max_results: maxResults,
    });
  }

  async getRegisteredModel(fullName: string): Promise<any> {
    return this.makeRequest(
      `/unity-catalog/models/${encodeURIComponent(fullName)}`
    );
  }
}

class DatabricksNotebookRunner {
  private client: DatabricksClient;

  constructor() {
    this.client = new DatabricksClient();
  }

  async getRunningClusterId(): Promise<string> {
    const clusterId = process.env.CLUSTER_ID;
    if (clusterId) return clusterId;

    const clusters = await this.client.listClusters();

    // Find running cluster
    for (const cluster of clusters.clusters || []) {
      if (cluster.state === "RUNNING") {
        return cluster.cluster_id;
      }
    }

    // Start a terminated cluster
    for (const cluster of clusters.clusters || []) {
      if (["TERMINATED", "STOPPED"].includes(cluster.state)) {
        await this.client.startCluster(cluster.cluster_id);
        return cluster.cluster_id;
      }
    }

    // Create new cluster
    const clusterConfig = {
      cluster_name: "NewCluster",
      spark_version: "11.3.x-scala2.12",
      node_type_id: "Standard_DS3_v2",
      num_workers: 2,
    };

    const result = await this.client.createCluster(clusterConfig);
    return result.cluster_id;
  }

  async createAndRunNotebook(
    notebookPath: string,
    baseParams: Record<string, any> = {},
    jobName: string = "AgentJob"
  ): Promise<{ jobId: number; runId: number }> {
    const clusterId = await this.getRunningClusterId();

    const jobSettings = {
      name: jobName,
      tasks: [
        {
          task_key: "task1",
          notebook_task: {
            notebook_path: notebookPath,
            base_parameters: baseParams,
            source: "WORKSPACE",
          },
          existing_cluster_id: clusterId,
        },
      ],
      max_concurrent_runs: 1,
    };

    const jobResp = await this.client.createJob(jobSettings);
    const runResp = await this.client.runNow(jobResp.job_id);

    return { jobId: jobResp.job_id, runId: runResp.run_id };
  }

  async waitForCompletion(
    runId: number,
    pollInterval: number = 10000
  ): Promise<any> {
    while (true) {
      const resp = await this.client.getRun(runId);
      const state = resp.state?.life_cycle_state;

      if (["TERMINATED", "SKIPPED", "INTERNAL_ERROR"].includes(state)) {
        return resp;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }
}

async function checkForExperiment(experimentName: string): Promise<any> {
  const runner = new DatabricksNotebookRunner();
  const client = new DatabricksClient();

  if (!experimentName) {
    return { error: "Please provide experiment_name." };
  }

  const experimentPath = `/Shared/${experimentName}`;

  try {
    const experiment = await client.getExperimentByName(experimentPath);
    return {
      experiment_id: experiment.experiment.experiment_id,
      experiment_name: experiment.experiment.name,
    };
  } catch (error) {
    // Experiment not found, create it
    try {
      const created = await client.createExperiment(experimentPath);
      return {
        experiment_id: created.experiment_id,
        experiment_name: experimentPath,
      };
    } catch (createError: any) {
      return {
        error: `Failed to get or create experiment: ${createError.message}`,
      };
    }
  }
}

const server = new Server(
  {
    name: "databricks-mcp-server",
    version: "0.1.0", // Keep this consistent with the client
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "run_databricks_notebook",
        description: "Runs a Databricks notebook on a running cluster",
        inputSchema: {
          type: "object",
          properties: {
            notebook_path: {
              type: "string",
              description: "Path to the notebook",
            },
            base_params: {
              type: "object",
              description: "Parameters for the notebook",
            },
            job_name: {
              type: "string",
              description: "Name for the job",
              default: "AgentJob",
            },
          },
          required: ["notebook_path"],
        },
      },
      {
        name: "train_and_register_model",
        description: "Train, log and register the model on Databricks",
        inputSchema: {
          type: "object",
          properties: {
            job_name: {
              type: "string",
              description: "Name of the job",
              default: "DDT-Train-and-Register-Model",
            },
            additional_params: {
              type: "object",
              description: "Additional parameters for training",
            },
            model_type: {
              type: "string",
              description: "Type of model",
              enum: ["shingrix-po", "shingrix-ppo", "digital-twin"],
              default: "shingrix-po",
            },
          },
          required: [],
        },
      },
      {
        name: "get_latest_experiment_run",
        description: "Fetches the latest run from a Databricks ML experiment",
        inputSchema: {
          type: "object",
          properties: {
            experiment_id: { type: "string", description: "ML experiment ID" },
          },
          required: ["experiment_id"],
        },
      },
      {
        name: "get_model_metadata",
        description: "Fetches model metadata from a Databricks ML experiment",
        inputSchema: {
          type: "object",
          properties: {
            experiment_id: { type: "string", description: "ML experiment ID" },
          },
          required: ["experiment_id"],
        },
      },
      {
        name: "get_registered_model_info",
        description: "Fetches registered model info from Unity Catalog",
        inputSchema: {
          type: "object",
          properties: {
            model_name: { type: "string", description: "Name of the model" },
            uc_catalog: {
              type: "string",
              description: "Unity Catalog catalog name",
            },
            uc_schema: {
              type: "string",
              description: "Unity Catalog schema name",
            },
          },
          required: ["model_name", "uc_catalog", "uc_schema"],
        },
      },
      {
        name: "check_databricks_job_status",
        description: "Checks the status of a Databricks job",
        inputSchema: {
          type: "object",
          properties: {
            job_id: { type: "string", description: "Job ID" },
            run_id: { type: "string", description: "Run ID" },
          },
          required: ["job_id", "run_id"],
        },
      },
      {
        name: "get_latest_running_job_runs",
        description: "Fetches all running Databricks job runs",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_job_details",
        description: "Fetches details for a specific Databricks job",
        inputSchema: {
          type: "object",
          properties: {
            job_id: { type: "string", description: "Job ID" },
          },
          required: ["job_id"],
        },
      },
      {
        name: "convert_epoch_to_datetime",
        description: "Converts an epoch timestamp to readable date and time",
        inputSchema: {
          type: "object",
          properties: {
            epoch_timestamp: { type: "string", description: "Epoch timestamp" },
          },
          required: ["epoch_timestamp"],
        },
      },
      {
        name: "get_train_experiment_info",
        description:
          "Provides information about training parameters for a model type",
        inputSchema: {
          type: "object",
          properties: {
            model_type: {
              type: "string",
              description: "Type of model",
              enum: ["shingrix-po", "shingrix-ppo", "digital-twin"],
            },
          },
          required: ["model_type"],
        },
      },
      {
        name: "trigger_azure_devops_pipeline",
        description: "Triggers an Azure DevOps pipeline for model deployment",
        inputSchema: {
          type: "object",
          properties: {
            model_type: { type: "string", description: "Type of model" },
            branch: {
              type: "string",
              description: "Git branch",
              default: "dev",
            },
            platform: {
              type: "string",
              description: "Deployment platform",
              default: "databricks",
            },
            environment: {
              type: "string",
              description: "Deployment environment",
              default: "dev",
            },
          },
          required: ["model_type"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "run_databricks_notebook": {
        const {
          notebook_path,
          base_params = {},
          job_name = "AgentJob",
        } = args as any;
        const runner = new DatabricksNotebookRunner();
        const { jobId, runId } = await runner.createAndRunNotebook(
          notebook_path,
          base_params,
          job_name
        );
        return {
          content: [
            {
              type: "text",
              text: `Databricks Job ${jobId} has been triggered.`,
            },
          ],
        };
      }

      case "train_and_register_model": {
        const {
          job_name = "DDT-Train-and-Register-Model",
          additional_params = {},
          model_type = "shingrix-po",
        } = args as any;

        const notebookPath =
          "/Workspace/Shared/D3-DDT-Train_R_models/Train_R_Model_Cloned";
        let baseParams = MODEL_CONFIG[model_type];

        if (!baseParams) {
          return {
            content: [
              {
                type: "text",
                text: `Provided model is not supported. Supported Models are: ${Object.keys(
                  MODEL_CONFIG
                ).join(", ")}`,
              },
            ],
          };
        }

        // Handle experiment name
        const newExperimentName = additional_params.experiment_name;
        if (newExperimentName) {
          const experimentResult = await checkForExperiment(newExperimentName);
          if (!experimentResult.error) {
            if (
              experimentResult.experiment_name !== baseParams.experiment_name
            ) {
              baseParams.experiment_id = experimentResult.experiment_id;
              baseParams.experiment_name = experimentResult.experiment_name;
            }
          }
        }

        if (additional_params) {
          baseParams = { ...baseParams, ...additional_params };
        }

        const runner = new DatabricksNotebookRunner();
        const { jobId, runId } = await runner.createAndRunNotebook(
          notebookPath,
          baseParams,
          job_name
        );

        const response = {
          message: `Shingrix model training job has been triggered with job: ${jobId}.`,
          job_id: jobId,
          run_id: runId,
          experiment_id: baseParams.experiment_id,
          model_name: baseParams.model_name,
          uc_catalog: baseParams.uc_catalog,
          uc_schema: baseParams.uc_schema,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }

      case "get_latest_experiment_run": {
        const { experiment_id } = args as any;
        const client = new DatabricksClient();
        const runs = await client.searchRuns(
          [experiment_id],
          ["start_time DESC"],
          1
        );

        if (runs.runs && runs.runs.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(runs.runs[0], null, 2),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: "No runs found for this experiment.",
              },
            ],
          };
        }
      }

      case "get_model_metadata": {
        const { experiment_id } = args as any;
        const client = new DatabricksClient();
        const experiment = await client.getExperiment(experiment_id);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(experiment, null, 2),
            },
          ],
        };
      }

      case "get_registered_model_info": {
        const { model_name, uc_catalog, uc_schema } = args as any;
        const client = new DatabricksClient();
        const fullModelName = `${uc_catalog}.${uc_schema}.${model_name}`;
        const modelInfo = await client.getRegisteredModel(fullModelName);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(modelInfo, null, 2),
            },
          ],
        };
      }

      case "check_databricks_job_status": {
        const { job_id, run_id } = args as any;
        const client = new DatabricksClient();
        const resp = await client.getRun(parseInt(run_id));
        const state = resp.state?.life_cycle_state;

        let resultMessage = `Job ${job_id} (Run ${run_id}) is currently in state: ${state}.`;
        if (resp.state?.result_state) {
          resultMessage += ` Result: ${resp.state.result_state}.`;
        }

        return {
          content: [
            {
              type: "text",
              text: resultMessage,
            },
          ],
        };
      }

      case "get_latest_running_job_runs": {
        const client = new DatabricksClient();
        const runs = await client.listRuns(true);

        if (runs.runs && runs.runs.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(runs.runs, null, 2),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: "No running job runs found.",
              },
            ],
          };
        }
      }

      case "get_job_details": {
        const { job_id } = args as any;
        const client = new DatabricksClient();
        const job = await client.getJob(parseInt(job_id));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(job, null, 2),
            },
          ],
        };
      }

      case "convert_epoch_to_datetime": {
        const { epoch_timestamp } = args as any;
        const timestamp = parseInt(epoch_timestamp);
        const dt = new Date(timestamp * 1000).toLocaleString();

        return {
          content: [
            {
              type: "text",
              text: `Epoch ${epoch_timestamp} -> ${dt}`,
            },
          ],
        };
      }

      case "get_train_experiment_info": {
        const { model_type } = args as any;
        const defaultParams = MODEL_CONFIG[model_type];

        if (!defaultParams) {
          return {
            content: [
              {
                type: "text",
                text: `Unknown model_type: ${model_type}. Supported: ${Object.keys(
                  MODEL_CONFIG
                ).join(", ")}.`,
              },
            ],
          };
        }

        const paramsDescriptions = {
          baseline_table: "Input table for baseline data.",
          env: "Environment to run the training (dev, prod, etc).",
          experiment_id: "MLflow experiment ID.",
          experiment_name: "MLflow experiment name.",
          model_name: "Name for the trained model.",
          monitoring_mode: "Enable/disable model monitoring.",
          training_script_path: "Path to the training script.",
          uc_catalog: "Unity Catalog catalog name.",
          uc_schema: "Unity Catalog schema name.",
        };

        const info = {
          param_descriptions: paramsDescriptions,
          default_params: defaultParams,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }

      case "trigger_azure_devops_pipeline": {
        const {
          model_type,
          branch = "dev",
          platform = "databricks",
          environment = "dev",
        } = args as any;

        const pat = process.env.AZURE_DEVOPS_PAT;
        const organizationUrl = process.env.ORGANIZATION_URL;
        const projectName = process.env.PROJECT_NAME;

        if (!pat || !organizationUrl || !projectName) {
          return {
            content: [
              {
                type: "text",
                text: "Azure DevOps environment variables (AZURE_DEVOPS_PAT, ORGANIZATION_URL, PROJECT_NAME) must be set.",
              },
            ],
          };
        }

        const modelParams = PIPELINE_CONFIG[model_type];
        if (!modelParams) {
          return {
            content: [
              {
                type: "text",
                text: `Provided model is not supported. Supported Models: ${Object.keys(
                  PIPELINE_CONFIG
                ).join(", ")}.`,
              },
            ],
          };
        }

        const pipelineId = modelParams.pipeline_id;
        const parameters = { ...modelParams.parameters, platform, environment };

        try {
          // Azure DevOps REST API call
          const auth = Buffer.from(`:${pat}`).toString("base64");
          const response = await axios.post(
            `${organizationUrl}/${projectName}/_apis/pipelines/${pipelineId}/runs?api-version=6.0-preview.1`,
            {
              resources: {
                repositories: {
                  self: { refName: `refs/heads/${branch}` },
                },
              },
              templateParameters: parameters,
            },
            {
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
              },
            }
          );

          const finalResponse = {
            state: response.data.state,
            run_id: response.data.id,
            url: response.data.url,
            created_date: response.data.createdDate,
            message: `Successfully triggered Azure DevOps pipeline for model ${model_type}.`,
          };

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(finalResponse, null, 2),
              },
            ],
          };
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to trigger Azure DevOps pipeline: ${error.message}`,
              },
            ],
          };
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error.message}`
    );
  }
});

async function main() {
  const app = express();
  const port = process.env.PORT || 4000;

  // Enable CORS
  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "mcp-session-id"],
      exposedHeaders: ["mcp-session-id"],
    })
  );

  app.use(express.json());

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // MCP endpoint for unified protocol handling
  app.route("/mcp").post(async (req, res) => {
    console.log("POST request to /mcp");
    console.log("Headers:", req.headers);
    console.log("Body:", req.body);

    // Initialization request: create session
    if (req.body?.method === "initialize") {
      const sessionId = `session-${Math.random()
        .toString(36)
        .substring(2, 15)}`;
      console.log("MCP session initialization via POST");
      console.log(`Created new session ID: ${sessionId}`);
      res.setHeader("mcp-session-id", sessionId);
      res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
      res.setHeader("Content-Type", "application/json");
      const response = {
        jsonrpc: "2.0",
        id: req.body.id,
        result: {
          protocolVersion: "2023-07-01",
          serverInfo: {
            name: "databricks-mcp-server",
            version: "1.0.0",
          },
          serverCapabilities: {
            tools: {},
          },
        },
      };
      console.log(
        "Sending initialization response:",
        JSON.stringify(response, null, 2)
      );
      res.json(response);
      return;
    }

    // Require session ID for all other requests
    const sessionId = Array.isArray(req.headers["mcp-session-id"])
      ? req.headers["mcp-session-id"][0]
      : req.headers["mcp-session-id"];
    if (!sessionId) {
      res.status(400).json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: {
          code: -32000,
          message:
            "Missing mcp-session-id header. Please initialize session first.",
        },
      });
      return;
    }
    res.setHeader("mcp-session-id", sessionId);
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
    res.setHeader("Content-Type", "application/json");

    // Log request method
    console.log(`Handling method: ${req.body.method}`);

    // Handle shutdown
    if (req.body?.method === "shutdown") {
      console.log("MCP session shutdown via POST");
      console.log(`Closing session: ${sessionId}`);
      res.json({
        jsonrpc: "2.0",
        id: req.body.id,
        result: {},
      });
      return;
    }

    try {
      if (typeof sessionId !== "string") {
        throw new Error("Invalid session ID.");
      }

      // Route tool and other requests to SDK server
      if (req.body.method === "tools/call") {
        const result = await server.request(req.body, CallToolRequestSchema);
        res.json(result);
      }
      // Handle tool listing
      else if (req.body.method === "tools/list") {
        const result = await server.request(req.body, ListToolsRequestSchema);
        res.json(result);
      } else {
        // Default response for unknown methods
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown method: ${req.body.method}`
        );
      }
    } catch (error) {
      console.error("Error handling request:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        id: req.body.id,
        error: {
          code: error instanceof McpError ? error.code : -32001,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });

  // Keep the old SSE endpoint for backward compatibility
  app
    .route("/sse")
    .get(async (req, res) => {
      console.log("Legacy SSE connection established via GET");
      console.log("Headers:", req.headers);
      console.log("Query params:", req.query);

      try {
        const transport = new SSEServerTransport("/sse", res);
        console.log("Created SSE transport, connecting to server...");
        await server.connect(transport);
        console.log("Server connected to transport");
      } catch (error) {
        console.error("Error connecting to SSE transport:", error);
        if (!res.headersSent) {
          res.status(500).send("Error connecting to SSE transport");
        }
      }
    })
    .post(async (req, res) => {
      console.log("Legacy SSE connection established via POST");
      console.log("Headers:", req.headers);
      console.log("Body:", req.body);

      try {
        const transport = new SSEServerTransport("/sse", res);
        console.log("Created SSE transport, connecting to server...");
        await server.connect(transport);
        console.log("Server connected to transport");
      } catch (error) {
        console.error("Error connecting to SSE transport:", error);
        if (!res.headersSent) {
          res.status(500).send("Error connecting to SSE transport");
        }
      }
    });

  app.listen(port, () => {
    console.log(
      `Databricks MCP server running on HTTP with SSE at http://localhost:${port}`
    );
    console.log(
      `Connect to: http://localhost:${port}/mcp (recommended) or http://localhost:${port}/sse (legacy)`
    );
  });
}

main().catch(console.error);
