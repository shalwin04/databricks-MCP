# Databricks MCP Server

A Model Context Protocol (MCP) server for Databricks integration, enabling seamless interaction with Databricks clusters and SQL warehouses.

## Features

- Execute SQL queries on Databricks
- List available clusters
- Secure token-based authentication
- TypeScript support

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Databricks workspace access
- Databricks personal access token

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Databricks configuration:
   ```
   DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
   DATABRICKS_TOKEN=your-databricks-token
   ```

## Development

Build the project:
```bash
npm run build
```

Run in development mode (with file watching):
```bash
npm run dev
```

Start the server:
```bash
npm start
```

## Usage

This MCP server provides the following tools:

### `databricks_query`
Execute SQL queries on your Databricks workspace.

**Parameters:**
- `query` (required): SQL query to execute
- `warehouse_id` (optional): Databricks SQL warehouse ID

### `list_clusters`
List available Databricks clusters.

## Project Structure

```
databricks-mcp-server/
├── src/
│   └── index.ts          # Main server implementation
├── dist/                 # Compiled JavaScript output
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules
├── tsconfig.json        # TypeScript configuration
├── package.json         # npm configuration
└── README.md           # This file
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC
