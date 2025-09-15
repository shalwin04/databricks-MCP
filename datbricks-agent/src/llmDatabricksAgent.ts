import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
// Types not available in @langchain/core/tools, use type assertion below
import { DatabricksAgent } from "./databricksAgent.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import dotenv from "dotenv";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MCP_SERVER_URL =
  process.env.MCP_SERVER_URL || "http://localhost:4000/mcp";

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set in .env");
}

// Wrap DatabricksAgent as a LangChain tool
function defineDatabricksTool() {
  const dbAgent = new DatabricksAgent(MCP_SERVER_URL);
  const inputSchema = z.object({
    request: z
      .string()
      .describe("Databricks operation (e.g. train, runNotebook, jobStatus)"),
    params: z
      .record(z.any())
      .optional()
      .describe("Parameters for the operation"),
  });
  const jsonSchema = zodToJsonSchema(inputSchema);
  return tool(
    async (input: unknown) => {
      const parsed = inputSchema.parse(input);
      await dbAgent.connect();
      const result = await dbAgent.handleRequest(
        parsed.request,
        parsed.params || {}
      );
      await dbAgent.disconnect();
      return JSON.stringify(result);
    },
    {
      name: "databricks",
      description:
        "Interact with Databricks MCP tools (train, run notebook, job status, etc)",
      schema: jsonSchema,
    }
  );
}

const databricksTool = defineDatabricksTool();

// Create the LLM agent
const llm = new ChatOpenAI({
  openAIApiKey: OPENAI_API_KEY,
  model: "gpt-4o",
  temperature: 0.2,
});

const reactAgent = createReactAgent({
  llm,
  tools: [databricksTool as any],
});

// Dynamic terminal chat CLI
import readline from "readline";

async function chatCLI(): Promise<void> {
  console.log("🤖 LLM Databricks Agent Chat CLI");
  console.log("Type your message. Type 'exit' or 'quit' to leave.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  type Message = { role: string; content: string };
  const messages: Message[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const userInput: string = await new Promise((resolve) =>
      rl.question("> ", resolve)
    );
    const trimmed = userInput.trim();
    if (trimmed === "exit" || trimmed === "quit") break;
    if (!trimmed) continue;

    messages.push({ role: "user", content: trimmed });
    try {
      const result = await reactAgent.invoke({ messages });
      // Print only the latest assistant message
      // Find the latest assistant message (BaseMessage type)
      const assistantMsg = Array.isArray(result?.messages)
        ? result.messages.find(
            (m) =>
              typeof m === "object" &&
              m !== null &&
              "role" in m &&
              m.role === "assistant"
          )
        : undefined;
      if (assistantMsg) {
        // Handle MessageContent type (string or array)
        let contentStr = "";
        if (typeof assistantMsg.content === "string") {
          contentStr = assistantMsg.content;
        } else if (Array.isArray(assistantMsg.content)) {
          // MessageContentComplex[]: handle text, image, etc
          contentStr = assistantMsg.content
            .map((c: { type?: string; text?: string }) =>
              c.type === "text" ? c.text || "" : "[non-text message]"
            )
            .join("\n");
        } else {
          contentStr = String(assistantMsg.content);
        }
        console.log(contentStr);
        messages.push({ role: "assistant", content: contentStr });
      } else {
        console.log(result);
      }
    } catch (err) {
      console.error("Error:", err);
    }
  }
  rl.close();
  console.log("👋 Goodbye!");
}

export { chatCLI };

// ES module compatible entry point
if (
  typeof import.meta !== "undefined" &&
  import.meta.url === `file://${process.argv[1]}`
) {
  chatCLI().catch(console.error);
}

declare module "@langchain/core/tools" {
  export function tool(options: Record<string, unknown>): unknown;
}
