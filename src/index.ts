#!/usr/bin/env node

import { Command } from 'commander';
import { apiTest } from './commands/apiTest';
import { processMonitor } from './commands/processMonitor';
import { redditBrowser } from './commands/redditBrowser';
import { youtubeDownloader } from './commands/youtubeDownloader';
import { newsReader } from './commands/newsReader';
import { gitControl } from './commands/gitControl';
import { webScraper } from './commands/webScraper';
import { websiteMonitor } from './commands/websiteMonitor';

const program = new Command();

program
  .name('mcli')
  .description('A user-friendly multi-purpose CLI tool')
  .version('1.0.4');

// Register all commands
apiTest(program);
processMonitor(program);
redditBrowser(program);
youtubeDownloader(program);
newsReader(program);
gitControl(program);
webScraper(program);
websiteMonitor(program);

program.parse(process.argv);
