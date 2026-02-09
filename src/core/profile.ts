import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger.js';

export interface OwnerProfile {
    profile: {
        name: string;
        role: string;
        tagline: string;
        description: string;
        location: {
            city: string;
            state: string;
            country: string;
        };
        contact: {
            phone: string;
            youtube?: string;
            instagram?: string;
        };
        details: {
            birthDate: string;
            zodiac: string;
        };
    };
    background: {
        education: string;
        currentWork: {
            role: string;
            domain: string;
            company: string;
            technologies: string[];
            focus: string[];
        };
        skills: {
            technical: string[];
            research: string[];
        };
    };
    interests: {
        professional: string[];
        creative: string[];
        personal: string[];
    };
    personality: {
        traits: string[];
        values: string[];
        workStyle: string;
    };
    botPersonality: {
        name: string;
        tone: string;
        language: string;
        style: string;
        greeting: string;
        awayMessage: string;
        fallbackMessage: string;
    };
    knowledgeBase: Array<{
        patterns: string[];
        answer: string;
    }>;
    festivals: Array<{
        name: string;
        date?: string;
        greeting: string;
    }>;
    quickResponses: {
        greeting: string;
        goodbye: string;
        thanks: string;
        humanRequest: string;
    };
    ownerTakeover: {
        enabled: boolean;
        pauseDurationSeconds: number;
        description: string;
    };
    alertSettings: {
        enabled: boolean;
        ownerWhatsAppAlerts: boolean;
    };
}

export class ProfileManager {
    private logger: Logger;
    private profile: OwnerProfile | null = null;
    private profilePath: string;
    private pausedChats: Map<string, number> = new Map(); // chatId -> resumeTime

    constructor() {
        this.logger = new Logger('ProfileManager');
        this.profilePath = path.join(process.cwd(), 'owner-profile.json');
        this.loadProfile();
    }

    private loadProfile(): void {
        try {
            if (fs.existsSync(this.profilePath)) {
                const data = fs.readFileSync(this.profilePath, 'utf-8');
                this.profile = JSON.parse(data) as OwnerProfile;
                this.logger.info(`Loaded owner profile: ${this.profile.profile.name}`);
            } else {
                this.logger.warn('Owner profile not found at:', this.profilePath);
            }
        } catch (error) {
            this.logger.error('Failed to load owner profile:', error);
        }
    }

    getProfile(): OwnerProfile | null {
        return this.profile;
    }

    getOwnerName(): string {
        return this.profile?.profile.name || 'Owner';
    }

    getNickname(): string {
        return this.profile?.botPersonality.name || this.getOwnerName();
    }

    getOwnerPhone(): string {
        return this.profile?.profile.contact.phone || '';
    }

    // Check if today is a festival
    getTodaysFestivalGreeting(): string | null {
        if (!this.profile?.festivals) return null;

        const today = new Date();
        const monthDay = `${today.getDate()} ${today.toLocaleString('en-US', { month: 'long' })}`;

        for (const festival of this.profile.festivals) {
            if (festival.date && festival.date.toLowerCase().includes(monthDay.toLowerCase())) {
                return festival.greeting;
            }
        }
        return null;
    }

    // Smart pattern matching from knowledge base
    matchKnowledge(query: string): string | null {
        if (!this.profile?.knowledgeBase) return null;

        const lowerQuery = query.toLowerCase();

        for (const kb of this.profile.knowledgeBase) {
            for (const pattern of kb.patterns) {
                if (lowerQuery.includes(pattern.toLowerCase())) {
                    return kb.answer;
                }
            }
        }
        return null;
    }

    // Get quick response
    getQuickResponse(type: 'greeting' | 'goodbye' | 'thanks' | 'humanRequest'): string {
        return this.profile?.quickResponses[type] || '';
    }

    // Owner takeover: pause bot for a chat
    pauseForOwner(chatId: string): void {
        if (!this.profile?.ownerTakeover.enabled) return;

        const pauseDuration = (this.profile.ownerTakeover.pauseDurationSeconds || 300) * 1000;
        const resumeTime = Date.now() + pauseDuration;
        this.pausedChats.set(chatId, resumeTime);
        this.logger.info(`Bot paused for chat ${chatId} until ${new Date(resumeTime).toLocaleTimeString()}`);
    }

