import { Command } from 'commander';
import inquirer from 'inquirer';
import axios from 'axios';

export function apiTest(program: Command) {
  program
    .command('api')
    .description('Test API endpoints interactively')
    .action(async () => {
      const { method } = await inquirer.prompt([
        {
          type: 'list',
          name: 'method',
          message: 'Select HTTP method:',
          choices: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
        }
      ]);

      const { url } = await inquirer.prompt([
        {
          type: 'input',
          name: 'url',
          message: 'Enter the API URL:',
          validate: (input: string) => {
            try {
              new URL(input);
              return true;
            } catch {
              return 'Please enter a valid URL';
            }
          }
        }
      ]);

      const { headers } = await inquirer.prompt([
        {
          type: 'input',
          name: 'headers',
          message: 'Enter headers (JSON format) or press enter to skip:',
          default: '{}',
          validate: (input: string) => {
            try {
              JSON.parse(input);
              return true;
            } catch {
              return 'Please enter valid JSON or empty string';
            }
          }
        }
      ]);

      let body = '';
      if (method !== 'GET' && method !== 'DELETE') {
        const { requestBody } = await inquirer.prompt([
          {
            type: 'input',
            name: 'requestBody',
            message: 'Enter request body (JSON format) or press enter to skip:',
            default: '{}',
            validate: (input: string) => {
              try {
                JSON.parse(input);
                return true;
              } catch {
                return 'Please enter valid JSON or empty string';
              }
            }
          }
        ]);
        body = requestBody;
      }

      try {
        console.log('\nSending request...\n');
        const response = await axios({
          method: method.toLowerCase(),
          url,
          headers: JSON.parse(headers),
          data: body ? JSON.parse(body) : undefined
        });

        console.log('Status:', response.status);
        console.log('Headers:', JSON.stringify(response.headers, null, 2));
        console.log('Body:', JSON.stringify(response.data, null, 2));
      } catch (error: any) {
        console.error('Error:', error.message);
        if (error.response) {
          console.error('Status:', error.response.status);
          console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
      }
    });

}
