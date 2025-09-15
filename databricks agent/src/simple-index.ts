#!/usr/bin/env node

import { SimpleDatabricksAgent } from './simple-agent.js';
import * as readline from 'readline';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('🚀 Starting Simple Databricks Agent...\n');
  
  const agent = new SimpleDatabricksAgent();
  
  try {
    await agent.initialize();
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n✅ Databricks Agent is ready!');
    console.log('💡 Available commands:');
    console.log('   - train [model-type] - Train a model');
    console.log('   - status [jobId] [runId] - Check job status');
    console.log('   - jobs - List running jobs');
    console.log('   - info [model-type] - Get model info');
    console.log('   - notebook [path] - Run a notebook');
    console.log('   - chat [message] - Chat with the agent');
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
          
          const parts = input.trim().split(' ');
          const command = parts[0].toLowerCase();
          
          let result = '';
          
          switch (command) {
            case 'train':
              const modelType = parts[1] || 'shingrix-po';
              result = await agent.trainModel(modelType);
              break;
            case 'status':
              if (parts.length < 3) {
                result = 'Please provide jobId and runId: status <jobId> <runId>';
              } else {
                result = await agent.getJobStatus(parts[1], parts[2]);
              }
              break;
            case 'jobs':
              result = await agent.getRunningJobs();
              break;
            case 'info':
              const infoModelType = parts[1] || 'shingrix-po';
              result = await agent.getModelInfo(infoModelType);
              break;
            case 'notebook':
              if (parts.length < 2) {
                result = 'Please provide notebook path: notebook <path>';
              } else {
                const notebookPath = parts.slice(1).join(' ');
                result = await agent.runNotebook(notebookPath);
              }
              break;
            case 'chat':
              const message = parts.slice(1).join(' ');
              result = await agent.chat(message);
              break;
            default:
              result = `Unknown command: ${command}. Available: train, status, jobs, info, notebook, chat`;
          }
          
          console.log(`🤖 Agent: ${result}`);
          
        } catch (error) {
          console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
        }
        
        console.log('\n' + '─'.repeat(50) + '\n');
        askQuestion();
      });
    };

    askQuestion();

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

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch(console.error);
