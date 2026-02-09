import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    WASocket,
    proto,
    downloadMediaMessage,
    getContentType
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { ClawdBot, MessageContext } from '../core/bot.js';
import { Logger } from '../utils/logger.js';
import { setQR, setConnected } from '../core/state.js';
import { getProfileManager } from '../core/profile.js';

export class WhatsAppInterface {
    private bot: ClawdBot;
    private sock: WASocket | null = null;
    private logger: Logger;
    private allowedNumbers: Set<string>;
    private isReady: boolean = false;
    private authFolder: string = '.baileys_auth';

    constructor(bot: ClawdBot) {
        this.bot = bot;
        this.logger = new Logger('WhatsApp');

        // Parse allowed numbers from env
        const numbersEnv = process.env.WHATSAPP_ALLOWED_NUMBERS || '';
        this.allowedNumbers = new Set(
            numbersEnv.split(',').map(n => n.trim()).filter(n => n)
        );
    }

    async start(): Promise<void> {
        this.logger.info('Starting WhatsApp interface (Baileys)...');
        await this.connectToWhatsApp();
    }

    private async connectToWhatsApp(): Promise<void> {
        // Load or create auth state
        const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);

        // Create socket with minimal logging
        this.sock = makeWASocket({
            auth: state,
            printQRInTerminal: false, // We'll handle QR ourselves
            logger: pino({ level: 'silent' }), // Suppress Baileys logs
            browser: ['Clawdbot', 'Chrome', '120.0.0'],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: undefined,
            keepAliveIntervalMs: 30000,
            markOnlineOnConnect: true,
        });

        // Handle connection updates
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Handle QR code
            if (qr) {
                this.logger.info('Scan this QR code with WhatsApp:');
                console.log('');
                qrcode.generate(qr, { small: true });
                console.log('');

                // Update shared state for web view
                setQR(qr);
                setConnected(false);
            }

            // Handle connection state
            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

                this.logger.warn('Connection closed:', lastDisconnect?.error?.message || 'Unknown reason');
                setConnected(false);
                this.isReady = false;

