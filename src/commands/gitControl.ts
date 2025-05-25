import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface GitStatus {
    staged: string[];
    unstaged: string[];
    untracked: string[];
}

interface GitRemote {
    name: string;
    url: string;
}

async function executeGit(command: string): Promise<string> {
    try {
        const { stdout } = await execAsync(`git ${command}`);
        return stdout.trim();
    } catch (error: any) {
        if (error.stderr) {
            throw new Error(error.stderr.trim());
        }
        throw error;
    }
}

async function getGitStatus(): Promise<GitStatus> {
    const status: GitStatus = {
        staged: [],
        unstaged: [],
        untracked: []
    };

    try {
        const output = await executeGit('status --porcelain');
        const lines = output.split('\n').filter(Boolean);

        lines.forEach(line => {
            const [staged, unstaged] = line.slice(0, 2);
            const file = line.slice(3);

            if (staged !== ' ' && staged !== '?') {
                status.staged.push(file);
            }
            if (unstaged !== ' ' && staged !== '?') {
                status.unstaged.push(file);
            }
            if (staged === '?' && unstaged === '?') {
                status.untracked.push(file);
            }
        });

        return status;
    } catch (error) {
        throw new Error('Failed to get git status');
    }
}

async function getBranches(): Promise<{ current: string; all: string[]; remotes: string[] }> {
    try {
        const output = await executeGit('branch -a');
        const branches = output.split('\n')
            .map(b => b.trim())
            .filter(Boolean);

        const current = branches.find(b => b.startsWith('*'))?.slice(2) || '';
        const remotes = branches
            .filter(b => b.startsWith('remotes/'))
            .map(b => b.slice(8));
        const locals = branches
            .filter(b => !b.startsWith('remotes/'))
            .map(b => b.startsWith('*') ? b.slice(2) : b);

        return { current, all: locals, remotes };
    } catch (error) {
        throw new Error('Failed to get branches');
    }
}

async function getRemotes(): Promise<GitRemote[]> {
    try {
        const output = await executeGit('remote -v');
        const lines = output.split('\n').filter(Boolean);
        const remotes: GitRemote[] = [];

        lines.forEach(line => {
            const [name, url] = line.split('\t');
            if (!remotes.find(r => r.name === name)) {
                remotes.push({ name, url: url.split(' ')[0] });
            }
        });

        return remotes;
    } catch (error) {
        throw new Error('Failed to get remotes');
    }
}

