// Simple MCP connection test script
const { spawn } = require('child_process');
const path = require('path');

console.log('🔄 Starting the Databricks MCP server...');

// Path to the MCP server
const mcpServerPath = path.join(__dirname, '..', 'databricks-mcp-server');

// Start the MCP server
const server = spawn('npm', ['run', 'start'], {
  cwd: mcpServerPath,
  env: process.env,
  stdio: 'inherit'
});

// Give the server time to start
console.log('Waiting for server to start...');
setTimeout(() => {
  console.log('🔄 Testing MCP client connection...');
  
  // Start the test client
  const client = spawn('npm', ['run', 'test:connection'], {
    cwd: path.join(__dirname, 'databricks agent'),
    env: process.env,
    stdio: 'inherit'
  });
  
  // Handle client exit
  client.on('exit', (code) => {
    console.log(`Client process exited with code ${code}`);
    
    // Stop the server
    console.log('Shutting down server...');
    server.kill();
  });
  
}, 5000); // Wait 5 seconds for server to start

// Handle process exit
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down...');
  server.kill();
  process.exit(0);
});
