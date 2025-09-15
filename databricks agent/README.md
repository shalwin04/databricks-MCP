# Databricks Agent

An AI-powered agent for Databricks operations using LangChain, LangGraph, and Model Context Protocol (MCP).

## Features

- 🤖 **Conversational AI**: Natural language interface for Databricks operations
- 🔧 **Comprehensive Tools**: Support for training, deployment, monitoring, and more
- 🔄 **Real-time Communication**: Uses MCP over HTTP/SSE for real-time operations
- 📊 **Model Lifecycle Management**: Train, register, and deploy models
- 🚀 **Azure DevOps Integration**: Automated pipeline triggers for deployment
- 📈 **Experiment Tracking**: MLflow experiment and run management

## Architecture

```
┌─────────────────┐    HTTP/SSE    ┌──────────────────┐
│ Databricks      │◄──────────────►│ Databricks       │
│ Agent           │                │ MCP Server       │
│ (LangGraph)     │                │                  │
└─────────────────┘                └──────────────────┘
        │                                   │
        │                                   │
        ▼                                   ▼
┌─────────────────┐                ┌──────────────────┐
│ OpenAI GPT-4    │                │ Databricks       │
│                 │                │ Workspace        │
└─────────────────┘                └──────────────────┘
```

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- OpenAI API key
- Databricks workspace access
- Running Databricks MCP Server

## Installation

1. Navigate to the agent directory:
   ```bash
   cd "databricks agent"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your configuration:
   ```
   OPENAI_API_KEY=your-openai-api-key
   MCP_SERVER_URL=http://localhost:4000/mcp
   DATABRICKS_TOKEN=your-databricks-pat-token
   ```

## Usage

### Start the MCP Server

First, make sure your Databricks MCP server is running:

```bash
cd ../databricks-mcp-server
npm run build
npm start
```

The server should be accessible at `http://localhost:4000/mcp` (the `/mcp` endpoint handles both session initialization and SSE streaming)

### Test MCP Connection

To verify that the MCP client can connect to the server:

```bash
npm run test:connection
```

This will attempt to:
1. Initialize an MCP session
2. Connect via SSE
3. List available tools
4. Disconnect properly

### Run the Agent

#### Interactive Mode (Recommended)

```bash
npm run dev:run
```

You can also use:

```bash
npm start
```

after building the project

This starts an interactive chat interface where you can ask questions like:
- "Train a shingrix-po model with custom parameters"
- "Show me the status of job 12345"
- "What experiments are currently running?"
- "Deploy the digital-twin model to production"

#### Build and Run

```bash
npm run build
npm start
```

#### Run Examples

```bash
npm run example
```

## Troubleshooting

### Connection Issues

If you encounter connection issues:

1. **MCP Connection Errors**: 
   - Verify your server URL format (should be `/mcp` endpoint, not `/sse`)
   - Check that your Databricks token is valid 
   - Run `npm run test:connection` for detailed diagnostics

2. **Protocol Errors**:
   - The client now uses protocol version `2023-07-01`
   - Proper session initialization is done via POST before SSE connection
   - Headers are explicitly set with content types and session ID

3. **Build Issues**:
   - Run `npm run build` to check for TypeScript errors
   - Ensure all dependencies are installed with `npm install`

### Common Commands

```bash
# Test MCP connection
npm run test:connection

# Run in development mode
npm run dev:run

# Build TypeScript files
npm run build

# Run the built agent
npm start
```

## Available Operations

The agent can help you with:

### 🏗️ Model Training & Registration
- Train and register models on Databricks
- Get training parameters for different model types
- Monitor training progress

### 📊 Experiment Management
- Fetch latest experiment runs
- Get model metadata
- Search experiments and runs

### 🔍 Job Management
- Run Databricks notebooks
- Check job status and details
- Monitor running jobs

### 📈 Model Registry
- Get registered model information
- Manage model versions in Unity Catalog

### 🚀 Deployment
- Trigger Azure DevOps pipelines
- Deploy models to different environments

### 🛠️ Utilities
- Convert timestamps
- Get cluster information

## Example Conversations

**User**: "Train a new shingrix-po model"
**Agent**: *Triggers training job and provides job details*

**User**: "What's the status of job 12345?"
**Agent**: *Fetches and reports current job status*

**User**: "Deploy the digital-twin model to production"
**Agent**: *Triggers Azure DevOps pipeline for deployment*

## Configuration

### Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key
- `MCP_SERVER_URL`: URL of the Databricks MCP server (default: http://localhost:3000/sse)

### Model Types Supported

- `shingrix-po`: Shingrix Persisters/Optimizers model
- `shingrix-ppo`: Shingrix PPO model  
- `digital-twin`: Digital Twin model

## Development

### Project Structure

```
databricks agent/
├── src/
│   ├── index.ts              # Main CLI entry point
│   ├── databricks-agent.ts   # LangGraph agent implementation
│   ├── mcp-client.ts         # MCP client for server communication
│   └── example.ts            # Usage examples
├── dist/                     # Compiled output
├── .env.example              # Environment template
├── tsconfig.json             # TypeScript configuration
└── package.json              # npm configuration
```

### Development Scripts

- `npm run build`: Compile TypeScript
- `npm run dev`: Watch mode compilation
- `npm run dev:run`: Run without compilation
- `npm run example`: Run example usage
- `npm run clean`: Clean build directory

## Troubleshooting

### Common Issues

1. **MCP Server Connection Failed**
   - Ensure the MCP server is running on the specified URL
   - Check that the server supports HTTP/SSE transport

2. **OpenAI API Errors**
   - Verify your OpenAI API key is correct
   - Check you have sufficient API credits

3. **Databricks Authentication**
   - Ensure Databricks credentials are properly set in the MCP server
   - Verify workspace access permissions

### Debug Mode

Set `LOG_LEVEL=debug` in your `.env` file for detailed logging.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC
