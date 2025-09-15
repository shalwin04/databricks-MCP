#!/usr/bin/env node
import { DatabricksMCPClient } from './mcp-client-new.js';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  console.log('🔄 Testing MCP server connection with improved client...');
  
  // Get server URL from environment or use default
  let serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:4000/mcp';
  
  // Adjust URL if needed
  if (!serverUrl.endsWith('/mcp') && !serverUrl.endsWith('/')) {
    // Check if it's the legacy endpoint
    if (serverUrl.endsWith('/sse')) {
      console.log('Using legacy /sse endpoint');
      serverUrl = serverUrl.slice(0, -4) + '/mcp';
    } else {
      // Add /mcp if there's no endpoint specified
      serverUrl = `${serverUrl}/mcp`;
    }
    console.log(`Adjusted URL to: ${serverUrl}`);
  }
  
  const token = process.env.DATABRICKS_TOKEN || '';
  
  console.log(`Using MCP server URL: ${serverUrl}`);
  console.log(`Auth token present: ${token ? 'Yes' : 'No'}`);
  
  // Initialize MCP client
  const client = new DatabricksMCPClient(serverUrl, token);
  
  try {
    // Connect to MCP server
    console.log('Attempting to connect to MCP server...');
    await client.connect();
    console.log('✅ Connection successful!');
    
    // Check connection status
    const connected = await client.checkConnection();
    console.log('Connection status:', connected ? '✅ Connected' : '❌ Not connected');
    
    if (connected) {
      console.log('\n=== Available Tools ===');
      const tools = client.getAvailableTools();
      console.log(`Found ${tools.length} tools:`);
      tools.forEach(tool => {
        console.log(`- ${tool.name}: ${tool.description}`);
      });
      
      console.log('\n=== Testing Tools ===');
      
      // Test list clusters
      try {
        console.log('\n📋 Testing List Clusters...');
        const clusters = await client.listClusters();
        console.log('✅ List clusters response:', 
          clusters.content[0]?.text 
            ? clusters.content[0].text.slice(0, 150) + (clusters.content[0].text.length > 150 ? '...' : '') 
            : 'No text content');
      } catch (error) {
        console.error('❌ List clusters failed:', error);
      }
      
      // Test experiment info
      try {
        console.log('\n📋 Testing Get Train Experiment Info...');
        const info = await client.getTrainExperimentInfo('shingrix-po');
        console.log('✅ Experiment info response:', 
          info.content[0]?.text 
            ? info.content[0].text.slice(0, 150) + (info.content[0].text.length > 150 ? '...' : '') 
            : 'No text content');
      } catch (error) {
        console.error('❌ Get train experiment info failed:', error);
      }
      
      // Test notebook run
      try {
        console.log('\n📋 Testing Run Notebook...');
        const notebook = await client.runNotebook({
          notebook_path: '/Workspace/Shared/Test/TestNotebook',
          base_params: { param1: 'test' }
        });
        console.log('✅ Run notebook response:', 
          notebook.content[0]?.text 
            ? notebook.content[0].text.slice(0, 150) + (notebook.content[0].text.length > 150 ? '...' : '') 
            : 'No text content');
      } catch (error) {
        console.error('❌ Run notebook failed:', error);
      }
      
      // Test train model
      try {
        console.log('\n📋 Testing Train and Register Model...');
        const model = await client.trainAndRegisterModel({
          model_type: 'shingrix-po',
          job_name: 'test-job'
        });
        console.log('✅ Train and register model response:', 
          model.content[0]?.text 
            ? model.content[0].text.slice(0, 150) + (model.content[0].text.length > 150 ? '...' : '') 
            : 'No text content');
      } catch (error) {
        console.error('❌ Train and register model failed:', error);
      }
    } else {
      console.error('❌ Failed to establish full connection.');
    }
  } catch (error) {
    console.error('❌ Connection error:', error);
  } finally {
    // Always disconnect
    console.log('\n👋 Disconnecting...');
    try {
      await client.disconnect();
      console.log('✅ Disconnected successfully');
    } catch (error) {
      console.error('❌ Error during disconnect:', error);
    }
  }
}

// Run the test
testConnection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
