import { Command } from 'commander';
import inquirer from 'inquirer';
import Snoowrap from 'snoowrap';
import chalk from 'chalk';
import opener from 'opener';

type TimeFilter = 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';

const reddit = new Snoowrap({
    userAgent: 'multi-cli:v1.0.0',
    clientId: process.env.REDDIT_CLIENT_ID || '',
    clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
    refreshToken: process.env.REDDIT_REFRESH_TOKEN || ''
});

export function redditBrowser(program: Command) {
    program
        .command('reddit')
        .description('Browse Reddit posts from the CLI')
        .option('-s, --subreddit <n>', 'Specify subreddit (default: "all")', 'all')
        .option('-t, --time <period>', 'Time period (hour, day, week, month, year, all)', 'day')
        .option('-l, --limit <number>', 'Number of posts to show', '10')
        .option('--search <query>', 'Search for specific content')
        .action(async (options) => {
            try {
                let posts;
                if (options.search) {
                    posts = await reddit.search({
                        query: options.search,
                        subreddit: options.subreddit,
                        time: options.time as TimeFilter,
                        limit: parseInt(options.limit)
                    });
                } else {
                    const subreddit = reddit.getSubreddit(options.subreddit);
                    posts = await subreddit.getTop({
                        time: options.time as TimeFilter,
                        limit: parseInt(options.limit)
                    });
                }

                console.log(chalk.bold(`\nTop posts from r/${options.subreddit}:`));
                console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));

                const { selectedPost } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'selectedPost',
                        message: 'Select a post to open:',
                        choices: posts.map((post: any) => ({
                            name: `[${post.score}↑] ${post.title}`,
                            value: post
                        }))
                    }
                ]);

                if (selectedPost) {
                    const { action } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'action',
                            message: 'What would you like to do?',
                            choices: [
                                { name: 'Open in browser', value: 'open' },
                                { name: 'Show details', value: 'details' },
                                { name: 'Show comments', value: 'comments' }
                            ]
                        }
                    ]);

                    switch (action) {
                        case 'open':                            opener(selectedPost.url);
                            break;
                        case 'details':
                            console.log('\nPost Details:');
                            console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));
                            console.log(chalk.bold('Title:'), selectedPost.title);
                            console.log(chalk.bold('Author:'), selectedPost.author.name);
                            console.log(chalk.bold('Score:'), selectedPost.score);
                            console.log(chalk.bold('Comments:'), selectedPost.num_comments);
                            console.log(chalk.bold('URL:'), selectedPost.url);
                            if (selectedPost.selftext) {
                                console.log(chalk.bold('\nContent:'));
                                console.log(selectedPost.selftext);
                            }
                            break;
                        case 'comments':
                            const comments = await selectedPost.expandReplies({ limit: 10, depth: 1 });
                            console.log('\nTop Comments:');
                            console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));
                            comments.comments.forEach((comment: any) => {
                                console.log(chalk.bold(`[${comment.score}↑] ${comment.author.name}:`));
                                console.log(comment.body);
                                console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));
                            });
                            break;
                    }
                }
            } catch (error: any) {
                console.error(chalk.red('Error:'), error.message);
                if (!process.env.REDDIT_CLIENT_ID) {
                    console.log(chalk.yellow('\nTo use the Reddit browser, you need to set up Reddit API credentials:'));
                    console.log('1. Create a Reddit app at https://www.reddit.com/prefs/apps');
                    console.log('2. Set these environment variables:');
                    console.log('   REDDIT_CLIENT_ID');
                    console.log('   REDDIT_CLIENT_SECRET');
                    console.log('   REDDIT_REFRESH_TOKEN');
                }
            }
        });
}
