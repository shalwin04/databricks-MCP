import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { DatabricksAgent } from "./databricksAgent.js";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://localhost:4000/mcp";

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set in .env");
}

// Wrap DatabricksAgent as a LangChain tool
defineDatabricksTool()
function defineDatabricksTool() {
  const agent = new DatabricksAgent(MCP_SERVER_URL);
  return tool({
    name: "databricks",
    description: "Interact with Databricks MCP tools (train, run notebook, job status, etc)",
    async call(input: { request: string; params?: Record<string, any> }) {
      await agent.connect();
      const result = await agent.handleRequest(input.request, input.params || {});
      await agent.disconnect();
      return JSON.stringify(result);
    },
    inputSchema: {
      type: "object",
      properties: {
        request: { type: "string", description: "Databricks operation (e.g. train, runNotebook, jobStatus)" },
        params: { type: "object", description: "Parameters for the operation" },
      },
      required: ["request"],
    },
  });
}

const databricksTool = defineDatabricksTool();

// Create the LLM agent
const llm = new ChatOpenAI({
  openAIApiKey: OPENAI_API_KEY,
  model: "gpt-4o",
  temperature: 0.2,
});

const agent = createReactAgent({
  llm,
  tools: [databricksTool],
});

// Example usage
async function main() {
  const userMessage = "Train a shingrix-po model";
  const result = await agent.invoke({
    messages: [
      { role: "user", content: userMessage },
    ],
  });
  console.log("LLM Agent result:", result);
}

if (require.main === module) {
  main().catch(console.error);
}

declare module "@langchain/core/tools" {
  export function tool(options: any): any;
}