export function gitControl(program: Command) {
    program
        .command('cntrl')
        .description('Git version control utilities')
        .option('-s, --status', 'Show git status')
        .option('-b, --branch', 'Show current branch')
        .option('-c, --checkout <branch>', 'Checkout branch')
        .option('-n, --new <branch>', 'Create and checkout new branch')
        .option('-a, --add <files>', 'Add files to staging')
        .option('-m, --commit <message>', 'Commit staged changes')
        .option('-p, --push', 'Push commits to remote')
        .option('-l, --pull', 'Pull changes from remote')
        .option('-i, --interactive', 'Interactive mode')
        .action(async (options) => {
            try {
                try {
                    await executeGit('rev-parse --is-inside-work-tree');
                } catch {
                    console.error(chalk.red('Error: Not a git repository'));
                    return;
                }

                if (options.interactive) {
                    const { action } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'action',
                            message: 'What would you like to do?',
                            choices: [
                                { name: 'View Status', value: 'status' },
                                { name: 'Branch Operations', value: 'branch' },
                                { name: 'Remote Operations', value: 'remote' },
                                { name: 'Stage Changes', value: 'add' },
                                { name: 'Commit Changes', value: 'commit' },
                                { name: 'Push/Pull Changes', value: 'sync' },
                                { name: 'Advanced Operations', value: 'advanced' }
                            ]
                        }
                    ]);

                    switch (action) {
                        case 'status': {
                            const status = await getGitStatus();
                            console.log(chalk.bold('\nGit Status:'));
                            if (status.staged.length) {
                                console.log(chalk.green('\nStaged changes:'));
                                status.staged.forEach(file => console.log(`  ${file}`));
                            }
                            if (status.unstaged.length) {
                                console.log(chalk.yellow('\nUnstaged changes:'));
                                status.unstaged.forEach(file => console.log(`  ${file}`));
                            }
                            if (status.untracked.length) {
                                console.log(chalk.red('\nUntracked files:'));
                                status.untracked.forEach(file => console.log(`  ${file}`));
                            }
                            break;
                        }
                        case 'branch': {
                            const { operation } = await inquirer.prompt([
                                {
                                    type: 'list',
                                    name: 'operation',
                                    message: 'Branch operation:',
                                    choices: [
                                        { name: 'List branches', value: 'list' },
                                        { name: 'Create new branch', value: 'create' },
                                        { name: 'Switch branch', value: 'switch' },
                                        { name: 'Delete branch', value: 'delete' },
                                        { name: 'Set upstream', value: 'upstream' }
                                    ]
                                }
                            ]);

                            const { current, all, remotes } = await getBranches();

                            if (operation === 'list') {
                                console.log(chalk.bold('\nCurrent branch:'), chalk.green(current));
                                console.log(chalk.bold('\nLocal branches:'));
                                all.forEach(branch => {
                                    console.log(`  ${branch === current ? chalk.green('*') : ' '} ${branch}`);
                                });
                                console.log(chalk.bold('\nRemote branches:'));
                                remotes.forEach(branch => console.log(`  ${branch}`));
                            } else if (operation === 'create') {
                                const { name } = await inquirer.prompt([
                                    {
                                        type: 'input',
                                        name: 'name',
                                        message: 'New branch name:',
                                        validate: (input: string) => !!input || 'Branch name is required'
                                    }
                                ]);
                                await executeGit(`checkout -b ${name}`);
                                console.log(chalk.green(`Created and switched to branch '${name}'`));
                            } else if (operation === 'switch') {
                                const { branch } = await inquirer.prompt([
                                    {
                                        type: 'list',
                                        name: 'branch',
                                        message: 'Select branch:',
                                        choices: all.filter(b => b !== current)
                                    }
                                ]);
                                await executeGit(`checkout ${branch}`);
                                console.log(chalk.green(`Switched to branch '${branch}'`));
                            } else if (operation === 'delete') {
                                const { branch } = await inquirer.prompt([
                                    {
                                        type: 'list',
                                        name: 'branch',
                                        message: 'Select branch to delete:',
                                        choices: all.filter(b => b !== current)
                                    }
                                ]);
                                await executeGit(`branch -d ${branch}`);
                                console.log(chalk.green(`Deleted branch '${branch}'`));
                            } else if (operation === 'upstream') {
                                const remotes = await getRemotes();
                                const { remote } = await inquirer.prompt([
                                    {
                                        type: 'list',
                                        name: 'remote',
                                        message: 'Select remote:',
                                        choices: remotes.map(r => r.name)
                                    }
                                ]);
                                await executeGit(`branch --set-upstream-to=${remote}/${current} ${current}`);
                                console.log(chalk.green(`Set upstream for '${current}' to '${remote}/${current}'`));
                            }
                            break;
                        }
                        case 'remote': {
                            const { operation } = await inquirer.prompt([
                                {
                                    type: 'list',
                                    name: 'operation',
                                    message: 'Remote operation:',
                                    choices: [
                                        { name: 'List remotes', value: 'list' },
                                        { name: 'Add remote', value: 'add' },
                                        { name: 'Remove remote', value: 'remove' }
                                    ]
                                }
                            ]);

                            if (operation === 'list') {
                                const remotes = await getRemotes();
                                console.log(chalk.bold('\nRemotes:'));
                                remotes.forEach(remote => {
                                    console.log(`  ${chalk.green(remote.name)}: ${remote.url}`);
                                });
                            } else if (operation === 'add') {
                                const { name, url } = await inquirer.prompt([
                                    {
                                        type: 'input',
                                        name: 'name',
                                        message: 'Remote name:',
                                        validate: (input: string) => !!input || 'Remote name is required'
                                    },
                                    {
                                        type: 'input',
                                        name: 'url',
                                        message: 'Remote URL:',
                                        validate: (input: string) => !!input || 'Remote URL is required'
                                    }
                                ]);
                                await executeGit(`remote add ${name} ${url}`);
                                console.log(chalk.green(`Added remote '${name}'`));
                            } else if (operation === 'remove') {
                                const remotes = await getRemotes();
                                const { name } = await inquirer.prompt([
                                    {
                                        type: 'list',
                                        name: 'name',
                                        message: 'Select remote to remove:',
                                        choices: remotes.map(r => r.name)
                                    }
                                ]);
                                await executeGit(`remote remove ${name}`);
                                console.log(chalk.green(`Removed remote '${name}'`));
                            }
                            break;
                        }
                        case 'add': {
                            const status = await getGitStatus();
                            const files = [...status.unstaged, ...status.untracked];
                            if (!files.length) {
                                console.log(chalk.yellow('No changes to stage'));
                                break;
                            }

                            const { selected } = await inquirer.prompt([
                                {
                                    type: 'checkbox',
                                    name: 'selected',
                                    message: 'Select files to stage:',
                                    choices: files.map(file => ({
                                        name: file,
                                        value: file
                                    }))
                                }
                            ]);

                            if (selected.length) {
                                await executeGit(`add ${selected.join(' ')}`);
                                console.log(chalk.green('Changes staged successfully'));
                            }
                            break;
                        }
                        case 'commit': {
                            const { message } = await inquirer.prompt([
                                {
                                    type: 'input',
                                    name: 'message',
                                    message: 'Commit message:',
                                    validate: (input: string) => !!input || 'Commit message is required'
                                }
                            ]);

                            await executeGit(`commit -m "${message}"`);
                            console.log(chalk.green('Changes committed successfully'));
                            break;
                        }
                        case 'sync': {
                            const { operation } = await inquirer.prompt([
                                {
                                    type: 'list',
                                    name: 'operation',
                                    message: 'Select operation:',
                                    choices: [
                                        { name: 'Push', value: 'push' },
                                        { name: 'Pull', value: 'pull' },
                                        { name: 'Fetch', value: 'fetch' }
                                    ]
                                }
                            ]);

                            if (operation === 'push') {
                                await executeGit('push');
                                console.log(chalk.green('Changes pushed successfully'));
                            } else if (operation === 'pull') {
                                await executeGit('pull');
                                console.log(chalk.green('Changes pulled successfully'));
                            } else if (operation === 'fetch') {
                                await executeGit('fetch --all');
                                console.log(chalk.green('Fetched all remotes successfully'));
                            }
                            break;
                        }
                        case 'advanced': {
                            const { operation } = await inquirer.prompt([
                                {
                                    type: 'list',
                                    name: 'operation',
                                    message: 'Select operation:',
                                    choices: [
                                        { name: 'Merge branch', value: 'merge' },
                                        { name: 'Rebase branch', value: 'rebase' },
                                        { name: 'Stash changes', value: 'stash' },
                                        { name: 'Pop stashed changes', value: 'stash-pop' }
                                    ]
                                }
                            ]);

                            if (operation === 'merge') {
                                const { all } = await getBranches();
                                const { branch } = await inquirer.prompt([
                                    {
                                        type: 'list',
                                        name: 'branch',
                                        message: 'Select branch to merge:',
                                        choices: all
                                    }
                                ]);
                                await executeGit(`merge ${branch}`);
                                console.log(chalk.green(`Merged branch '${branch}' successfully`));
                            } else if (operation === 'rebase') {
                                const { all } = await getBranches();
                                const { branch } = await inquirer.prompt([
                                    {
                                        type: 'list',
                                        name: 'branch',
                                        message: 'Select branch to rebase onto:',
                                        choices: all
                                    }
                                ]);
                                await executeGit(`rebase ${branch}`);
                                console.log(chalk.green(`Rebased onto '${branch}' successfully`));
                            } else if (operation === 'stash') {
                                await executeGit('stash');
                                console.log(chalk.green('Changes stashed successfully'));
                            } else if (operation === 'stash-pop') {
                                await executeGit('stash pop');
                                console.log(chalk.green('Popped stashed changes successfully'));
                            }
                            break;
                        }
                    }
                } else {
                    if (options.status) {
                        const status = await getGitStatus();
                        console.log(chalk.bold('\nGit Status:'));
                        if (status.staged.length) {
                            console.log(chalk.green('\nStaged changes:'));
                            status.staged.forEach(file => console.log(`  ${file}`));
                        }
                        if (status.unstaged.length) {
                            console.log(chalk.yellow('\nUnstaged changes:'));
                            status.unstaged.forEach(file => console.log(`  ${file}`));
                        }
                        if (status.untracked.length) {
                            console.log(chalk.red('\nUntracked files:'));
                            status.untracked.forEach(file => console.log(`  ${file}`));
                        }
                    }

                    if (options.branch) {
                        const { current, all, remotes } = await getBranches();
                        console.log(chalk.bold('\nCurrent branch:'), chalk.green(current));
                        console.log(chalk.bold('\nLocal branches:'));
                        all.forEach(branch => {
                            console.log(`  ${branch === current ? chalk.green('*') : ' '} ${branch}`);
                        });
                        console.log(chalk.bold('\nRemote branches:'));
                        remotes.forEach(branch => console.log(`  ${branch}`));
                    }

                    if (options.checkout) {
                        await executeGit(`checkout ${options.checkout}`);
                        console.log(chalk.green(`Switched to branch '${options.checkout}'`));
                    }

                    if (options.new) {
                        await executeGit(`checkout -b ${options.new}`);
                        console.log(chalk.green(`Created and switched to branch '${options.new}'`));
                    }

                    if (options.add) {
                        await executeGit(`add ${options.add}`);
                        console.log(chalk.green('Changes staged successfully'));
                    }

                    if (options.commit) {
                        await executeGit(`commit -m "${options.commit}"`);
                        console.log(chalk.green('Changes committed successfully'));
                    }

                    if (options.push) {
                        await executeGit('push');
                        console.log(chalk.green('Changes pushed successfully'));
                    }

                    if (options.pull) {
                        await executeGit('pull');
                        console.log(chalk.green('Changes pulled successfully'));
                    }
                }
            } catch (error: any) {
                console.error(chalk.red(`Error: ${error.message}`));
            }
        });
}
