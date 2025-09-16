#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { z } from "zod";

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

// Create MCP Server and register all tools
function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "databricks-mcp-server",
    version: "1.0.0",
  });

  // Register all tools using the new registerTool method

  // 1. Run Databricks Notebook
  server.registerTool(
    "run_databricks_notebook",
    {
      title: "Run Databricks Notebook",
      description: "Runs a Databricks notebook on a running cluster",
      inputSchema: {
        notebook_path: z.string().describe("Path to the notebook"),
        base_params: z
          .record(z.any())
          .optional()
          .describe("Parameters for the notebook"),
        job_name: z
          .string()
          .optional()
          .default("AgentJob")
          .describe("Name for the job"),
      },
    },
    async ({ notebook_path, base_params = {}, job_name = "AgentJob" }) => {
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
  );

  // 2. Train and Register Model
  server.registerTool(
    "train_and_register_model",
    {
      title: "Train and Register Model",
      description: "Train, log and register the model on Databricks",
      inputSchema: {
        job_name: z
          .string()
          .optional()
          .default("DDT-Train-and-Register-Model")
          .describe("Name of the job"),
        additional_params: z
          .record(z.any())
          .optional()
          .describe("Additional parameters for training"),
        model_type: z
          .enum(["shingrix-po", "shingrix-ppo", "digital-twin"])
          .optional()
          .default("shingrix-po")
          .describe("Type of model"),
      },
    },
    async ({
      job_name = "DDT-Train-and-Register-Model",
      additional_params = {},
      model_type = "shingrix-po",
    }) => {
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
          if (experimentResult.experiment_name !== baseParams.experiment_name) {
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
  );

  // 3. Get Latest Experiment Run
  server.registerTool(
    "get_latest_experiment_run",
    {
      title: "Get Latest Experiment Run",
      description: "Fetches the latest run from a Databricks ML experiment",
      inputSchema: {
        experiment_id: z.string().describe("ML experiment ID"),
      },
    },
    async ({ experiment_id }) => {
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
  );

  // 4. Get Model Metadata
  server.registerTool(
    "get_model_metadata",
    {
      title: "Get Model Metadata",
      description: "Fetches model metadata from a Databricks ML experiment",
      inputSchema: {
        experiment_id: z.string().describe("ML experiment ID"),
      },
    },
    async ({ experiment_id }) => {
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
  );

  // 5. Get Registered Model Info
  server.registerTool(
    "get_registered_model_info",
    {
      title: "Get Registered Model Info",
      description: "Fetches registered model info from Unity Catalog",
      inputSchema: {
        model_name: z.string().describe("Name of the model"),
        uc_catalog: z.string().describe("Unity Catalog catalog name"),
        uc_schema: z.string().describe("Unity Catalog schema name"),
      },
    },
    async ({ model_name, uc_catalog, uc_schema }) => {
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
  );

  // 6. Check Databricks Job Status
  server.registerTool(
    "check_databricks_job_status",
    {
      title: "Check Databricks Job Status",
      description: "Checks the status of a Databricks job",
      inputSchema: {
        job_id: z.string().describe("Job ID"),
        run_id: z.string().describe("Run ID"),
      },
    },
    async ({ job_id, run_id }) => {
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
  );

  // 7. Get Latest Running Job Runs
  server.registerTool(
    "get_latest_running_job_runs",
    {
      title: "Get Latest Running Job Runs",
      description: "Fetches all running Databricks job runs",
      inputSchema: {},
    },
    async () => {
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
  );

  // 8. Get Job Details
  server.registerTool(
    "get_job_details",
    {
      title: "Get Job Details",
      description: "Fetches details for a specific Databricks job",
      inputSchema: {
        job_id: z.string().describe("Job ID"),
      },
    },
    async ({ job_id }) => {
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
  );

  // 9. Convert Epoch to DateTime
  server.registerTool(
    "convert_epoch_to_datetime",
    {
      title: "Convert Epoch to DateTime",
      description: "Converts an epoch timestamp to readable date and time",
      inputSchema: {
        epoch_timestamp: z.string().describe("Epoch timestamp"),
      },
    },
    async ({ epoch_timestamp }) => {
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
  );

  // 10. Get Train Experiment Info
  server.registerTool(
    "get_train_experiment_info",
    {
      title: "Get Training Experiment Info",
      description:
        "Provides information about training parameters for a model type",
      inputSchema: {
        model_type: z
          .enum(["shingrix-po", "shingrix-ppo", "digital-twin"])
          .describe("Type of model"),
      },
    },
    async ({ model_type }) => {
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
  );

  // 11. Trigger Azure DevOps Pipeline
  server.registerTool(
    "trigger_azure_devops_pipeline",
    {
      title: "Trigger Azure DevOps Pipeline",
      description: "Triggers an Azure DevOps pipeline for model deployment",
      inputSchema: {
        model_type: z.string().describe("Type of model"),
        branch: z.string().optional().default("dev").describe("Git branch"),
        platform: z
          .string()
          .optional()
          .default("databricks")
          .describe("Deployment platform"),
        environment: z
          .string()
          .optional()
          .default("dev")
          .describe("Deployment environment"),
      },
    },
    async ({
      model_type,
      branch = "dev",
      platform = "databricks",
      environment = "dev",
    }) => {
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
  );

  return server;
}

async function main() {
  const app = express();
  const port = process.env.PORT || 4000;

  // Enable CORS with proper configuration for MCP
  app.use(
    cors({
      origin: "*", // Configure appropriately for production
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "mcp-session-id"],
      exposedHeaders: ["mcp-session-id"], // Expose session ID header
    })
  );

  app.use(express.json());

  // Map to store transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Handle POST requests for client-to-server communication
  app.post("/mcp", async (req, res) => {
    try {
      console.log("POST request to /mcp");
      console.log("Headers:", req.headers);
      console.log("Body method:", req.body?.method);

      // Check for existing session ID
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        console.log(`Reusing existing transport for session: ${sessionId}`);
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        console.log("Creating new transport for initialization");

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            console.log(`Session initialized: ${sessionId}`);
            // Store the transport by session ID
            transports[sessionId] = transport;
          },
          // Enable DNS rebinding protection for security
          enableDnsRebindingProtection: true,
          allowedHosts: ["127.0.0.1", "localhost", "localhost:4000"],
        });

        // Clean up transport when closed
        transport.onclose = () => {
          console.log(`Transport closed for session: ${transport.sessionId}`);
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };

        // Create and connect server
        const server = createMcpServer();
        await server.connect(transport);
        console.log("Server connected to new transport");
      } else {
        // Invalid request
        console.log("Invalid request - no session ID and not initialization");
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: req.body?.id || null,
        });
        return;
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling POST request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error",
          },
          id: req.body?.id || null,
        });
      }
    }
  });

  // Handle GET requests for server-to-client notifications via SSE
  app.get("/mcp", async (req, res) => {
    try {
      console.log("GET request to /mcp");
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (!sessionId || !transports[sessionId]) {
        console.log("Invalid GET request - missing or invalid session ID");
        res.status(400).send("Invalid or missing session ID");
        return;
      }

      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling GET request:", error);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  });

  // Handle DELETE requests for session termination
  app.delete("/mcp", async (req, res) => {
    try {
      console.log("DELETE request to /mcp");
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (!sessionId || !transports[sessionId]) {
        console.log("Invalid DELETE request - missing or invalid session ID");
        res.status(400).send("Invalid or missing session ID");
        return;
      }

      const transport = transports[sessionId];
      await transport.handleRequest(req, res);

      // Clean up the session
      if (transport.sessionId) {
        delete transports[transport.sessionId];
        console.log(
          `Session terminated and cleaned up: ${transport.sessionId}`
        );
      }
    } catch (error) {
      console.error("Error handling DELETE request:", error);
      if (!res.headersSent) {
        res.status(500).send("Internal server error");
      }
    }
  });

  // Handle OPTIONS requests for CORS preflight
  app.options("/mcp", (req, res) => {
    res.status(200).end();
  });

  app.listen(port, () => {
    console.log(
      `Databricks MCP server running with StreamableHTTP transport at http://localhost:${port}`
    );
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log("All tools registered successfully:");
    console.log("- run_databricks_notebook");
    console.log("- train_and_register_model");
    console.log("- get_latest_experiment_run");
    console.log("- get_model_metadata");
    console.log("- get_registered_model_info");
    console.log("- check_databricks_job_status");
    console.log("- get_latest_running_job_runs");
    console.log("- get_job_details");
    console.log("- convert_epoch_to_datetime");
    console.log("- get_train_experiment_info");
    console.log("- trigger_azure_devops_pipeline");
  });
}

main().catch(console.error);
