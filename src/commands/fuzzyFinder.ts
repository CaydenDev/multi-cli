import { Command } from 'commander';
import fuzzysort from 'fuzzysort';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import inquirer from 'inquirer';
import { exec } from 'child_process';
import { promisify } from 'util';
import opener from 'opener';

const execAsync = promisify(exec);

async function getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    async function scan(directory: string) {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            
            if (entry.isDirectory()) {
                try {
                    await scan(fullPath);
                } catch (error) {
                    continue;
                }
            } else {
                files.push(fullPath);
            }
        }
    }
    
    await scan(dir);
    return files;
}

export function fuzzyFinder(program: Command) {
    program
        .command('find')
        .description('Fuzzy find files and directories')
        .option('-p, --path <path>', 'Base path to search from', process.cwd())
        .option('-o, --open', 'Open the selected file')
        .option('-l, --limit <number>', 'Limit number of results', '10')
        .argument('[query]', 'Search query')
        .action(async (query: string | undefined, options) => {
            try {
                const basePath = path.resolve(options.path);
                console.log(chalk.blue(`Scanning ${basePath}...`));
                
                const files = await getAllFiles(basePath);
                const limit = parseInt(options.limit) || 10;

                if (!query) {
                    const { search } = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'search',
                            message: 'Enter search query:'
                        }
                    ]);
                    query = search;
                }                if (!query) {
                    console.log(chalk.yellow('No search query provided'));
                    return;
                }

                const results = fuzzysort.go(query, files, {
                    limit,
                    threshold: -10000,
                    key: (filePath: string) => path.relative(basePath, filePath)
                });

                if (results.length === 0) {
                    console.log(chalk.yellow('No matches found'));
                    return;
                }

                results.forEach((result, index) => {
                    const relativePath = path.relative(basePath, result.target);
                    console.log(chalk`{green [${index}]} ${relativePath}`);
                });

                if (options.open) {
                    const { selection } = await inquirer.prompt([
                        {
                            type: 'number',
                            name: 'selection',
                            message: 'Enter number to open (or Enter to cancel):',
                            validate: (input: number) => {
                                if (input === undefined) return true;
                                return input >= 0 && input < results.length ? true : 'Invalid selection';
                            }
                        }
                    ]);

                    if (selection !== undefined) {
                        const filePath = results[selection].target;
                        console.log(chalk.blue(`Opening ${filePath}...`));
                        await opener(filePath);
                    }
                }
            } catch (error: any) {
                console.error(chalk.red('Error:'), error.message);
            }
        });
}
