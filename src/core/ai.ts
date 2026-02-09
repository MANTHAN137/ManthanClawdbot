import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { Logger } from '../utils/logger.js';
import { getProfileManager } from './profile.js';
import { getLocalNLP } from './local-nlp.js';

export interface AIResponse {
    response: string;
    commands?: Array<{
        type: string;
        params: Record<string, unknown>;
    }>;
}

export class GeminiAI {
    private genAI: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;
    private logger: Logger;
    private systemPrompt: string = '';

    constructor() {
        this.logger = new Logger('GeminiAI');
    }

    async initialize(): Promise<void> {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not set. Using Local NLP only.');
            return;
        }

        try {
            const profileManager = getProfileManager();
            this.systemPrompt = profileManager.generateSystemPrompt();

            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({
                model: 'gemini-2.0-flash',
                generationConfig: {
                    temperature: 0.8,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 1024,
                }
            });

            this.logger.info('Gemini AI initialized (Model: gemini-2.0-flash)');
        } catch (error) {
            this.logger.error('Failed to initialize Gemini:', error);
        }
    }

    async processMessage(
        message: string,
        history: Array<{ role: string; content: string }>
    ): Promise<AIResponse> {
        const localNLP = getLocalNLP();

        // ============================================
        // STEP 1: LOCAL NLP FIRST (Works without API)
        // ============================================

        // Try LocalNLP for instant features (math, time, conversions, etc.)
        const localResult = localNLP.process(message);

        // If LocalNLP gave a definitive answer (not just a search redirect)
        if (localResult.commands.length === 0 && !localResult.response.includes('search')) {
            this.logger.info('LocalNLP handled the message');
            return localResult;
        }

        // If LocalNLP wants to do a search, return that
        if (localResult.commands.length > 0) {
            this.logger.info(`LocalNLP detected intent: ${localResult.commands[0].type}`);
            return localResult;
        }

        // ============================================
        // STEP 2: TRY GEMINI AI (If available)
        // ============================================

        if (this.model) {
            try {
                const contents: Content[] = [
                    { role: 'user', parts: [{ text: this.systemPrompt }] },
                    { role: 'model', parts: [{ text: 'Got it! Ready to respond.' }] }
                ];

                // Add conversation history
                for (const msg of history.slice(-6)) {
                    contents.push({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    });
                }

                contents.push({ role: 'user', parts: [{ text: message }] });

                const result = await this.model.generateContent({ contents });
                const responseText = result.response.text();

                // Try to parse JSON
                try {
                    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        if (parsed.response) {
                            return {
                                response: parsed.response,
                                commands: this.normalizeCommands(parsed.commands || [])
                            };
                        }
                    }
                } catch { }

                return { response: responseText, commands: [] };

            } catch (error: unknown) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                this.logger.warn('Gemini failed, using LocalNLP:', errorMsg);

                if (errorMsg.includes('429')) {
                    // Rate limited - use local response
                    return {
                        response: "⏳ Rate limited, but I got you! " + localResult.response,
                        commands: localResult.commands
                    };
                }
            }
        }

        // ============================================
        // STEP 3: FALLBACK TO LOCAL NLP
        // ============================================

        return localResult;
    }

    private normalizeCommands(commands: any[]): Array<{ type: string; params: Record<string, unknown> }> {
        if (!Array.isArray(commands)) return [];
        return commands.map(cmd => ({
            type: cmd.type || 'smart_search',
            params: cmd.params || {}
        }));
    }
}