    // Check if bot is paused for a chat
    isPausedForChat(chatId: string): boolean {
        const resumeTime = this.pausedChats.get(chatId);
        if (!resumeTime) return false;

        if (Date.now() > resumeTime) {
            this.pausedChats.delete(chatId);
            return false;
        }
        return true;
    }

    // Check if a number is the owner
    isOwner(phoneNumber: string): boolean {
        const ownerNumber = this.getOwnerPhone().replace(/\D/g, '');
        const checkNumber = phoneNumber.replace(/\D/g, '');
        return checkNumber.includes(ownerNumber) || ownerNumber.includes(checkNumber);
    }

    // Generate AI system prompt based on owner profile
    generateSystemPrompt(): string {
        if (!this.profile) {
            return 'You are a helpful assistant.';
        }

        const p = this.profile;
        const kb = p.knowledgeBase.map(k => `Q: ${k.patterns.join('/')} → ${k.answer}`).join('\n');

        return `You are a WhatsApp bot that responds on behalf of ${p.profile.name}.

## OWNER PROFILE:
- **Name**: ${p.profile.name}
- **Role**: ${p.profile.role}
- **Tagline**: ${p.profile.tagline}
- **Description**: ${p.profile.description}
- **Location**: ${p.profile.location.city}, ${p.profile.location.state}, ${p.profile.location.country}
- **Born**: ${p.profile.details.birthDate} (${p.profile.details.zodiac})

## BACKGROUND:
- **Education**: ${p.background.education}
- **Current Work**: ${p.background.currentWork.role} at ${p.background.currentWork.company}
- **Domain**: ${p.background.currentWork.domain}
- **Tech Stack**: ${p.background.currentWork.technologies.join(', ')}
- **Focus Areas**: ${p.background.currentWork.focus.join(', ')}

## SKILLS:
- **Technical**: ${p.background.skills.technical.join(', ')}
- **Research**: ${p.background.skills.research.join(', ')}

## INTERESTS:
- **Professional**: ${p.interests.professional.join(', ')}
- **Creative**: ${p.interests.creative.join(', ')}
- **Personal**: ${p.interests.personal.join(', ')}

## PERSONALITY:
- **Traits**: ${p.personality.traits.join(', ')}
- **Values**: ${p.personality.values.join(', ')}
- **Work Style**: ${p.personality.workStyle}

## BOT PERSONALITY:
- **Name**: ${p.botPersonality.name}
- **Tone**: ${p.botPersonality.tone}
- **Language**: ${p.botPersonality.language}
- **Style**: ${p.botPersonality.style}

## KNOWLEDGE BASE (Use these for specific questions):
${kb}

## RESPONSE GUIDELINES:
1. **Be ${p.profile.name}**: Respond as if you ARE them
2. **Tone**: ${p.botPersonality.tone}
3. **Style**: ${p.botPersonality.style}
4. **Language**: ${p.botPersonality.language}
5. **Keep responses SHORT**: Like real texting, not essays
6. **Use emojis sparingly but naturally**
7. **For unknown topics**: "${p.botPersonality.fallbackMessage}"
8. **Away message**: "${p.botPersonality.awayMessage}"

## SEARCH COMMANDS (include in response when needed):
- {"type": "smart_search", "params": {"query": "..."}} - General search
- {"type": "sports_search", "params": {"query": "..."}} - Sports/scores
- {"type": "news_search", "params": {"query": "..."}} - News
- {"type": "youtube_search", "params": {"query": "..."}} - Videos
- {"type": "music_search", "params": {"query": "..."}} - Songs
- {"type": "movie_search", "params": {"query": "..."}} - Movies

Format response as JSON:
{"response": "your casual reply", "commands": []}`;
    }
}

// Singleton instance
let profileManagerInstance: ProfileManager | null = null;

export function getProfileManager(): ProfileManager {
    if (!profileManagerInstance) {
        profileManagerInstance = new ProfileManager();
    }
    return profileManagerInstance;
}
