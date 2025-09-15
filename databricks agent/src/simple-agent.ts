import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import { SimpleMCPClient } from './simple-mcp-client.js';
import * as dotenv from 'dotenv';

dotenv.config();

export class SimpleDatabricksAgent {
  private model: ChatOpenAI;
  private mcpClient: SimpleMCPClient;

  constructor(openaiApiKey?: string, mcpServerUrl?: string) {
    this.model = new ChatOpenAI({
      apiKey: openaiApiKey || process.env.OPENAI_API_KEY,
      model: 'gpt-4',
      temperature: 0,
    });

    this.mcpClient = new SimpleMCPClient(mcpServerUrl);
  }

  async initialize(): Promise<void> {
    console.log('Initializing Databricks Agent...');
    await this.mcpClient.connect();
    console.log('Agent initialized successfully!');
  }

  async cleanup(): Promise<void> {
    await this.mcpClient.disconnect();
    console.log('Agent cleaned up successfully!');
  }

  async runNotebook(notebookPath: string, baseParams: Record<string, unknown> = {}, jobName: string = 'AgentJob'): Promise<string> {
    try {
      const result = await this.mcpClient.callTool('run_databricks_notebook', {
        notebook_path: notebookPath,
        base_params: baseParams,
        job_name: jobName,
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      throw new Error(`Failed to run notebook: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async trainModel(modelType: string = 'shingrix-po', additionalParams: Record<string, unknown> = {}, jobName: string = 'DDT-Train-and-Register-Model'): Promise<string> {
    try {
      const result = await this.mcpClient.callTool('train_and_register_model', {
        model_type: modelType,
        additional_params: additionalParams,
        job_name: jobName,
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      throw new Error(`Failed to train model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getJobStatus(jobId: string, runId: string): Promise<string> {
    try {
      const result = await this.mcpClient.callTool('check_databricks_job_status', {
        job_id: jobId,
        run_id: runId,
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      throw new Error(`Failed to get job status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getRunningJobs(): Promise<string> {
    try {
      const result = await this.mcpClient.callTool('get_latest_running_job_runs');
      return JSON.stringify(result, null, 2);
    } catch (error) {
      throw new Error(`Failed to get running jobs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getModelInfo(modelType: string): Promise<string> {
    try {
      const result = await this.mcpClient.callTool('get_train_experiment_info', {
        model_type: modelType,
      });
      return JSON.stringify(result, null, 2);
    } catch (error) {
      throw new Error(`Failed to get model info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async chat(message: string): Promise<string> {
    try {
      // For now, provide a simple response with available operations
      const response = await this.model.invoke([new HumanMessage(message)]);
      
      const availableOperations = `
Available Databricks Operations:
1. runNotebook(path, params, jobName) - Run a Databricks notebook
2. trainModel(modelType, params, jobName) - Train and register a model
3. getJobStatus(jobId, runId) - Check job status
4. getRunningJobs() - Get all running jobs
5. getModelInfo(modelType) - Get model training info

Model Types: shingrix-po, shingrix-ppo, digital-twin

Your message: ${message}
AI Response: ${response.content}
      `;
      
      return availableOperations;
    } catch (error) {
      return `Error processing message: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}
