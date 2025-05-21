import { Command } from 'commander';
import inquirer from 'inquirer';
import ytdl from '@distube/ytdl-core';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const fsAccess = promisify(fs.access);

function isValidYouTubeUrl(url: string): boolean {
    return ytdl.validateURL(url);
}

async function checkDependencies(): Promise<boolean> {
    try {
        const { stdout } = await execAsync('pwsh -NoProfile -Command "& { $ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue; if ($ffmpeg) { Write-Output $ffmpeg.Source } }"');
        
        if (stdout.trim()) {
            try {
                await execAsync('ffmpeg -version');
                return true;
            } catch {
                const ffmpegDir = path.dirname(stdout.trim());
                process.env.PATH = `${process.env.PATH};${ffmpegDir}`;
                try {
                    await execAsync('ffmpeg -version');
                    return true;
                } catch {
                    throw new Error('FFmpeg found but not working');
                }
            }
        }

        const { stdout: programFilesPath } = await execAsync('pwsh -NoProfile -Command "& { Get-ChildItem -Path $env:ProgramFiles, ${env:ProgramFiles(x86)} -Recurse -Filter \'ffmpeg.exe\' -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName }"');
        
        if (programFilesPath.trim()) {
            const ffmpegDir = path.dirname(programFilesPath.trim());
            process.env.PATH = `${process.env.PATH};${ffmpegDir}`;
            try {
                await execAsync('ffmpeg -version');
                return true;
            } catch {
                throw new Error('FFmpeg found but not working');
            }
        }
    } catch (error) {
        console.error(chalk.red('FFmpeg is not found or not working.'));
        console.log(chalk.yellow('\nTroubleshooting steps:'));
        console.log('1. Run this command to update PATH:');
        console.log('   $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine")');
        console.log('2. Or restart your terminal');
        console.log('3. Make sure FFmpeg\'s location is in your system PATH');
        console.log('\nIf FFmpeg is not installed:');
        console.log('1. Install with winget: winget install "FFmpeg (Essentials Build)"');
        console.log('2. Then run: . $PROFILE');
        return false;
    }

    return false;
}

async function checkOutputDirectory(dir: string): Promise<boolean> {
    try {
        if (!fs.existsSync(dir)) {
            await promisify(fs.mkdir)(dir, { recursive: true });
        }
        await fsAccess(dir, fs.constants.W_OK);
        return true;
    } catch (error) {
        console.error(chalk.red(`Error accessing output directory ${dir}:`), error instanceof Error ? error.message : 'Unknown error');
        return false;
    }
}

export function youtubeDownloader(program: Command) {
    program
        .command('yt')
        .description('Download YouTube videos')
        .argument('[url]', 'YouTube video URL')
        .option('-f, --format <format>', 'Download format (video, audio)', 'video')
        .option('-q, --quality <quality>', 'Video quality (highest, lowest)', 'highest')
        .option('-o, --output <path>', 'Output directory', './downloads')
        .action(async (url, options) => {
            try {
                if (!await checkDependencies()) {
                    return;
                }

                if (!await checkOutputDirectory(options.output)) {
                    return;
                }

                if (!url) {
                    const response = await inquirer.prompt([
                        {
                            type: 'input',
                            name: 'url',
                            message: 'Enter YouTube video URL:',
                            validate: (input: string) => {
                                if (!isValidYouTubeUrl(input)) {
                                    return 'Please enter a valid YouTube URL (e.g., https://www.youtube.com/watch?v=...)';
                                }
                                return true;
                            }
                        }
                    ]);
                    url = response.url;
                }

                if (!isValidYouTubeUrl(url)) {
                    console.error(chalk.red('Error: Invalid YouTube URL'));
                    return;
                }

                console.log(chalk.dim('\nFetching video information...'));
                const info = await ytdl.getInfo(url);
                const formats = ytdl.filterFormats(info.formats, options.format === 'audio' ? 'audioonly' : 'videoandaudio');

                if (!formats.length) {
                    console.error(chalk.red('No suitable formats found for this video'));
                    return;
                }

                formats.sort((a, b) => {
                    const qualityA = parseInt(a.height?.toString() || '0');
                    const qualityB = parseInt(b.height?.toString() || '0');
                    return options.quality === 'highest' ? qualityB - qualityA : qualityA - qualityB;
                });

                const availableFormats = formats.filter(f => 
                    options.format === 'audio' ? true : f.hasAudio && f.hasVideo
                );

                if (!availableFormats.length) {
                    console.error(chalk.red(`No ${options.format} formats available for this video`));
                    return;
                }

                const { selectedFormat } = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'selectedFormat',
                        message: 'Select format:',
                        choices: availableFormats.map(f => ({
                            name: `${f.qualityLabel || 'Audio only'} - ${f.container || 'mp4'} ${
                                f.contentLength ? `(${(parseInt(f.contentLength) / 1024 / 1024).toFixed(1)}MB)` : ''
                            }`,
                            value: f
                        }))
                    }
                ]);

                const videoTitle = info.videoDetails.title.replace(/[^\w\s-]/g, '_');
                const extension = selectedFormat.container || 'mp4';
                const outputPath = path.join(options.output, `${videoTitle}.${extension}`);

                console.log(chalk.dim('\nStarting download...'));
                console.log(chalk.cyan(`Title: ${info.videoDetails.title}`));
                console.log(chalk.cyan(`Format: ${selectedFormat.qualityLabel || 'Audio'} ${extension}`));
                console.log(chalk.cyan(`Output: ${outputPath}\n`));

                const writeStream = fs.createWriteStream(outputPath);                const download = ytdl(url, {
                    format: selectedFormat,
                    requestOptions: {
                        headers: {
                            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    }
                });

                let downloadedBytes = 0;
                const totalBytes = parseInt(selectedFormat.contentLength || '0');

                download.on('progress', (_, downloaded, total) => {
                    downloadedBytes = downloaded;
                    process.stdout.write(`\rProgress: ${((downloaded / total) * 100).toFixed(1)}% (${(downloaded / 1024 / 1024).toFixed(1)}MB / ${(total / 1024 / 1024).toFixed(1)}MB)`);
                });

                download.on('error', (error: Error) => {
                    console.error(chalk.red('\nDownload error:'), error.message);
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }
                });

                writeStream.on('error', (error: Error) => {
                    console.error(chalk.red('\nError writing file:'), error.message);
                    if (fs.existsSync(outputPath)) {
                        fs.unlinkSync(outputPath);
                    }
                });

                download.pipe(writeStream);

                writeStream.on('finish', () => {
                    console.log(chalk.green('\n\nDownload completed!'));
                    console.log(chalk.dim(`File saved to: ${outputPath}`));
                });

            } catch (error: any) {
                console.error(chalk.red('Error:'), error.message);
                if (error.message.includes('age-restricted')) {
                    console.log(chalk.yellow('\nNote: This video is age-restricted and cannot be downloaded.'));
                } else if (error.message.includes('private')) {
                    console.log(chalk.yellow('\nNote: This video is private and cannot be accessed.'));
                } else if (error.message.includes('copyright')) {
                    console.log(chalk.yellow('\nNote: This video is not available due to copyright restrictions.'));
                } else {
                    console.log(chalk.yellow('\nTip: If you keep seeing errors, try:'));
                    console.log('1. Check if the video is available in your region');
                    console.log('2. Make sure the video URL is correct');
                    console.log('3. Check your internet connection');
                }
            }
        });
}
