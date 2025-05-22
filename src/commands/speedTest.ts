import { Command } from 'commander';
import speedTest from 'speedtest-net';
import chalk from 'chalk';
import { Spinner } from 'cli-spinner';

export function internetSpeedTest(program: Command) {
    program
        .command('speed')
        .description('Run internet speed test')
        .option('-j, --json', 'Output results in JSON format')
        .action(async (options) => {            try {
                const spinner = new Spinner('Starting speed test... %s');
                spinner.setSpinnerString('|/-\\');
                spinner.start();

                const test = await speedTest({
                    acceptLicense: true,
                    acceptGdpr: true
                });

                spinner.stop(true);

                if (options.json) {
                    console.log(JSON.stringify(test, null, 2));
                } else {
                    console.log(chalk`
{blue Speed Test Results:}

{green Download Speed}: ${(test.download.bandwidth / 125000).toFixed(2)} Mbps
{green Upload Speed}: ${(test.upload.bandwidth / 125000).toFixed(2)} Mbps
{green Ping}: ${test.ping.latency.toFixed(0)} ms
{yellow ISP}: ${test.isp}
{yellow Server}: ${test.server.location} (${test.server.name})
`);
                }
            } catch (error: any) {
                console.error(chalk.red('Error:'), error.message);
            }
        });
}
