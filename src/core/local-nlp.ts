import { Logger } from '../utils/logger.js';
import { getProfileManager } from './profile.js';

/**
 * Local NLP Engine - Works WITHOUT any LLM API
 * Handles: intent detection, math, queries, and smart responses
 */
export class LocalNLP {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('LocalNLP');
    }

    /**
     * Process message completely locally without any API
     */
    process(message: string): { response: string; commands: any[] } {
        const input = message.trim();
        const lower = input.toLowerCase();

        this.logger.info(`Processing: "${input.substring(0, 50)}..."`);

        // 1. Math evaluation
        const mathResult = this.evaluateMath(input);
        if (mathResult !== null) {
            this.logger.info('Matched: Math expression');
            return { response: `🧮 = **${mathResult}**`, commands: [] };
        }

        // 2. Knowledge base matching (from profile)
        const kbAnswer = this.matchKnowledgeBase(lower);
        if (kbAnswer) {
            this.logger.info('Matched: Knowledge base');

            return { response: kbAnswer, commands: [] };
        }

        // 3. Common questions/answers
        const commonAnswer = this.matchCommonQuestions(lower);
        if (commonAnswer) {
            return commonAnswer;
        }

        // 4. Detect search intent and route
        const searchIntent = this.detectSearchIntent(lower, input);
        if (searchIntent) {
            return searchIntent;
        }

        // 5. Conversational responses
        const conversational = this.handleConversation(lower);
        if (conversational) {
            return conversational;
        }

        // 6. Default: Smart search
        if (input.split(' ').length >= 2) {
            return {
                response: "🔍 Let me search that for you!",
                commands: [{ type: 'smart_search', params: { query: input } }]
            };
        }

        // Final fallback
        const profile = getProfileManager().getProfile();
        return {
            response: profile?.botPersonality.fallbackMessage || "Hmm, not sure about that. Try asking differently? 🤔",
            commands: []
        };
    }

    /**
     * Evaluate mathematical expressions
     */
    private evaluateMath(input: string): number | null {
        // Check if it looks like a math expression
        if (!input.match(/^[\d\s\+\-\*\/\(\)\.\^%]+$/) &&
            !input.match(/^(what|calculate|solve|compute|eval)?\s*(is)?\s*[\d\s\+\-\*\/\(\)\.\^%]+/i)) {

            // Check for word-based math
            const wordMath = this.parseWordMath(input);
            if (wordMath) {
                input = wordMath;
            } else {
                return null;
            }
        }

        // Extract just the math part
        let expr = input.replace(/^(what|calculate|solve|compute|eval)?\s*(is)?\s*/i, '').trim();

        // Handle power/exponent
        expr = expr.replace(/\^/g, '**');
        expr = expr.replace(/(\d+)\s*\*\*\s*(\d+)/g, 'Math.pow($1,$2)');

        // Handle percentage
        expr = expr.replace(/(\d+)\s*%\s*of\s*(\d+)/gi, '($1/100)*$2');
        expr = expr.replace(/(\d+)%/g, '($1/100)');

        try {
            // Safe eval using Function constructor
            const result = new Function(`return ${expr}`)();
            if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
                return Math.round(result * 10000) / 10000; // Round to 4 decimals
            }
        } catch {
            return null;
        }
        return null;
    }

    /**
     * Parse word-based math like "two plus three"
     */
    private parseWordMath(input: string): string | null {
        const lower = input.toLowerCase();

        const numbers: Record<string, string> = {
            'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
            'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
            'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
            'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
            'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
            'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
            'eighty': '80', 'ninety': '90', 'hundred': '100', 'thousand': '1000'
        };

        const operators: Record<string, string> = {
            'plus': '+', 'add': '+', 'added': '+', 'and': '+',
            'minus': '-', 'subtract': '-', 'less': '-',
            'times': '*', 'multiply': '*', 'multiplied': '*', 'into': '*',
            'divided': '/', 'divide': '/', 'over': '/',
            'power': '**', 'raised': '**', 'to the': '**',
            'square': '**2', 'squared': '**2', 'cube': '**3', 'cubed': '**3'
        };

        // Check if contains math words
        const hasNumbers = Object.keys(numbers).some(n => lower.includes(n)) || /\d/.test(lower);
        const hasOperators = Object.keys(operators).some(o => lower.includes(o));

        if (!hasNumbers || !hasOperators) return null;

        let expr = lower;

        // Replace word numbers
        for (const [word, num] of Object.entries(numbers)) {
            expr = expr.replace(new RegExp(`\\b${word}\\b`, 'g'), num);
        }

        // Replace word operators
        for (const [word, op] of Object.entries(operators)) {
            expr = expr.replace(new RegExp(`\\b${word}\\b`, 'g'), ` ${op} `);
        }

        // Clean up
        expr = expr.replace(/what is|calculate|equals|equal|the|of/gi, '');
        expr = expr.replace(/[^\d\+\-\*\/\(\)\.\s\*]/g, '');
        expr = expr.replace(/\s+/g, ' ').trim();

        return expr || null;
    }

    /**
     * Match from knowledge base in profile
     */
    private matchKnowledgeBase(query: string): string | null {
        const profile = getProfileManager().getProfile();
        if (!profile?.knowledgeBase) return null;

        for (const kb of profile.knowledgeBase) {
            for (const pattern of kb.patterns) {
                if (query.includes(pattern.toLowerCase())) {
                    return kb.answer;
                }
            }
        }
        return null;
    }

    /**
     * Match common questions with pattern-based answers
     */
    private matchCommonQuestions(query: string): { response: string; commands: any[] } | null {
        // Time
        if (query.match(/\b(time|clock|what time)\b/)) {
            const now = new Date();
            const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            return { response: `🕐 It's **${time}**`, commands: [] };
        }

        // Date
        if (query.match(/\b(date|today|what day)\b/)) {
            const now = new Date();
            const date = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            return { response: `📅 Today is **${date}**`, commands: [] };
        }

        // Day of week
        if (query.match(/\b(which day|what day is|day of the week)\b/)) {
            const now = new Date();
            const day = now.toLocaleDateString('en-IN', { weekday: 'long' });
            return { response: `📆 It's **${day}**!`, commands: [] };
        }

        // Weather (redirect to search)
        if (query.match(/\b(weather|temperature|rain|sunny|forecast)\b/)) {
            return {
                response: "🌤️ Let me check the weather for you!",
                commands: [{ type: 'smart_search', params: { query: query } }]
            };
        }

        // Unit conversions
        const conversion = this.handleConversion(query);
        if (conversion) {
            return { response: conversion, commands: [] };
        }

        // Random number
        if (query.match(/\b(random number|pick a number|roll dice|flip coin)\b/)) {
            if (query.includes('dice')) {
                const roll = Math.floor(Math.random() * 6) + 1;
                return { response: `🎲 You rolled a **${roll}**!`, commands: [] };
            }
            if (query.includes('coin') || query.includes('flip')) {
                const result = Math.random() > 0.5 ? 'Heads' : 'Tails';
                return { response: `🪙 **${result}**!`, commands: [] };
            }
            const num = Math.floor(Math.random() * 100) + 1;
            return { response: `🎯 Random number: **${num}**`, commands: [] };
        }

        return null;
    }

    /**
     * Handle unit conversions
     */
    private handleConversion(query: string): string | null {
        // Temperature: C to F
        const celsiusMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:celsius|°c|c)\s*(?:to|in)\s*(?:fahrenheit|°f|f)/i);
        if (celsiusMatch) {
            const c = parseFloat(celsiusMatch[1]);
            const f = (c * 9 / 5) + 32;
            return `🌡️ ${c}°C = **${f.toFixed(1)}°F**`;
        }

        // Temperature: F to C
        const fahrenheitMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:fahrenheit|°f|f)\s*(?:to|in)\s*(?:celsius|°c|c)/i);
        if (fahrenheitMatch) {
            const f = parseFloat(fahrenheitMatch[1]);
            const c = (f - 32) * 5 / 9;
            return `🌡️ ${f}°F = **${c.toFixed(1)}°C**`;
        }

        // Distance: km to miles
        const kmMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:km|kilometer|kilometre)s?\s*(?:to|in)\s*(?:miles?|mi)/i);
        if (kmMatch) {
            const km = parseFloat(kmMatch[1]);
            const miles = km * 0.621371;
            return `📏 ${km} km = **${miles.toFixed(2)} miles**`;
        }

        // Distance: miles to km
        const milesMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:miles?|mi)\s*(?:to|in)\s*(?:km|kilometer|kilometre)s?/i);
        if (milesMatch) {
            const miles = parseFloat(milesMatch[1]);
            const km = miles * 1.60934;
            return `📏 ${miles} miles = **${km.toFixed(2)} km**`;
        }

        // Weight: kg to lbs
        const kgMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilogram|kilo)s?\s*(?:to|in)\s*(?:lbs?|pounds?)/i);
        if (kgMatch) {
            const kg = parseFloat(kgMatch[1]);
            const lbs = kg * 2.20462;
            return `⚖️ ${kg} kg = **${lbs.toFixed(2)} lbs**`;
        }

        // Currency: basic USD to INR
        const usdMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:usd|dollars?|\$)\s*(?:to|in)\s*(?:inr|rupees?|₹)/i);
        if (usdMatch) {
            const usd = parseFloat(usdMatch[1]);
            const inr = usd * 83; // Approximate rate
            return `💵 $${usd} ≈ **₹${inr.toFixed(2)}** (approx)`;
        }

        return null;
    }

    /**
     * Detect search intent and return appropriate command
     */
    private detectSearchIntent(lower: string, original: string): { response: string; commands: any[] } | null {
        // Sports/Scores
        if (lower.match(/\b(score|match|vs|cricket|football|ipl|t20|live|world cup|playing)\b/)) {
            return {
                response: "🏏 Getting the latest scores!",
                commands: [{ type: 'sports_search', params: { query: original } }]
            };
        }

        // News
        if (lower.match(/\b(news|latest|breaking|headlines|update)\b/)) {
            const query = original.replace(/\b(news|latest|breaking|headlines)\b/gi, '').trim() || 'trending';
            return {
                response: "📰 Here's the latest!",
                commands: [{ type: 'news_search', params: { query } }]
            };
        }

        // Person/Who is
        if (lower.match(/^(who is|about|biography|wiki)\b/)) {
            const query = original.replace(/^(who is|about|biography|wiki)\s*/i, '').trim();
            return {
                response: `👤 Let me tell you about ${query}!`,
                commands: [{ type: 'person_search', params: { query } }]
            };
        }

        // Music
        if (lower.match(/\b(song|music|play|listen|album|singer|lyrics|spotify)\b/)) {
            return {
                response: "🎵 Finding music!",
                commands: [{ type: 'music_search', params: { query: original } }]
            };
        }

        // Movie
        if (lower.match(/\b(movie|film|watch|series|show|netflix|prime|imdb)\b/)) {
            return {
                response: "🎬 Let me find that!",
                commands: [{ type: 'movie_search', params: { query: original } }]
            };
        }

        // Video/YouTube
        if (lower.match(/\b(video|youtube|tutorial|how to|watch how)\b/)) {
            return {
                response: "▶️ Found videos!",
                commands: [{ type: 'youtube_search', params: { query: original } }]
            };
        }

        // Shopping
        if (lower.match(/\b(buy|price|amazon|flipkart|shop|order|cost|cheap)\b/)) {
            return {
                response: "🛒 Checking prices!",
                commands: [{ type: 'amazon_search', params: { query: original } }]
            };
        }

        // Location
        if (lower.match(/\b(location|map|direction|where is|near me|restaurant|hotel|address)\b/)) {
            return {
                response: "📍 Finding location!",
                commands: [{ type: 'location_search', params: { query: original } }]
            };
        }

        // Games
        if (lower.match(/\b(game|gameplay|steam|gaming|xbox|playstation|pc game)\b/)) {
            return {
                response: "🎮 Gaming info!",
                commands: [{ type: 'game_search', params: { query: original } }]
            };
        }

        // Images
        if (lower.match(/\b(image|photo|picture|wallpaper|pic of)\b/)) {
            return {
                response: "📸 Finding images!",
                commands: [{ type: 'image_search', params: { query: original } }]
            };
        }

        // General search triggers
        if (lower.match(/^(what|when|where|why|how|search|find|google|tell me|explain)\b/)) {
            return {
                response: "🔍 Searching...",
                commands: [{ type: 'smart_search', params: { query: original } }]
            };
        }

        return null;
    }

    /**
     * Handle conversational messages
     */
    private handleConversation(lower: string): { response: string; commands: any[] } | null {
        const profile = getProfileManager().getProfile();

        // Greetings
        if (lower.match(/^(hi|hello|hey|yo|sup|hii+|hola|wassup|namaste|kem cho|good morning|good evening|good afternoon)$/)) {
            return {
                response: profile?.quickResponses.greeting || profile?.botPersonality.greeting || "Hey! 👋",
                commands: []
            };
        }

        // Thanks
        if (lower.match(/\b(thank|thanks|thx|thnx|ty|shukriya|dhanyawad)\b/)) {
            return {
                response: profile?.quickResponses.thanks || "You're welcome! 😊",
                commands: []
            };
        }

        // Goodbye
        if (lower.match(/^(bye|goodbye|see you|cya|later|tata|alvida|good night|gn|tc|take care)$/)) {
            return {
                response: profile?.quickResponses.goodbye || "Take care! 👋",
                commands: []
            };
        }

        // How are you
        if (lower.match(/\b(how are you|how r u|kaise ho|kya hal|what's up|howdy)\b/)) {
            const responses = [
                "All good! Coding as usual 💻 What's up?",
                "Doing great! You? 😊",
                "Sab badhiya! Tell me what you need!",
                "Living the dream! 🔥 How can I help?"
            ];
            return { response: responses[Math.floor(Math.random() * responses.length)], commands: [] };
        }

        // Who are you
        if (lower.match(/\b(who are you|your name|what are you)\b/)) {
            const name = profile?.profile.name || 'Owner';
            return {
                response: `I'm ${name}'s personal bot! 🤖 I help answer messages, search stuff, and keep things running. Ask me anything!`,
                commands: []
            };
        }

        // Jokes
        if (lower.match(/\b(joke|funny|make me laugh)\b/)) {
            const jokes = [
                "Why don't scientists trust atoms? Because they make up everything! 🤣",
                "I told my wifi we need to talk. It's been disconnecting ever since 😂",
                "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
                "What's a computer's favorite snack? Microchips! 🍟",
                "Why was the JavaScript developer sad? Because he didn't Node how to Express himself! 😅"
            ];
            return { response: jokes[Math.floor(Math.random() * jokes.length)], commands: [] };
        }

        // Help
        if (lower === 'help' || lower === '/help' || lower.match(/what can you do/)) {
            return {
                response: `🤖 **What I can do:**

🔍 **Search:** Just ask anything!
🏏 **Sports:** "IPL score", "India vs Aus"
📰 **News:** "Tech news", "Latest headlines"
🎬 **Entertainment:** "Movies", "Songs", "Videos"
🛒 **Shopping:** "iPhone price", "Buy laptop"
🧮 **Math:** "25 * 4", "100 + 50"
🌡️ **Convert:** "30c to f", "5km to miles"
📅 **Info:** "What time", "Today's date"

Just ask! I'll figure it out 😄`,
                commands: []
            };
        }

        // Compliments
        if (lower.match(/\b(awesome|great|good bot|nice|thanks|amazing|love you|best)\b/)) {
            const responses = [
                "Thanks! You're awesome too! 🙌",
                "Haha glad I could help! 😊",
                "You're making me blush! 🥰",
                "That means a lot! Keep the questions coming! 🔥"
            ];
            return { response: responses[Math.floor(Math.random() * responses.length)], commands: [] };
        }

        return null;
    }
}

// Singleton
let localNLPInstance: LocalNLP | null = null;

export function getLocalNLP(): LocalNLP {
    if (!localNLPInstance) {
        localNLPInstance = new LocalNLP();
    }
    return localNLPInstance;
}
