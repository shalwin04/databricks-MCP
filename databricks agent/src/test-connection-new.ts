#!/usr/bin/env node
import { DatabricksMCPClient } from './mcp-client-new.js';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('🔄 Testing MCP server connection...');
  
  // Get server URL from environment or use default
  // Make sure it's the right endpoint for our server
  let serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:4000/mcp';
  
  // Adjust URL if needed - the MCP server might have different endpoints
  if (!serverUrl.endsWith('/mcp') && !serverUrl.endsWith('/')) {
    // Check if it's the legacy endpoint
    if (serverUrl.endsWith('/sse')) {
      console.log('Using legacy /sse endpoint');
      // Remove /sse to get the base URL
      serverUrl = serverUrl.slice(0, -4);
    } else {
      // Add /mcp if there's no endpoint specified
      serverUrl = `${serverUrl}/mcp`;
      console.log(`Adjusted URL to: ${serverUrl}`);
    }
  }
  
  const token = process.env.DATABRICKS_TOKEN || '';
  
  console.log(`Using MCP server URL: ${serverUrl}`);
  console.log(`Auth token present: ${token ? 'Yes' : 'No'}`);
  
  // Initialize MCP client
  const client = new DatabricksMCPClient(serverUrl, token);
  
  try {
    // Connect to MCP server
    console.log('Attempting to connect...');
    await client.connect();
    console.log('✅ Connection successful!');
    
    // Check if connection was successful
    const isConnected = await client.isConnected();
    console.log('Connection status:', isConnected ? '✅ Connected' : '❌ Not connected');
    console.log('Using mock mode:', client.isMockMode ? '⚠️ YES (Mock data)' : '✅ NO (Real data)');
    
    if (isConnected) {
      console.log('\n=== Testing MCP Tools ===\n');
      
      // Test various tools
      const tests = [
        // Basic tools
        { name: 'List Clusters', fn: async () => await client.listClusters() },
        { name: 'Train Experiment Info', fn: async () => await client.getTrainExperimentInfo('shingrix-po') },
        { name: 'Run Notebook', fn: async () => await client.runNotebook({
          notebook_path: '/Workspace/Shared/Test/TestNotebook',
          base_params: { param1: 'test' }
        })},
        { name: 'Train Model', fn: async () => await client.trainAndRegisterModel({
          model_type: 'shingrix-po',
          job_name: 'test-job'
        })},
        { name: 'Job Status', fn: async () => await client.getJobStatus('123456', '789012') }
      ];
      
      // Run each test
      for (const test of tests) {
        try {
          console.log(`\n📝 Testing ${test.name}...`);
          const result = await test.fn();
          console.log(`✅ ${test.name} successful:`, result.content[0].text.slice(0, 150) + (result.content[0].text.length > 150 ? '...' : ''));
        } catch (error) {
          console.error(`❌ ${test.name} failed:`, error);
        }
      }
      
      // Test running a query (keeping this for backward compatibility)
      try {
        console.log('\n📝 Testing SQL Query...');
        const queryResult = await client.executeQuery({
          query: 'SELECT 1 as test',
        });
        console.log('✅ Query successful:', JSON.stringify(queryResult, null, 2));
      } catch (error) {
        console.error('❌ Query failed:', error);
      }
    } else {
      console.log('Connection was not fully established, but session was created.');
      console.log('This may be sufficient for many use cases.');
    }
  } catch (error) {
    console.error('❌ Connection failed:', error);
  } finally {
    console.log('\n👋 Disconnecting...');
    await client.disconnect();
    console.log('✅ Disconnected from MCP server');
  }
}

testConnection().catch(err => {
  console.error('Fatal error in test connection:', err);
  process.exit(1);
});
