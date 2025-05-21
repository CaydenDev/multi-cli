import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { clearScreenDown, cursorTo } from 'readline';
import * as si from 'systeminformation';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ProcessInfo {
  pid: number;
  name: string;
  memory: number;
}

async function getProcessList(): Promise<ProcessInfo[]> {
  const command = 'Get-Process | Select-Object Id,Name,WorkingSet | Sort-Object WorkingSet -Descending | ConvertTo-Csv -NoTypeInformation';
  
  try {
    const { stdout } = await execAsync(`powershell -Command "${command}"`, { maxBuffer: 1024 * 1024 * 10 });
    
    const lines = stdout.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('"Id"'));

    const processes: ProcessInfo[] = [];
    
    for (const line of lines) {
      try {
        const [pidStr, name, workingSetStr] = line.split(',').map(s => s.replace(/"/g, ''));
        
        if (!pidStr || !name || !workingSetStr) continue;

        const pid = parseInt(pidStr);
        if (isNaN(pid)) continue;

        const memory = parseInt(workingSetStr) / (1024 * 1024);
        if (isNaN(memory)) continue;

        processes.push({ pid, name, memory });
      } catch (err) {
        continue;
      }
    }

    return processes;
  } catch (error) {
    console.error(chalk.red('Error getting process list:'), error);
    return [];
  }
}

function formatRow(pid: string, name: string, memory: string, usage: string, widths: number[]): string {
  return `│ ${pid.padEnd(widths[0])} │ ${name.padEnd(widths[1])} │ ${memory.padEnd(widths[2])} │ ${usage.padEnd(widths[3])} │`;
}

export function processMonitor(program: Command) {
  program
    .command('top')
    .description('Interactive process monitor with color output')
    .option('-n, --number <number>', 'Number of processes to show', '10')
    .action(async (options) => {
      const numProcesses = parseInt(options.number);
      
      process.stdout.write('\x1B[?25l');
      
      const cleanup = () => {
        process.stdout.write('\x1B[?25h');
        process.exit(0);
      };
      
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      const widths = [6, 35, 9, 8];
      const totalWidth = widths.reduce((a, b) => a + b, 0) + 7;

      const header = formatRow(
        chalk.cyan('PID'),
        chalk.cyan('Process Name'),
        chalk.cyan('Memory'),
        chalk.cyan('Usage'),
        widths
      );

      while (true) {
        try {
          const [processes, cpuData, memData] = await Promise.all([
            getProcessList(),
            si.currentLoad(),
            si.mem()
          ]);

          processes.sort((a, b) => b.memory - a.memory);

          cursorTo(process.stdout, 0, 0);
          clearScreenDown(process.stdout);

          const totalMemGB = memData.total / (1024 * 1024 * 1024);
          const usedMemGB = (memData.total - memData.free) / (1024 * 1024 * 1024);
          const memPercent = (usedMemGB / totalMemGB * 100).toFixed(1);

          const totalMemMB = memData.total / (1024 * 1024);

          console.log(chalk.bold('\nProcess Monitor') + chalk.dim(' (Press Ctrl+C to exit)'));
          console.log('─'.repeat(totalWidth));
          console.log(
            chalk.dim(`CPU: ${cpuData.currentLoad.toFixed(1)}% │ `) + 
            chalk.dim(`Memory: ${usedMemGB.toFixed(1)}/${totalMemGB.toFixed(1)} GB (${memPercent}%) │ `) +
            chalk.dim(`Processes: ${processes.length}`)
          );
          console.log('─'.repeat(totalWidth));

          console.log(header);
          console.log('─'.repeat(totalWidth));

          processes.slice(0, numProcesses).forEach(proc => {
            const memoryPercent = (proc.memory / totalMemMB) * 100;
            const memColor = memoryPercent > 10 ? chalk.red : 
                           memoryPercent > 5 ? chalk.yellow : chalk.green;
            
            const name = proc.name.length > widths[1] ? proc.name.slice(0, widths[1] - 3) + '...' : proc.name;
            
            console.log(formatRow(
              proc.pid.toString(),
              chalk.white(name),
              memColor(proc.memory.toFixed(0) + ' MB'),
              memColor(memoryPercent.toFixed(1) + '%'),
              widths
            ));
          });

          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
          console.error(chalk.red('Error:'), error.message);
          cleanup();
        }
      }
    });
}
