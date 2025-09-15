#!/usr/bin/env node

import { DatabricksAgent } from './databricks-agent.js';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 Starting Databricks Agent...\n');
  
  // Initialize the agent with a timeout
  const agent = new DatabricksAgent();
  
  try {
    // Connect to MCP server with timeout
    const initPromise = agent.initialize();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Initialization timeout')), 15000);
    });
    
    try {
      await Promise.race([initPromise, timeoutPromise]);
    } catch (initError) {
      console.error('Error or timeout during initialization:', initError);
      console.log('Continuing with limited functionality');
    }
    
    // Create readline interface for interactive chat
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n✅ Databricks Agent is ready!');
    console.log('💡 You can ask me about Databricks operations like:');
    console.log('   - Training and registering models');
    console.log('   - Running notebooks');
    console.log('   - Checking job status');
    console.log('   - Getting experiment information');
    console.log('   - Deploying models via Azure DevOps');
    console.log('\n📝 Type "quit" or "exit" to stop\n');

    const askQuestion = () => {
      rl.question('👤 You: ', async (input) => {
        if (input.toLowerCase() === 'quit' || input.toLowerCase() === 'exit') {
          console.log('\n👋 Goodbye!');
          await agent.cleanup();
          rl.close();
          process.exit(0);
        }

        if (input.trim() === '') {
          askQuestion();
          return;
        }

        try {
          console.log('\n🤖 Agent: Processing...\n');
          
          // Use streaming for real-time response
          const stream = await agent.stream(input);
          
          let finalResponse = '';
          for await (const chunk of stream) {
            if (chunk.agent && chunk.agent.messages) {
              const lastMessage = chunk.agent.messages[chunk.agent.messages.length - 1];
              if (lastMessage && lastMessage.content && lastMessage.content !== finalResponse) {
                finalResponse = lastMessage.content;
                console.log(`🤖 Agent: ${finalResponse}`);
              }
            }
          }
          
        } catch (error) {
          console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
        }
        
        console.log('\n' + '─'.repeat(50) + '\n');
        askQuestion();
      });
    };

    askQuestion();

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down...');
      await agent.cleanup();
      rl.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to initialize agent:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the main function
main().catch(console.error);
