import { Logger } from '../utils/logger.js';

export interface ParsedCommand {
    type: string;
    params: Record<string, unknown>;
    raw?: string;
}

export class CommandParser {
    private logger: Logger;
    private validCommands: Set<string>;

    constructor() {
        this.logger = new Logger('CommandParser');
        this.validCommands = new Set([
            // File operations
            'file_search',
            'file_read',
            'file_download',
            'dir_list',
            // Browser
            'browser_open',
            'browser_search',
            'browser_screenshot',
            // System
            'system_run',
            'system_open_app',
            'system_info',
            'screenshot',
            // Web Search
            'web_search',
            'youtube_search',
            'amazon_search',
            // Productivity
            'add_note',
            'get_notes',
            'add_todo',
            'get_todos',
            'complete_todo',
            'add_reminder',
            'get_reminders',
            // Other
            'help',
            'linkedin_apply',
            'schedule_task'
        ]);
    }

    parseCommands(commands: Array<{ type: string; params: Record<string, unknown> }>): ParsedCommand[] {
        const parsed: ParsedCommand[] = [];

        for (const cmd of commands) {
            if (this.validCommands.has(cmd.type)) {
                parsed.push({
                    type: cmd.type,
                    params: this.sanitizeParams(cmd.params)
                });
            } else {
                this.logger.warn(`Unknown command type: ${cmd.type}`);
            }
        }

        return parsed;
    }

    private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
        const sanitized: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                // Basic sanitization - prevent command injection for string params
                if (typeof value === 'string') {
                    // Remove potentially dangerous characters for system commands
                    sanitized[key] = value.replace(/[;&|`$]/g, '');
                } else {
                    sanitized[key] = value;
                }
            }
        }

        return sanitized;
    }

    // Parse manual command syntax (e.g., "/search pattern in directory")
    parseManualCommand(input: string): ParsedCommand | null {
        const trimmed = input.trim();

        if (!trimmed.startsWith('/')) {
            return null;
        }

        const parts = trimmed.slice(1).split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');

        switch (command) {
            case 'search':
                return {
                    type: 'file_search',
                    params: { pattern: args || '*', directory: '.', recursive: true },
                    raw: trimmed
                };

            case 'list':
            case 'ls':
            case 'dir':
                return {
                    type: 'dir_list',
                    params: { path: args || '.' },
                    raw: trimmed
                };

            case 'open':
                return {
                    type: 'browser_open',
                    params: { url: args },
                    raw: trimmed
                };

            case 'screenshot':
            case 'ss':
                return {
                    type: 'screenshot',
                    params: {},
                    raw: trimmed
                };

            case 'run':
            case 'exec':
                return {
                    type: 'system_run',
                    params: { command: args },
                    raw: trimmed
                };

            case 'app':
                return {
                    type: 'system_open_app',
                    params: { appName: args },
                    raw: trimmed
                };

            case 'info':
                return {
                    type: 'system_info',
                    params: { type: args || 'all' },
                    raw: trimmed
                };

            case 'help':
                return {
                    type: 'help',
                    params: {},
                    raw: trimmed
                };

            default:
                this.logger.warn(`Unknown manual command: ${command}`);
                return null;
        }
    }

    getHelpText(): string {
        return `
📚 **Clawdbot Commands**

*You can use natural language or these slash commands:*

**File Operations:**
• /search <pattern> - Search for files
• /list [path] - List directory contents
• /download <url> - Download a file

**Browser:**
• /open <url> - Open a website
• /screenshot - Take screen screenshot

**System:**
• /run <command> - Run system command
• /app <name> - Open an application
• /info [cpu|memory|disk] - System information

**Other:**
• /help - Show this help message

*Or just chat naturally! I'll understand what you want to do.*
`;
    }
}
