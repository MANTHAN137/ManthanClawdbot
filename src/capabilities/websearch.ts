import { Logger } from '../utils/logger.js';
import { ExecutionResult } from '../core/task-executor.js';

export interface SearchResultWithImage extends ExecutionResult {
    imageUrl?: string;
}

export class WebSearch {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('WebSearch');
    }

    // Get image URL from free sources
    async getImageUrl(query: string): Promise<string | null> {
        try {
            // Use LoremFlickr (free, tag based)
            // Filter out common stop words
            const stopWords = ['who', 'what', 'where', 'when', 'why', 'how', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'of', 'for', 'to', 'me', 'tell', 'show', 'find', 'search'];
            const words = query.toLowerCase().split(/\s+/);
            const tags = words
                .filter(w => !stopWords.includes(w) && w.length > 2)
                .slice(0, 3)
                .join(',');

            if (!tags) return null; // No valid tags found

            const imageUrl = `https://loremflickr.com/800/600/${encodeURIComponent(tags)}/all`;
            return imageUrl;
        } catch (error) {
            this.logger.warn('Failed to get image:', error);
            return null;
        }
    }

    async search(query: string): Promise<SearchResultWithImage> {
        try {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            const imageUrl = await this.getImageUrl(query);

            return {
                success: true,
                output: `🔍 *${query}*\n\n📎 Learn more: ${searchUrl}`,
                imageUrl: imageUrl || undefined
            };
        } catch (error) {
            this.logger.error('Search error:', error);
            return {
                success: false,
                error: `Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async searchYouTube(query: string): Promise<SearchResultWithImage> {
        try {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            // For YouTube, get a relevant image
            const imageUrl = await this.getImageUrl(query);

            return {
                success: true,
                output: `🎬 *${query}*\n\n▶️ Watch: ${searchUrl}`,
                imageUrl: imageUrl || undefined
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search YouTube: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async searchAmazon(query: string): Promise<SearchResultWithImage> {
        try {
            const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
            const imageUrl = await this.getImageUrl(query);

            return {
                success: true,
                output: `🛒 *${query}*\n\n🛍️ Shop: ${searchUrl}`,
                imageUrl: imageUrl || undefined
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search Amazon: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // Search for images only
    async searchImages(query: string): Promise<SearchResultWithImage> {
        try {
            const imageUrl = await this.getImageUrl(query);
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;

            return {
                success: true,
                output: `📸 *Images for: ${query}*\n\n🖼️ More images: ${searchUrl}`,
                imageUrl: imageUrl || undefined
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search images: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
