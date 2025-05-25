import { Command } from 'commander';
import axios from 'axios';
import chalk from 'chalk';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatHistory {
  messages: Message[];
  timestamp: string;
  model: string;
}

interface Config {
  apiKey?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.multi-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const loadConfig = (): Config => {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (error: any) {
    console.error(chalk.red(`Failed to load config: ${error?.message || 'Unknown error'}`));
  }
  return {};
};

const saveConfig = (config: Config) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error: any) {
    console.error(chalk.red(`Failed to save config: ${error?.message || 'Unknown error'}`));
  }
};

export const chatbot = (program: Command) => {
  program
    .command('chatbot')
    .description('Chat with AI models via OpenRouter API')
    .option('-m, --model <model>', 'AI model to use', 'meta-llama/llama-4-maverick:free')
    .option('-k, --key <key>', 'OpenRouter API key')
    .option('-s, --system <message>', 'System message to set context')
    .option('-i, --interactive', 'Start in interactive mode with command menu')
    .option('-l, --load <file>', 'Load conversation from a file')
    .option('--save-key', 'Save the provided API key for future use')
    .action(async (options) => {
      const config = loadConfig();
      const apiKey = options.key || config.apiKey;

      if (!apiKey) {
        console.error(chalk.red('Error: OpenRouter API key is required'));
        console.log(chalk.yellow('Get your API key from https://openrouter.ai/keys'));
        console.log(chalk.yellow('You can save your API key using the --save-key flag'));
        process.exit(1);
      }

      if (options.saveKey && options.key) {
        saveConfig({ ...config, apiKey: options.key });
        console.log(chalk.green('API key saved successfully'));
      }

      const historyDir = path.join(process.cwd(), 'chat_history');
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
      }

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      let messages: Message[] = [];

      if (options.system) {
        messages.push({ role: 'system', content: options.system });
      }

      if (options.load) {
        try {
          const historyPath = path.join(historyDir, options.load);
          const history: ChatHistory = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
          messages = history.messages;
          console.log(chalk.green(`Loaded conversation from ${options.load}`));
        } catch (error: any) {
          console.error(chalk.red(`Failed to load conversation: ${error?.message || 'Unknown error'}`));
          process.exit(1);
        }
      }

      const saveHistory = () => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `chat_${timestamp}.json`;
        const historyPath = path.join(historyDir, filename);
        const history: ChatHistory = {
          messages,
          timestamp: new Date().toISOString(),
          model: options.model
        };
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        return filename;
      };

      const showMenu = async () => {
        console.log(chalk.cyan('\nCommands:'));
        console.log(chalk.yellow('/save    - Save conversation'));
        console.log(chalk.yellow('/clear   - Clear conversation'));
        console.log(chalk.yellow('/system  - Add system message'));
        console.log(chalk.yellow('/exit    - End conversation'));
        console.log(chalk.yellow('/help    - Show this menu\n'));
      };

      if (options.interactive) {
        await showMenu();
      }

      console.log(chalk.cyan('Chat started. Type your message or use commands (start with /)'));

      const chat = async () => {
        const userInput = await new Promise<string>((resolve) => {
          rl.question(chalk.green('You: '), resolve);
        });

        if (userInput.startsWith('/')) {
          const command = userInput.slice(1).toLowerCase();
          switch (command) {
            case 'save':
              const filename = saveHistory();
              console.log(chalk.green(`Conversation saved to ${filename}`));
              break;
            case 'clear':
              messages = [];
              console.log(chalk.green('Conversation cleared'));
              break;
            case 'system':
              const systemMessage = await new Promise<string>((resolve) => {
                rl.question(chalk.yellow('Enter system message: '), resolve);
              });
              messages.push({ role: 'system', content: systemMessage });
              console.log(chalk.green('System message added'));
              break;
            case 'help':
              await showMenu();
              break;
            case 'exit':
              const filename2 = saveHistory();
              console.log(chalk.green(`Conversation saved to ${filename2}`));
              rl.close();
              return;
            default:
              console.log(chalk.red('Unknown command. Type /help for available commands'));
          }
          chat();
          return;
        }

        messages.push({ role: 'user', content: userInput });

        try {
          const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: options.model,
            messages
          }, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://github.com/CaydenDev/multi-cli',
              'X-Title': 'Multi CLI'
            }
          });

          const assistantMessage = response.data.choices[0].message.content;
          messages.push({ role: 'assistant', content: assistantMessage });
          console.log(chalk.blue('Assistant:'), assistantMessage);
        } catch (error) {
          if (axios.isAxiosError(error)) {
            console.error(chalk.red('API Error:'), error.response?.data?.error || error.message);
          } else {
            console.error(chalk.red('Error:'), error);
          }
        }

        chat();
      };

      chat();
    });
};