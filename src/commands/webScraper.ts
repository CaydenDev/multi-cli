import { Command } from 'commander';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export function webScraper(program: Command) {
    program
        .command('scrape')
        .description('Web scraping utilities')
        .option('-u, --url <url>', 'URL to scrape')
        .option('-s, --selector <selector>', 'CSS selector to extract')
        .option('-o, --output <file>', 'Output file (optional)')
        .option('-l, --links', 'Extract all links from the page')
        .option('-i, --images', 'Extract all images from the page')
        .option('-t, --text', 'Extract all text content')
        .action(async (options) => {
            try {
                if (!options.url) {
                    console.error(chalk.red('Error: URL is required'));
                    return;
                }

                console.log(chalk.blue(`Fetching ${options.url}...`));
                const response = await fetch(options.url);
                const html = await response.text();
                const $ = cheerio.load(html);

                let results: string[] = [];

                if (options.selector) {
                    $(options.selector).each((_, el) => {
                        results.push($(el).text().trim());
                    });
                } else if (options.links) {
                    $('a').each((_, el) => {
                        const href = $(el).attr('href');
                        if (href) results.push(href);
                    });
                } else if (options.images) {
                    $('img').each((_, el) => {
                        const src = $(el).attr('src');
                        if (src) results.push(src);
                    });
                } else if (options.text) {
                    results = $('body')
                        .text()
                        .split('\n')
                        .map(line => line.trim())
                        .filter(Boolean);
                } else {
                    console.log(chalk.yellow('No extraction method specified. Use --help to see options.'));
                    return;
                }

                if (options.output) {
                    const outputPath = path.resolve(options.output);
                    await fs.writeFile(outputPath, results.join('\n'));
                    console.log(chalk.green(`Results saved to ${outputPath}`));
                } else {
                    console.log(chalk.green('\nExtracted content:'));
                    results.forEach(result => console.log(chalk.white(result)));
                }
            } catch (error: any) {
                console.error(chalk.red('Error:'), error.message);
            }
        });
}
