import { Command } from 'commander';
import fetch from 'node-fetch';
import ping from 'ping';
import chalk from 'chalk';

interface MonitoringResult {
    timestamp: string;
    status: number;
    responseTime: number;
    isUp: boolean;
}

const monitoringCache = new Map<string, MonitoringResult[]>();

export function websiteMonitor(program: Command) {
    program
        .command('monitor')
        .description('Website uptime monitoring')
        .option('-u, --url <url>', 'URL to monitor')
        .option('-i, --interval <seconds>', 'Check interval in seconds (default: 60)', '60')
        .option('-t, --timeout <seconds>', 'Request timeout in seconds (default: 10)', '10')
        .option('-p, --ping', 'Use ping instead of HTTP request')
        .action(async (options) => {
            try {
                if (!options.url) {
                    console.error(chalk.red('Error: URL is required'));
                    return;
                }

                const interval = parseInt(options.interval) * 1000;
                const timeout = parseInt(options.timeout) * 1000;
                const url = new URL(options.url);
                const hostname = url.hostname;

                console.log(chalk.blue(`Starting monitoring of ${options.url}`));
                console.log(chalk.yellow('Press Ctrl+C to stop monitoring\n'));

                const check = async () => {
                    const startTime = Date.now();
                    let status: number = 0;
                    let responseTime: number = 0;

                    try {
                        if (options.ping) {                            const res = await ping.promise.probe(hostname);
                            status = res.alive ? 200 : 503;
                            responseTime = typeof res.time === 'number' ? res.time : 
                                         typeof res.time === 'string' ? parseFloat(res.time) : 0;
                        } else {
                            const controller = new AbortController();
                            const timeoutId = setTimeout(() => controller.abort(), timeout);

                            const response = await fetch(options.url, {
                                signal: controller.signal
                            });
                            clearTimeout(timeoutId);

                            status = response.status;
                            responseTime = Date.now() - startTime;
                        }                        const result: MonitoringResult = {
                            timestamp: new Date().toISOString(),
                            status,
                            responseTime,
                            isUp: status === 200
                        };

                        const results = monitoringCache.get(options.url) || [];
                        results.push(result);
                        if (results.length > 10) results.shift();
                        monitoringCache.set(options.url, results);

                        const availability = (results.filter(r => r.isUp).length / results.length) * 100;
                        const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;

                        console.clear();
                        console.log(chalk.blue(`Monitoring ${options.url}`));
                        console.log(chalk.yellow('Press Ctrl+C to stop monitoring\n'));                        console.log(chalk`{green Status}: ${result.isUp ? 'UP' : 'DOWN'}`);
                        console.log(chalk`{green Response Time}: ${responseTime}ms`);
                        console.log(chalk`{green Availability}: ${availability.toFixed(1)}%`);
                        console.log(chalk`{green Avg Response Time}: ${avgResponseTime.toFixed(1)}ms\n`);

                        console.log(chalk.yellow('Recent checks:'));
                        results.slice().reverse().forEach(r => {
                            const color = r.isUp ? chalk.green : chalk.red;
                            console.log(color(`${r.timestamp} - Status: ${r.status}, Response Time: ${r.responseTime}ms`));
                        });

                    } catch (error: any) {
                        console.clear();
                        console.log(chalk.red(`Error monitoring ${options.url}:`));
                        console.log(chalk.red(error.message));
                    }
                };

                await check();

                const intervalId = setInterval(check, interval);

                process.on('SIGINT', () => {
                    clearInterval(intervalId);
                    console.log(chalk.yellow('\nMonitoring stopped'));
                    process.exit(0);
                });
            } catch (error: any) {
                console.error(chalk.red('Error:'), error.message);
            }
        });
}
