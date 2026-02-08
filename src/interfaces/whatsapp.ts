import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import * as fs from 'fs';
import * as path from 'path';
import { ClawdBot, MessageContext } from '../core/bot.js';
import { Logger } from '../utils/logger.js';

export class WhatsAppInterface {
    private bot: ClawdBot;
    private client: InstanceType<typeof Client>;
    private logger: Logger;
    private allowedNumbers: Set<string>;
    private isReady: boolean = false;

    constructor(bot: ClawdBot) {
        this.bot = bot;
        this.logger = new Logger('WhatsApp');

        // Parse allowed numbers from env
        const numbersEnv = process.env.WHATSAPP_ALLOWED_NUMBERS || '';
        this.allowedNumbers = new Set(
            numbersEnv.split(',').map(n => n.trim()).filter(n => n)
        );

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: '.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            }
        });

        this.setupEventHandlers();
    }

    private setupEventHandlers(): void {
        this.client.on('qr', (qr) => {
            this.logger.info('Scan this QR code with WhatsApp:');
            console.log('');
            qrcode.generate(qr, { small: true });
            console.log('');
        });

        this.client.on('ready', () => {
            this.isReady = true;
            this.logger.success('WhatsApp connected and ready!');
        });

        this.client.on('authenticated', () => {
            this.logger.success('WhatsApp authenticated');
        });

        this.client.on('auth_failure', (msg) => {
            this.logger.error('WhatsApp authentication failed:', msg);
        });

        this.client.on('disconnected', (reason) => {
            this.isReady = false;
            this.logger.warn('WhatsApp disconnected:', reason);
        });

        this.client.on('message', async (message) => {
            await this.handleMessage(message);
        });

        // Also listen to messages YOU send (outgoing) - for single account usage
        this.client.on('message_create', async (message) => {
            // Only process messages from yourself (outgoing messages)
            if (message.fromMe) {
                await this.handleMessage(message, true);
            }
        });
    }

    private async handleMessage(message: any, isFromMe: boolean = false): Promise<void> {
        try {
            // Ignore status updates
            if (message.isStatus) {
                return;
            }

            // For outgoing messages (from yourself), check if it starts with Bot:
            if (isFromMe) {
                const body = message.body.toLowerCase().trim();

                // STRICT: Only respond if starts with "bot:" or "bot " or "!" or "/"
                if (!body.startsWith('bot:') && !body.startsWith('bot ') && !body.startsWith('!') && !body.startsWith('/')) {
                    return; // Ignore - no trigger
                }

                // Remove the prefix for processing
                let commandText = message.body.trim();

                // Remove "bot" prefix
                const match = commandText.match(/^(bot\s*[:.\-]?\s*)/i);
                if (match) {
                    commandText = commandText.substring(match[0].length).trim();
                } else if (commandText.startsWith('!') || commandText.startsWith('/')) {
                    commandText = commandText.substring(1).trim();
                }

                message.body = commandText;
            }

            // For incoming messages (not from you)
            if (!isFromMe) {
                let commandText = message.body.trim();
                const isGroup = message.isGroupMsg;

                // Check for trigger
                let hasTrigger = false;

                // Check "!" or "/"
                if (commandText.startsWith('!') || commandText.startsWith('/')) {
                    commandText = commandText.substring(1).trim();
                    hasTrigger = true;
                }
                // Check "bot" prefix (robust)
                else {
                    const match = commandText.match(/^(bot\s*[:.\-]?\s*)/i);
                    if (match) {
                        commandText = commandText.substring(match[0].length).trim();
                        hasTrigger = true;
                    }
                }

                // STRICT: Trigger is mandatory for ALL chats (private + groups)
                if (!hasTrigger) {
                    return; // Ignore messages without trigger
                }

                message.body = commandText;
            }

            const contact = await message.getContact();
            const senderId = contact.id._serialized;
            const senderNumber = contact.number;

            // Check if number is allowed (if whitelist is configured)
            if (this.allowedNumbers.size > 0) {
                const isAllowed = Array.from(this.allowedNumbers).some(allowed =>
                    senderNumber.includes(allowed.replace(/\D/g, '')) ||
                    allowed.includes(senderNumber)
                );

                if (!isAllowed) {
                    this.logger.warn(`Blocked message from unauthorized number: ${senderNumber}`);
                    await message.reply('⚠️ Sorry, you are not authorized to use this bot.');
                    return;
                }
            }

            this.logger.info(`Message from ${contact.pushname || senderNumber}: ${message.body.substring(0, 50)}...`);

            const context: MessageContext = {
                source: 'whatsapp',
                senderId: senderId,
                senderName: contact.pushname || contact.name || senderNumber,
                timestamp: new Date(message.timestamp * 1000)
            };

            // Show typing indicator
            const chat = await message.getChat();
            await chat.sendStateTyping();

            // Process the message
            const response = await this.bot.processMessage(message.body, context);

            // Clear typing indicator
            await chat.clearState();

            // Send text response
            await message.reply(response.text);

            // Send image if available
            if (response.imageUrl) {
                try {
                    // Create media from URL
                    const media = await MessageMedia.fromUrl(response.imageUrl, { unsafeMime: true });
                    // Send as a separate message
                    await this.client.sendMessage(senderId, media);
                } catch (err) {
                    this.logger.error(`Failed to send image from URL ${response.imageUrl}:`, err);
                    // Just log error, user still got text response
                }
            }

            // Send attachments if any
            if (response.attachments && response.attachments.length > 0) {
                for (const attachment of response.attachments) {
                    try {
                        if (fs.existsSync(attachment)) {
                            const media = MessageMedia.fromFilePath(attachment);
                            await this.client.sendMessage(senderId, media, {
                                caption: path.basename(attachment)
                            });
                        }
                    } catch (err) {
                        this.logger.error(`Failed to send attachment ${attachment}:`, err);
                    }
                }
            }

        } catch (error) {
            this.logger.error('Error handling message:', error);
            try {
                await message.reply('❌ Sorry, I encountered an error processing your request.');
            } catch {
                // Ignore reply errors
            }
        }
    }

    async start(): Promise<void> {
        this.logger.info('Starting WhatsApp interface...');
        await this.client.initialize();
    }

    async stop(): Promise<void> {
        if (this.isReady) {
            await this.client.destroy();
        }
    }

    async sendMessage(to: string, text: string): Promise<void> {
        if (!this.isReady) {
            throw new Error('WhatsApp client is not ready');
        }

        // Ensure number format
        const chatId = to.includes('@') ? to : `${to.replace(/\D/g, '')}@c.us`;
        await this.client.sendMessage(chatId, text);
    }
}
