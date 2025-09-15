# Databricks MCP Client

This is an implementation of a Model Context Protocol (MCP) client for Databricks. It allows communication with the Databricks MCP server to execute various operations like running notebooks, training models, and querying data.

## Features

- Robust session initialization and management
- SSE transport for real-time communication
- Proper error handling and reconnection logic
- Support for all Databricks tools exposed by the MCP server

## Usage

### Basic Usage

```typescript
import { DatabricksMCPClient } from './mcp-client-new.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Initialize client
  const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:4000/mcp';
  const token = process.env.DATABRICKS_TOKEN || '';
  const client = new DatabricksMCPClient(serverUrl, token);
  
  try {
    // Connect to server
    await client.connect();
    console.log('Connected to MCP server');
    
    // List available tools
    const tools = client.getAvailableTools();
    console.log(`Available tools: ${tools.map(t => t.name).join(', ')}`);
    
    // Run a notebook
    const result = await client.runNotebook({
      notebook_path: '/path/to/notebook',
      base_params: { param1: 'value1' }
    });
    console.log('Result:', result.content[0]?.text);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Always disconnect
    await client.disconnect();
  }
}

main().catch(console.error);
```

### Environment Variables

Create a `.env` file with the following variables:

```
MCP_SERVER_URL=http://localhost:4000/mcp
DATABRICKS_TOKEN=your_token_here
```

### Testing the Connection

To test the connection to the MCP server:

```bash
npm run test:improved
```

This will:
1. Connect to the MCP server
2. List available tools
3. Test various tool calls
4. Disconnect

## Implementation Details

The client:

1. Initializes a session via POST request
2. Establishes an SSE connection for bidirectional communication
3. Lists available tools
4. Provides methods for calling specific Databricks tools
5. Handles errors and reconnection

## Available Tools

This client supports all tools provided by the Databricks MCP server, including:

- `run_databricks_notebook`: Run a Databricks notebook
- `train_and_register_model`: Train and register an ML model
- `list_clusters`: List all available Databricks clusters
- `get_model_metadata`: Get model metadata
- `get_train_experiment_info`: Get information about training parameters
- And more...

## Error Handling

The client includes comprehensive error handling with:
- Connection timeout management
- Reconnection logic
- Graceful error messages for tool calls

## License

ISC
