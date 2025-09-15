// Entry point for LLM Databricks Agent chat CLI
import { chatCLI } from "./llmDatabricksAgent.js";

// ES module compatible entry point
if (
  typeof import.meta !== "undefined" &&
  import.meta.url === `file://${process.argv[1]}`
) {
  chatCLI().catch(console.error);
}
