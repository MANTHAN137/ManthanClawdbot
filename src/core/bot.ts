import { GeminiAI } from './ai.js';
import { CommandParser, ParsedCommand } from './command-parser.js';
import { TaskExecutor } from './task-executor.js';
import { Logger } from '../utils/logger.js';

export interface MessageContext {
    source: 'whatsapp' | 'gmail' | 'terminal';
    senderId: string;
    senderName?: string;
    timestamp: Date;
}

export interface BotResponse {
    text: string;
    attachments?: string[];
    imageUrl?: string;
    error?: boolean;
}

export class ClawdBot {
    private ai: GeminiAI;
    private parser: CommandParser;
    private executor: TaskExecutor;
    private logger: Logger;
    private conversationHistory: Map<string, Array<{ role: string; content: string }>>;

    constructor() {
        this.logger = new Logger('ClawdBot');
        this.ai = new GeminiAI();
        this.parser = new CommandParser();
        this.executor = new TaskExecutor();
        this.conversationHistory = new Map();
    }

    async initialize(): Promise<void> {
        this.logger.info('Initializing Clawdbot core...');
        await this.ai.initialize();
        await this.executor.initialize();
        this.logger.info('Core initialized successfully');
    }

    async processMessage(message: string, context: MessageContext): Promise<BotResponse> {
        this.logger.info(`Processing message from ${context.source}: ${message.substring(0, 50)}...`);

        try {
            // Get conversation history for this sender
            const history = this.getConversationHistory(context.senderId);

            // Use AI to understand the message and determine action
            const aiResponse = await this.ai.processMessage(message, history);

            // Parse the AI response to extract any commands
            const commands = this.parser.parseCommands(aiResponse.commands || []);

            // Execute any commands
            let executionResults: string[] = [];
            let attachments: string[] = [];
            let imageUrl: string | undefined;

            for (const command of commands) {
                const result = await this.executor.execute(command);
                if (result.output) {
                    executionResults.push(result.output);
                }
                if (result.attachments) {
                    attachments.push(...result.attachments);
                }
                if (result.imageUrl) {
                    imageUrl = result.imageUrl;
                }
            }

            // Update conversation history
            this.addToHistory(context.senderId, 'user', message);
            this.addToHistory(context.senderId, 'assistant', aiResponse.response);

            // Combine AI response with execution results
            let finalResponse = aiResponse.response;
            if (executionResults.length > 0) {
                finalResponse += '\n\n📋 **Results:**\n' + executionResults.join('\n');
            }

            return {
                text: finalResponse,
                attachments: attachments.length > 0 ? attachments : undefined,
                imageUrl
            };

        } catch (error) {
            this.logger.error('Error processing message:', error);
            return {
                text: `❌ Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                error: true
            };
        }
    }

    private getConversationHistory(senderId: string): Array<{ role: string; content: string }> {
        return this.conversationHistory.get(senderId) || [];
    }

    private addToHistory(senderId: string, role: string, content: string): void {
        if (!this.conversationHistory.has(senderId)) {
            this.conversationHistory.set(senderId, []);
        }
        const history = this.conversationHistory.get(senderId)!;
        history.push({ role, content });

        // Keep only last 20 messages per conversation
        if (history.length > 20) {
            history.splice(0, history.length - 20);
        }
    }

    async shutdown(): Promise<void> {
        this.logger.info('Shutting down Clawdbot...');
        await this.executor.shutdown();
    }
}
