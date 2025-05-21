#!/usr/bin/env node

import { Command } from 'commander';
import { apiTest } from './commands/apiTest';
import { processMonitor } from './commands/processMonitor';

const program = new Command();

program
  .name('mcli')
  .description('A user-friendly multi-purpose CLI tool')
  .version('1.0.0');

apiTest(program);
processMonitor(program);

program.parse(process.argv);
