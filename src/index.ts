import 'dotenv/config';
import { ClawdBot } from './core/bot.js';
import { TerminalInterface } from './interfaces/terminal.js';
import { WhatsAppInterface } from './interfaces/whatsapp.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('Main');

async function main() {
    logger.info('🤖 Starting Clawdbot...');

    try {
        // Initialize the main bot
        const bot = new ClawdBot();
        await bot.initialize();

        // Start Terminal Interface (always enabled)
        const terminal = new TerminalInterface(bot);
        await terminal.start();

        // Start WhatsApp Interface if enabled
        if (process.env.WHATSAPP_ENABLED === 'true') {
            const whatsapp = new WhatsAppInterface(bot);
            await whatsapp.start();
        }

        logger.info('✅ Clawdbot is ready!');
        logger.info('📱 Send commands via WhatsApp or type in terminal');

        // Graceful shutdown
        process.on('SIGINT', async () => {
            logger.info('Shutting down...');
            await bot.shutdown();
            process.exit(0);
        });

    } catch (error) {
        logger.error('Failed to start Clawdbot:', error);
        process.exit(1);
    }
}

main();
