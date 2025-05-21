import { Command } from 'commander';
import inquirer from 'inquirer';
import Parser from 'rss-parser';
import chalk from 'chalk';
import opener from 'opener';
import axios from 'axios';

const parser = new Parser();

interface NewsSource {
    name: string;
    url: string;
    type: 'rss' | 'api';
}

const NEWS_SOURCES: NewsSource[] = [
    { name: 'Hacker News', url: 'https://hn.algolia.com/api/v1/search_by_date?tags=story', type: 'api' },
    { name: 'Reddit /r/technology', url: 'https://www.reddit.com/r/technology/top/.json?limit=25', type: 'api' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', type: 'rss' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', type: 'rss' }
];

async function fetchHackerNews() {
    const response = await axios.get('https://hn.algolia.com/api/v1/search_by_date?tags=story');
    const data = response.data as { hits: Array<{ title: string; url: string; points: number; author: string; created_at: string; num_comments: number; }> };
    return data.hits.map(item => ({
        title: item.title,
        link: item.url,
        score: item.points,
        author: item.author,
        date: new Date(item.created_at).toLocaleString(),
        comments: item.num_comments
    }));
}

async function fetchRedditTechnology() {
    const response = await axios.get('https://www.reddit.com/r/technology/top/.json?limit=25');
    const data = response.data as { data: { children: Array<{ data: { title: string; url: string; score: number; author: string; created_utc: number; num_comments: number; }; }>; }; };
    return data.data.children.map(item => ({
        title: item.data.title,
        link: item.data.url,
        score: item.data.score,
        author: item.data.author,
        date: new Date(item.data.created_utc * 1000).toLocaleString(),
        comments: item.data.num_comments
    }));
}

async function fetchRssFeed(url: string) {
    const feed = await parser.parseURL(url);
    return feed.items.map(item => ({
        title: item.title || '',
        link: item.link || '',
        author: item.creator || item.author || 'Unknown',
        date: item.pubDate ? new Date(item.pubDate).toLocaleString() : 'Unknown',
        description: item.contentSnippet || ''
    }));
}

export function newsReader(program: Command) {
    program
        .command('news')
        .description('Read news from various sources')
        .option('-s, --source <name>', 'Specify news source')
        .action(async (options) => {
            try {
                let selectedSource: NewsSource;
                if (!options.source) {
                    const { source } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'source',
                            message: 'Select news source:',
                            choices: NEWS_SOURCES.map(s => ({
                                name: s.name,
                                value: s
                            }))
                        }
                    ]);
                    selectedSource = source;
                } else {
                    selectedSource = NEWS_SOURCES.find(s => 
                        s.name.toLowerCase() === options.source.toLowerCase()
                    ) || NEWS_SOURCES[0];
                }

                console.log(chalk.dim(`\nFetching news from ${selectedSource.name}...`));

                let articles;
                switch (selectedSource.name) {
                    case 'Hacker News':
                        articles = await fetchHackerNews();
                        break;
                    case 'Reddit /r/technology':
                        articles = await fetchRedditTechnology();
                        break;
                    default:
                        articles = await fetchRssFeed(selectedSource.url);
                }

                console.log(chalk.bold(`\n${selectedSource.name} - Top Stories`));
                console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));

                while (true) {
                    const { article } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'article',
                            message: 'Select an article:',
                            choices: [
                                ...articles.map((a: any) => ({
                                    name: `${a.title} ${a.score ? chalk.dim(`[${a.score}↑]`) : ''}`,
                                    value: a
                                })),
                                new inquirer.Separator(),
                                { name: 'Exit', value: 'exit' }
                            ]
                        }
                    ]);

                    if (article === 'exit') break;

                    const { action } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'action',
                            message: 'What would you like to do?',
                            choices: [
                                { name: 'Open in browser', value: 'open' },
                                { name: 'Show details', value: 'details' },
                                { name: 'Back to list', value: 'back' }
                            ]
                        }
                    ]);

                    switch (action) {
                        case 'open':                            opener(article.link);
                            break;
                        case 'details':
                            console.log('\nArticle Details:');
                            console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));
                            console.log(chalk.bold('Title:'), article.title);
                            console.log(chalk.bold('Author:'), article.author);
                            console.log(chalk.bold('Date:'), article.date);
                            if (article.score) {
                                console.log(chalk.bold('Score:'), article.score);
                            }
                            if (article.comments) {
                                console.log(chalk.bold('Comments:'), article.comments);
                            }
                            if (article.description) {
                                console.log(chalk.bold('\nDescription:'));
                                console.log(article.description);
                            }
                            console.log(chalk.bold('\nURL:'), article.link);
                            console.log(chalk.dim('─'.repeat(process.stdout.columns || 80)));
                            break;
                    }
                }
            } catch (error: any) {
                console.error(chalk.red('Error:'), error.message);
            }
        });
}
