import { DatabricksAgent } from './databricks-agent.js';

async function runExample() {
  console.log('🔬 Running Databricks Agent Example...\n');
  
  const agent = new DatabricksAgent();
  
  try {
    // Initialize the agent
    await agent.initialize();
    
    console.log('📋 Example 1: Getting training info for a model type');
    const trainingInfo = await agent.invoke('What are the training parameters for the shingrix-po model?');
    console.log('Response:', trainingInfo);
    console.log('\n' + '─'.repeat(80) + '\n');
    
    console.log('📋 Example 2: Asking about running job status');
    const jobStatus = await agent.invoke('Show me all currently running Databricks jobs');
    console.log('Response:', jobStatus);
    console.log('\n' + '─'.repeat(80) + '\n');
    
    console.log('📋 Example 3: General question about model training');
    const generalQuestion = await agent.invoke('How do I train a digital-twin model with custom parameters?');
    console.log('Response:', generalQuestion);
    console.log('\n' + '─'.repeat(80) + '\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await agent.cleanup();
    console.log('✅ Example completed!');
  }
}

runExample().catch(console.error);
