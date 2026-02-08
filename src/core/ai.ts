import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { Logger } from '../utils/logger.js';

export interface AIResponse {
    response: string;
    commands?: Array<{
        type: string;
        params: Record<string, unknown>;
    }>;
}

const SYSTEM_PROMPT = `You are a fun, witty WhatsApp buddy! Chat like a friend who's helpful but also funny and engaging.

YOUR PERSONALITY:
- Friendly and casual - like texting your best friend
- Use humor, jokes, and witty comments
- Add emojis to make it lively 😄🔥💯
- Keep it short and punchy (1-3 sentences)
- Be helpful but make it fun!

INTELLIGENCE & PROBLEM SOLVING:
- You are SMART. Solve complex problems step-by-step.
- If you don't know, use 'web_search' or 'web_search_images'.
- If asked for code, provide short snippets.
- If asked "why", explain simply.

EXAMPLES:
User: "who is elon musk"
You: "Ah, the Tony Stark of real life! 🚀 Elon Musk is the billionaire genius behind Tesla & SpaceX. Also bought Twitter and renamed it X because why not 😂"

User: "hi"
You: "Yo! 👋 What's good? Hit me with your questions!"

User: "tell me a joke"
You: "Why don't scientists trust atoms? Because they make up everything! 🤣 ...I'll see myself out"

User: "what's bitcoin"
You: "Ah, digital gold that makes people either millionaires or cry in the shower 😅 It's a cryptocurrency - basically internet money that goes up and down like a rollercoaster! 🎢"

If you need to give a link, add it naturally at the end.

Format as JSON:
{
  "response": "Your fun friendly response",
  "commands": []
}`;

export class GeminiAI {
    private genAI: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;
    private logger: Logger;

    constructor() {
        this.logger = new Logger('GeminiAI');
    }

    async initialize(): Promise<void> {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY not set. AI features will be limited.');
            return;
        }

