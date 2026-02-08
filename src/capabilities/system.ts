import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import open from 'open';
import { Logger } from '../utils/logger.js';
import { ExecutionResult } from '../core/task-executor.js';

const execAsync = promisify(exec);

export class SystemControl {
    private logger: Logger;
    private blockedCommands: Set<string>;

    constructor() {
        this.logger = new Logger('System');
        // Commands that should be blocked for safety
        this.blockedCommands = new Set([
            'format',
            'del',
            'rm',
            'rmdir',
            'rd',
            'diskpart'
        ]);
    }

    async runCommand(command: string): Promise<ExecutionResult> {
        try {
            // Safety check - block dangerous commands
            const lowerCmd = command.toLowerCase();
            for (const blocked of this.blockedCommands) {
                if (lowerCmd.includes(blocked)) {
                    return {
                        success: false,
                        error: `⚠️ Command "${blocked}" is blocked for safety. If you need to run this, use the terminal directly.`
                    };
                }
            }

            this.logger.info(`Running command: ${command}`);

            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000, // 30 second timeout
                maxBuffer: 1024 * 1024 // 1MB buffer
            });

            const output = stdout || stderr;
            const truncated = output.length > 2000
                ? output.substring(0, 2000) + '\n... (output truncated)'
                : output;

            return {
                success: true,
                output: `💻 Command executed:\n\`\`\`\n${truncated}\n\`\`\``
            };
        } catch (error) {
            this.logger.error('Command error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                error: `Command failed: ${errorMessage.substring(0, 500)}`
            };
        }
    }

    async openApp(appName: string): Promise<ExecutionResult> {
        try {
            this.logger.info(`Opening application: ${appName}`);

            // Common application mappings for Windows
            const appMappings: Record<string, string> = {
                'notepad': 'notepad',
                'calculator': 'calc',
                'calc': 'calc',
                'explorer': 'explorer',
                'cmd': 'cmd',
                'powershell': 'powershell',
                'chrome': 'chrome',
                'firefox': 'firefox',
                'edge': 'msedge',
                'code': 'code',
                'vscode': 'code',
                'vs code': 'code',
                'spotify': 'spotify',
                'discord': 'discord',
                'slack': 'slack',
                'teams': 'teams',
                'word': 'winword',
                'excel': 'excel',
                'powerpoint': 'powerpnt',
                'outlook': 'outlook'
            };

            const appCommand = appMappings[appName.toLowerCase()] || appName;

            // Use 'open' package which works cross-platform
            await open(appCommand);

            return {
                success: true,
                output: `🚀 Launched ${appName}`
            };
        } catch (error) {
            // Fallback: try running as command
            try {
                await execAsync(`start "" "${appName}"`, { shell: 'cmd.exe' });
                return {
                    success: true,
                    output: `🚀 Launched ${appName}`
                };
            } catch {
                this.logger.error('Open app error:', error);
                return {
                    success: false,
                    error: `Failed to open ${appName}. Make sure the application is installed.`
                };
            }
        }
    }

    async getSystemInfo(type: string = 'all'): Promise<ExecutionResult> {
        try {
            const info: string[] = [];

            if (type === 'all' || type === 'cpu') {
                const cpus = os.cpus();
                info.push(`🖥️ **CPU:** ${cpus[0].model}`);
                info.push(`   Cores: ${cpus.length}`);

                // Get CPU usage
                const cpuUsage = cpus.reduce((acc, cpu) => {
                    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
                    const idle = cpu.times.idle;
                    return acc + ((total - idle) / total) * 100;
                }, 0) / cpus.length;
                info.push(`   Usage: ${cpuUsage.toFixed(1)}%`);
            }

            if (type === 'all' || type === 'memory') {
                const totalMem = os.totalmem();
                const freeMem = os.freemem();
                const usedMem = totalMem - freeMem;
                const usagePercent = (usedMem / totalMem) * 100;

                info.push(`💾 **Memory:**`);
                info.push(`   Total: ${this.formatBytes(totalMem)}`);
                info.push(`   Used: ${this.formatBytes(usedMem)} (${usagePercent.toFixed(1)}%)`);
                info.push(`   Free: ${this.formatBytes(freeMem)}`);
            }

            if (type === 'all' || type === 'disk') {
                info.push(`💽 **Disk:** Run 'wmic logicaldisk get size,freespace,caption' for details`);
            }

            if (type === 'all') {
                info.push(`🖥️ **System:**`);
                info.push(`   Platform: ${os.platform()} ${os.release()}`);
                info.push(`   Hostname: ${os.hostname()}`);
                info.push(`   Uptime: ${this.formatUptime(os.uptime())}`);
                info.push(`   User: ${os.userInfo().username}`);
            }

            return {
                success: true,
                output: info.join('\n')
            };
        } catch (error) {
            this.logger.error('System info error:', error);
            return {
                success: false,
                error: `Failed to get system info: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    private formatBytes(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        const parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);

        return parts.join(' ') || '< 1m';
    }
}
