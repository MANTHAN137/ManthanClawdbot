import * as readline from 'readline';
import chalk from 'chalk';
import { ClawdBot, MessageContext } from '../core/bot.js';
import { CommandParser } from '../core/command-parser.js';
import { Logger } from '../utils/logger.js';

export class TerminalInterface {
    private bot: ClawdBot;
    private logger: Logger;
    private parser: CommandParser;
    private rl: readline.Interface | null = null;

    constructor(bot: ClawdBot) {
        this.bot = bot;
        this.logger = new Logger('Terminal');
        this.parser = new CommandParser();
    }

    async start(): Promise<void> {
        this.logger.info('Starting terminal interface...');

        // In non-interactive environments (like Docker/Render), don't start readline
        // unless explicitly needed, or handle close gracefully.
        if (!process.stdin.isTTY) {
            this.logger.info('Non-interactive environment detected. Terminal input disabled.');
            return;
        }

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        this.printWelcome();
        this.prompt();

        this.rl.on('line', async (input) => {
            await this.handleInput(input);
            this.prompt();
        });

        this.rl.on('close', () => {
            // Do NOT exit process here automatically.
            // Only log that terminal input is closed.
            // The process should stay alive for WhatsApp/other services.
            console.log('\n' + chalk.yellow('Terminal input closed.'));
        });
    }

    private printWelcome(): void {
        console.log('\n' + chalk.cyan('═'.repeat(50)));
        console.log(chalk.cyan.bold('  🤖 CLAWDBOT - Your PC Automation Assistant'));
        console.log(chalk.cyan('═'.repeat(50)));
        console.log(chalk.gray('  Type your command or chat naturally.'));
        console.log(chalk.gray('  Use /help for available commands.'));
        console.log(chalk.gray('  Press Ctrl+C to exit.\n'));
    }

    private prompt(): void {
        process.stdout.write(chalk.green('You: '));
    }

    private async handleInput(input: string): Promise<void> {
        const trimmed = input.trim();

        if (!trimmed) {
            return;
        }

        // Handle special commands
        if (trimmed.toLowerCase() === '/help') {
            console.log(chalk.cyan(this.parser.getHelpText()));
            return;
        }

        if (trimmed.toLowerCase() === '/exit' || trimmed.toLowerCase() === '/quit') {
            console.log(chalk.yellow('\nGoodbye! 👋'));
            process.exit(0);
        }

        if (trimmed.toLowerCase() === '/clear') {
            console.clear();
            this.printWelcome();
            return;
        }

        // Check for manual slash commands
        const manualCommand = this.parser.parseManualCommand(trimmed);
        if (manualCommand) {
            console.log(chalk.gray('Processing command...'));
        }

        // Process through bot
        const context: MessageContext = {
            source: 'terminal',
            senderId: 'local',
            senderName: 'You',
            timestamp: new Date()
        };

        try {
            console.log(chalk.gray('Thinking...'));
            const response = await this.bot.processMessage(trimmed, context);

            console.log('\n' + chalk.blue('Clawdbot: ') + this.formatResponse(response.text));

            if (response.attachments && response.attachments.length > 0) {
                console.log(chalk.yellow('\n📎 Attachments:'));
                for (const attachment of response.attachments) {
                    console.log(chalk.gray(`   ${attachment}`));
                }
            }
            console.log('');
        } catch (error) {
            console.log(chalk.red('\n❌ Error: ') + (error instanceof Error ? error.message : 'Unknown error'));
            console.log('');
        }
    }

    private formatResponse(text: string): string {
        // Apply some basic markdown-like formatting for terminal
        return text
            .replace(/\*\*(.+?)\*\*/g, chalk.bold('$1'))
            .replace(/`([^`]+)`/g, chalk.cyan('$1'))
            .replace(/^### (.+)$/gm, chalk.bold.underline('$1'))
            .replace(/^## (.+)$/gm, chalk.bold.yellow('$1'))
            .replace(/^# (.+)$/gm, chalk.bold.cyan('$1'));
    }

    stop(): void {
        if (this.rl) {
            this.rl.close();
        }
    }
}
