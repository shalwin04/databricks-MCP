# Databricks MCP Client

A TypeScript client for interacting with Databricks Model Context Protocol (MCP) servers.

## Features

- Full TypeScript support with strict type checking
- Environment variable configuration
- Robust error handling and timeout management
- Health check endpoints
- Automatic tool discovery
- Clean connection management

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file with the following variables:

```env
MCP_SERVER_URL=http://localhost:4000/mcp
DATABRICKS_TOKEN=your_token_here
```

## Usage

```typescript
import { DatabricksMCPClient } from './src/client.js';

async function main() {
  const client = new DatabricksMCPClient();

  try {
    // Connect to the MCP server
    await client.connect();
    
    // Get available tools
    const tools = client.getAvailableTools();
    console.log('Available tools:', tools);

    // Call a tool
    const result = await client.callTool('toolName', { 
      param1: 'value1',
      param2: 'value2'
    });
    console.log('Result:', result);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
  }
}

main().catch(console.error);
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

## License

MIT