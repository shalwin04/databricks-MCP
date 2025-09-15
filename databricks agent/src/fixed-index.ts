import { SimpleDatabricksAgent } from './fixed-agent.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 Starting Simple Databricks Agent...');
  
  const agent = new SimpleDatabricksAgent();
  
  try {
    await agent.initialize();
    console.log('Simple agent ready!');
  } catch (error) {
    console.error('Initialization error:', error);
  } finally {
    await agent.cleanup();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});