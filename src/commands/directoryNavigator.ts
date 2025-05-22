import { Command } from 'commander';
import { LocalStorage } from 'node-localstorage';
import chalk from 'chalk';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import inquirer from 'inquirer';

const localStorage = new LocalStorage(path.join(os.homedir(), '.mcli-nav'));

interface Bookmark {
    name: string;
    path: string;
    visits: number;
    lastVisit: number;
}

export function directoryNavigator(program: Command) {
    program
        .command('nav')
        .description('Quick directory navigation')
        .option('-a, --add <name>', 'Add current directory or specified path to bookmarks')
        .option('-r, --remove <name>', 'Remove a bookmark')
        .option('-l, --list', 'List all bookmarks')
        .option('-c, --clear', 'Clear all bookmarks')
        .option('-g, --go [name]', 'Go to a bookmarked directory')
        .option('-p, --path <path>', 'Specify a path when adding a bookmark')
        .action(async (options) => {
            try {
                let bookmarks: Record<string, Bookmark> = JSON.parse(localStorage.getItem('bookmarks') || '{}');

                if (options.add) {
                    const pathToAdd = options.path || process.cwd();
                    try {
                        const stats = await fs.stat(pathToAdd);
                        if (!stats.isDirectory()) {
                            console.error(chalk.red('Error: Not a directory'));
                            return;
                        }
                    } catch {
                        console.error(chalk.red('Error: Directory does not exist'));
                        return;
                    }

                    bookmarks[options.add] = {
                        name: options.add,
                        path: pathToAdd,
                        visits: 0,
                        lastVisit: Date.now()
                    };

                    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
                    console.log(chalk.green(`Bookmark '${options.add}' added for ${pathToAdd}`));
                }

                else if (options.remove) {
                    if (!bookmarks[options.remove]) {
                        console.error(chalk.red(`Bookmark '${options.remove}' not found`));
                        return;
                    }

                    delete bookmarks[options.remove];
                    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
                    console.log(chalk.green(`Bookmark '${options.remove}' removed`));
                }

                else if (options.list) {
                    if (Object.keys(bookmarks).length === 0) {
                        console.log(chalk.yellow('No bookmarks saved'));
                        return;
                    }

                    console.log(chalk.blue('\nSaved Bookmarks:'));
                    Object.values(bookmarks)
                        .sort((a, b) => b.visits - a.visits)
                        .forEach(bookmark => {
                            console.log(chalk`{green ${bookmark.name}} {yellow (${bookmark.visits} visits)}
  ${bookmark.path}
`);
                        });
                }

                else if (options.clear) {
                    localStorage.setItem('bookmarks', '{}');
                    console.log(chalk.green('All bookmarks cleared'));
                }

                else if (options.go !== undefined) {
                    if (Object.keys(bookmarks).length === 0) {
                        console.log(chalk.yellow('No bookmarks saved'));
                        return;
                    }

                    let targetBookmark: Bookmark | undefined;

                    if (typeof options.go === 'string') {
                        targetBookmark = bookmarks[options.go];
                        if (!targetBookmark) {
                            console.error(chalk.red(`Bookmark '${options.go}' not found`));
                            return;
                        }
                    } else {
                        const { selection } = await inquirer.prompt([
                            {
                                type: 'list',
                                name: 'selection',
                                message: 'Select bookmark:',
                                choices: Object.values(bookmarks).map(b => ({
                                    name: `${b.name} (${b.path})`,
                                    value: b.name
                                }))
                            }
                        ]);
                        targetBookmark = bookmarks[selection];
                    }

                    targetBookmark.visits++;
                    targetBookmark.lastVisit = Date.now();
                    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));

                    process.chdir(targetBookmark.path);
                    console.log(chalk.green(`Changed directory to: ${targetBookmark.path}`));
                }

                else {
                    console.log(chalk.blue('\nCurrent Directory:'));
                    console.log(process.cwd());

                    if (Object.keys(bookmarks).length > 0) {
                        console.log(chalk.blue('\nMost Used Bookmarks:'));
                        Object.values(bookmarks)
                            .sort((a, b) => b.visits - a.visits)
                            .slice(0, 5)
                            .forEach(bookmark => {
                                console.log(chalk`{green ${bookmark.name}} {yellow (${bookmark.visits} visits)}
  ${bookmark.path}`);
                            });
                    }
                }
            } catch (error: any) {
                console.error(chalk.red('Error:'), error.message);
            }
        });
}