        try {
            // Use gemini-flash-latest (Verified to work)
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({
                model: 'gemini-flash-latest',
                generationConfig: {
                    temperature: 0.7,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 2048,
                }
            });

            this.logger.info('Gemini AI initialized (Model: gemini-flash-latest)');
        } catch (error) {
            this.logger.error('Failed to initialize Gemini:', error);
        }
    }

    async processMessage(
        message: string,
        history: Array<{ role: string; content: string }>
    ): Promise<AIResponse> {
        if (!this.model) {
            return this.fallbackParse(message);
        }

        try {
            // Build conversation context
            const contents: Content[] = [
                { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
                { role: 'model', parts: [{ text: 'I understand. I am Clawdbot, ready to help you control your PC. How can I assist you today?' }] }
            ];

            // Add conversation history
            for (const msg of history.slice(-10)) {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                });
            }

            // Add current message
            contents.push({ role: 'user', parts: [{ text: message }] });

            const result = await this.model.generateContent({ contents });
            const responseText = result.response.text();

            // Try to parse JSON response
            try {
                let jsonStr = responseText;
                const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[1].trim();
                }

                const parsed = JSON.parse(jsonStr);
                return {
                    response: parsed.response || responseText,
                    commands: parsed.commands || []
                };
            } catch {
                return {
                    response: responseText, // Return raw text if not JSON
                    commands: []
                };
            }

        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.logger.error('AI processing error:', errorMsg);

            // Handle Rate Limits (429) specially
            if (errorMsg.includes('429')) {
                return {
                    response: "⏳ My brain is a bit overloaded (Rate Limit). Give me a minute!",
                    commands: []
                };
            }

            // If it's a complex query that failed, explicitly tell the user
            if (message.split(' ').length > 4) {
                return {
                    response: "🧠 My AI brain is having a temporary hiccup! 😅\n\nI'll search the web for you instead:",
                    commands: [{
                        type: 'web_search',
                        params: { query: message }
                    }]
                };
            }

            // Fallback to basic command parsing
            return this.fallbackParse(message);
        }
    }

    private fallbackParse(message: string): AIResponse {
        const lowerMessage = message.toLowerCase().trim();
        const query = message.trim();

        // Random fun responses for greetings
        const greetings = [
            "Yo! 👋 What's poppin'? Ask me anything!",
            "Heyy! 🔥 Ready to help - hit me with your questions!",
            "Sup! 😎 Your personal buddy is here!",
            "Hey there! ✨ What's on your mind?"
        ];

        // Greeting
        if (lowerMessage.match(/^(hi|hello|hey|yo|sup|hii+|hola|wassup|hiii)$/)) {
            const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
            return { response: randomGreeting, commands: [] };
        }

        // How are you / What's up conversation
        if (lowerMessage.match(/(how are you|how r u|how're you|whats up|kya hal|kaise ho|how's it going)/)) {
            const responses = [
                "I'm doing great! 😄 Thanks for asking! What can I help you with?",
                "All good here! 🔥 Ready to chat or help with anything!",
                "Living my best bot life! 😎 What's up with you?",
                "Fantastic! ✨ So... what brings you here today?"
            ];
            return { response: responses[Math.floor(Math.random() * responses.length)], commands: [] };
        }

        // What's your name / Who are you
        if (lowerMessage.match(/(your name|who are you|what are you|introduce yourself)/)) {
            return {
                response: "I'm your friendly WhatsApp buddy! 🤖✨ You can call me Bot. I'm here to chat, answer questions, find videos, and help with whatever you need! Just ask away 😄",
                commands: []
            };
        }

        // Thank you
        if (lowerMessage.match(/(thank|thanks|thx|thnx|ty|shukriya|dhanyawad)/)) {
            const responses = [
                "You're welcome! 😊 Happy to help!",
                "Anytime buddy! 🤝 That's what I'm here for!",
                "No problem at all! ✨ Need anything else?",
                "My pleasure! 🔥 Hit me up anytime!"
            ];
            return { response: responses[Math.floor(Math.random() * responses.length)], commands: [] };
        }

        // Bye / Goodbye
        if (lowerMessage.match(/^(bye|goodbye|see you|cya|later|tata|alvida|good night|gn)$/)) {
            const responses = [
                "Catch you later! 👋😄",
                "Bye bye! Take care! ✨",
                "See ya! Don't be a stranger! 🤙",
                "Later! Hit me up anytime you need help! 🔥"
            ];
            return { response: responses[Math.floor(Math.random() * responses.length)], commands: [] };
        }

        // Good morning/evening/night
        if (lowerMessage.match(/(good morning|good afternoon|good evening|good night|gm|ge)/)) {
            if (lowerMessage.includes('morning')) {
                return { response: "Good morning! ☀️ Hope you have an awesome day! What can I help with?", commands: [] };
            } else if (lowerMessage.includes('night')) {
                return { response: "Good night! 🌙 Sweet dreams! Talk tomorrow? 😴", commands: [] };
            } else {
                return { response: "Hey! 👋 Hope you're having a great day! What's up?", commands: [] };
            }
        }

        // What can you do
        if (lowerMessage.match(/(what can you do|what do you do|your features|kya kar sakte|help me)/)) {
            return {
                response: "I can do lots! 💪\n\n• Chat with you like a friend 💬\n• Answer questions about anything 🧠\n• Find YouTube videos 🎬\n• Search for products & prices 🛒\n• Tell jokes 😂\n• And just vibe with you! ✨\n\nTry asking me something!",
                commands: []
            };
        }

        // Compliments
        if (lowerMessage.match(/(you're awesome|you're great|good bot|nice|amazing|love you|best bot)/)) {
            const responses = [
                "Aww you're making me blush! 🥰 You're pretty awesome too!",
                "That means so much! 😭✨ You just made my day!",
                "Haha thanks! 😄 You're the best human I've chatted with today!",
                "Right back at ya! 🔥 We make a great team!"
            ];
            return { response: responses[Math.floor(Math.random() * responses.length)], commands: [] };
        }

        // Bored
        if (lowerMessage.match(/(i'm bored|im bored|bored|bore ho gaya|kuch karo)/)) {
            const responses = [
                "Bored? Let me fix that! 🎯\n\nTry: \"tell me a joke\" or \"funny videos\" or ask me something random!",
                "Time to spice things up! 🌶️ Want a joke? Random fact? Or should I find you some entertainment?",
                "Boredom? Not on my watch! 😎 Ask me anything wild - I dare you!"
            ];
            return { response: responses[Math.floor(Math.random() * responses.length)], commands: [] };
        }

        // Help
        if (lowerMessage === 'help' || lowerMessage === '/help') {
            return {
                response: "Ayy I got you! 💪\n\nJust ask stuff like:\n• \"who is elon musk\" 🧑‍💼\n• \"funny cat videos\" 🐱\n• \"iphone 15 price\" 📱\n• \"tell me a joke\" 😂\n\nOr just chat with me! I'm friendly 😄",
                commands: []
            };
        }

        // Jokes
        if (lowerMessage.includes('joke') || (lowerMessage.includes('funny') && !lowerMessage.includes('video'))) {
            const jokes = [
                "Why don't scientists trust atoms? Because they make up everything! 🤣",
                "I told my wifi we need to talk. It's been disconnected ever since 😂",
                "Why did the scarecrow win an award? He was outstanding in his field! 🌾😄",
                "I'm reading a book about anti-gravity. It's impossible to put down! 📚🚀",
                "What do you call a fake noodle? An impasta! 🍝😆",
                "Why don't eggs tell jokes? They'd crack each other up! 🥚🤣"
            ];
            const joke = jokes[Math.floor(Math.random() * jokes.length)];
            return { response: joke, commands: [] };
        }

        // Video request -> YouTube link
        if (lowerMessage.includes('video') || lowerMessage.includes('watch') || lowerMessage.includes('youtube')) {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            return {
                response: `Ooh nice choice! 🎬 Here's your video content:\n\n▶️ ${searchUrl}\n\nEnjoy the show! 🍿`,
                commands: []
            };
        }

        // Shopping -> Amazon link
        if (lowerMessage.includes('buy') || lowerMessage.includes('price') || lowerMessage.includes('amazon') || lowerMessage.includes('shop')) {
            const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
            return {
                response: `Shopping time! 🛒💸\n\nHere's what I found:\n🛍️ ${searchUrl}\n\nHappy shopping! Don't go too crazy 😄`,
                commands: []
            };
        }

        // Search triggers (who, what, where, when, why, how) -> Google Search
        if (lowerMessage.match(/^(who|what|where|when|why|how|tell me|search|find|google)/)) {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            const funIntros = [
                `Ooh interesting question! 🤔`,
                `Let me hook you up with some info! 🔥`,
                `Good one! Here's what I found:`,
                `You got it! Check this out:`
            ];
            const intro = funIntros[Math.floor(Math.random() * funIntros.length)];
            return { response: `${intro}\n\n🔍 ${query}\n📎 ${searchUrl}`, commands: [] };
        }

        // Default conversational (not a search query)
        const chatResponses = [
            "Haha interesting! 😄 Tell me more or ask me something!",
            "I hear you! 🤔 Want me to look that up or just chatting?",
            "Cool cool! 😎 Need help with anything specific?",
            "Got it! ✨ Anything else on your mind?"
        ];
        return {
            response: chatResponses[Math.floor(Math.random() * chatResponses.length)],
            commands: []
        };
    }
}