                if (shouldReconnect) {
                    this.logger.info('Reconnecting in 5 seconds...');
                    setTimeout(() => this.connectToWhatsApp(), 5000);
                } else {
                    this.logger.warn('Logged out. Delete .baileys_auth folder and restart to re-login.');
                }
            } else if (connection === 'open') {
                this.logger.success('WhatsApp connected and ready!');
                setQR(null);
                setConnected(true);
                this.isReady = true;
            }
        });

        // Save credentials when updated
        this.sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return;

            for (const message of messages) {
                await this.handleMessage(message);
            }
        });
    }

    private async handleMessage(message: proto.IWebMessageInfo): Promise<void> {
        try {
            // Ignore status updates and reactions
            if (!message.message || !message.key || message.key.remoteJid === 'status@broadcast') {
                return;
            }

            const jid = message.key.remoteJid!;
            const isFromMe = message.key.fromMe ?? false;
            const isGroup = jid.endsWith('@g.us');
            const profileManager = getProfileManager();

            // OWNER TAKEOVER: If owner sends a message, pause bot for this chat
            if (isFromMe) {
                profileManager.pauseForOwner(jid);
                this.logger.info(`Owner takeover: Bot paused for chat ${jid}`);
                return; // Don't process owner's own messages
            }

            // Check if bot is paused for this chat (owner is handling it)
            if (profileManager.isPausedForChat(jid)) {
                this.logger.debug(`Bot paused for chat ${jid}, skipping message`);
                return;
            }

            // Get message text
            let messageText = this.extractMessageText(message);
            if (!messageText) return;

            // Check if someone mentioned/tagged us in a group
            let isTagged = false;
            let hasTrigger = false;
            let commandText = messageText.trim();

            // Check for @mentions in the message
            const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length > 0 && this.sock) {
                // Get our own JID
                const myJid = this.sock.user?.id;
                if (myJid) {
                    const myNumber = myJid.split('@')[0].split(':')[0];
                    isTagged = mentionedJids.some(mentioned =>
                        mentioned.split('@')[0].includes(myNumber) || myNumber.includes(mentioned.split('@')[0])
                    );
                }
            }

            // Check for triggers: "bot:", "bot ", "!", "/"
            if (commandText.toLowerCase().startsWith('bot:') || commandText.toLowerCase().startsWith('bot ')) {
                const match = commandText.match(/^(bot\s*[:.\\-]?\s*)/i);
                if (match) {
                    commandText = commandText.substring(match[0].length).trim();
                    hasTrigger = true;
                }
            } else if (commandText.startsWith('!') || commandText.startsWith('/')) {
                commandText = commandText.substring(1).trim();
                hasTrigger = true;
            }

            // If tagged in a group, respond even without explicit trigger
            if (isTagged && isGroup && !hasTrigger) {
                // Remove the @mention from the text for processing
                commandText = messageText.replace(/@\d+/g, '').trim();
                hasTrigger = true;
                this.logger.info('Responding to @mention in group');
            }

            // STRICT: Trigger is mandatory for ALL messages (unless tagged)
            if (!hasTrigger) {
                return;
            }

            // Get sender info
            const senderJid = isFromMe ? jid : (message.key?.participant || jid);
            const senderNumber = senderJid.split('@')[0];

            // Check if number is allowed (if whitelist is configured)
            if (this.allowedNumbers.size > 0 && !isFromMe) {
                const isAllowed = Array.from(this.allowedNumbers).some(allowed =>
                    senderNumber.includes(allowed.replace(/\D/g, '')) ||
                    allowed.includes(senderNumber)
                );

                if (!isAllowed) {
                    this.logger.warn(`Blocked message from unauthorized number: ${senderNumber}`);
                    await this.sendMessage(jid, '⚠️ Sorry, you are not authorized to use this bot.');
                    return;
                }
            }

            // Get push name
            const pushName = message.pushName || senderNumber;

            this.logger.info(`Message from ${pushName}: ${commandText.substring(0, 50)}...`);

            const context: MessageContext = {
                source: 'whatsapp',
                senderId: senderJid,
                senderName: pushName,
                timestamp: new Date((message.messageTimestamp as number) * 1000)
            };

            // Show typing indicator
            await this.sock?.presenceSubscribe(jid);
            await this.sock?.sendPresenceUpdate('composing', jid);

            // Process the message
            const response = await this.bot.processMessage(commandText, context);

            // Clear typing indicator
            await this.sock?.sendPresenceUpdate('paused', jid);

            // Send text response (as reply)
            await this.sendMessage(jid, response.text, message);

            // Send image if available
            if (response.imageUrl) {
                try {
                    await this.sock?.sendMessage(jid, {
                        image: { url: response.imageUrl },
                        caption: 'Generated Image'
                    });
                } catch (err) {
                    this.logger.error(`Failed to send image:`, err);
                }
            }

            // Send attachments if any
            if (response.attachments && response.attachments.length > 0) {
                for (const attachment of response.attachments) {
                    try {
                        if (fs.existsSync(attachment)) {
                            const buffer = fs.readFileSync(attachment);
                            const filename = path.basename(attachment);
                            const mimetype = this.getMimeType(attachment);

                            await this.sock?.sendMessage(jid, {
                                document: buffer,
                                fileName: filename,
                                mimetype: mimetype
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
                const jid = message.key?.remoteJid;
                if (jid) {
                    await this.sendMessage(jid, '❌ Sorry, I encountered an error processing your request.');
                }
            } catch {
                // Ignore reply errors
            }
        }
    }

    private extractMessageText(message: proto.IWebMessageInfo): string | null {
        const msg = message.message;
        if (!msg) return null;

        // Handle different message types
        if (msg.conversation) {
            return msg.conversation;
        }
        if (msg.extendedTextMessage?.text) {
            return msg.extendedTextMessage.text;
        }
        if (msg.imageMessage?.caption) {
            return msg.imageMessage.caption;
        }
        if (msg.videoMessage?.caption) {
            return msg.videoMessage.caption;
        }
        if (msg.documentMessage?.caption) {
            return msg.documentMessage.caption;
        }

        return null;
    }

    private getMimeType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.txt': 'text/plain',
            '.zip': 'application/zip',
        };
        return mimeTypes[ext] || 'application/octet-stream';
    }

    async sendMessage(to: string, text: string, replyTo?: proto.IWebMessageInfo): Promise<void> {
        if (!this.sock || !this.isReady) {
            throw new Error('WhatsApp client is not ready');
        }

        // Ensure JID format
        const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;

        const options: any = { text };

        // Quote the original message if provided
        if (replyTo) {
            options.quoted = replyTo;
        }

        await this.sock.sendMessage(jid, options);
    }

    async stop(): Promise<void> {
        if (this.sock) {
            this.sock.end(undefined);
            this.sock = null;
        }
        this.isReady = false;
    }
}
