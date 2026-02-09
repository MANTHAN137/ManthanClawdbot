import { Logger } from '../utils/logger.js';
import { ExecutionResult } from '../core/task-executor.js';

export interface SearchResultWithImage extends ExecutionResult {
    imageUrl?: string;
    links?: { title: string; url: string }[];
}

export class WebSearch {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('WebSearch');
    }

    // Get image URL from free sources
    async getImageUrl(query: string): Promise<string | null> {
        try {
            const stopWords = ['who', 'what', 'where', 'when', 'why', 'how', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'of', 'for', 'to', 'me', 'tell', 'show', 'find', 'search', 'score', 'result', 'match', 'vs', 'versus'];
            const words = query.toLowerCase().split(/\s+/);
            const tags = words
                .filter(w => !stopWords.includes(w) && w.length > 2)
                .slice(0, 3)
                .join(',');

            if (!tags) return null;

            const imageUrl = `https://loremflickr.com/800/600/${encodeURIComponent(tags)}/all`;
            return imageUrl;
        } catch (error) {
            this.logger.warn('Failed to get image:', error);
            return null;
        }
    }

    // General web search
    async search(query: string): Promise<SearchResultWithImage> {
        try {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            const imageUrl = await this.getImageUrl(query);

            return {
                success: true,
                output: `🔍 *${query}*\n\n📎 Search: ${searchUrl}`,
                imageUrl: imageUrl || undefined,
                links: [{ title: 'Google Search', url: searchUrl }]
            };
        } catch (error) {
            this.logger.error('Search error:', error);
            return {
                success: false,
                error: `Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // YouTube video search
    async searchYouTube(query: string): Promise<SearchResultWithImage> {
        try {
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
            const imageUrl = await this.getImageUrl(query);

            return {
                success: true,
                output: `🎬 *YouTube: ${query}*\n\n▶️ Watch: ${searchUrl}`,
                imageUrl: imageUrl || undefined,
                links: [{ title: 'YouTube Search', url: searchUrl }]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search YouTube: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // Amazon shopping search
    async searchAmazon(query: string): Promise<SearchResultWithImage> {
        try {
            const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
            const imageUrl = await this.getImageUrl(query);

            return {
                success: true,
                output: `🛒 *Amazon: ${query}*\n\n🛍️ Shop: ${searchUrl}`,
                imageUrl: imageUrl || undefined,
                links: [{ title: 'Amazon India', url: searchUrl }]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search Amazon: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // Image search
    async searchImages(query: string): Promise<SearchResultWithImage> {
        try {
            const imageUrl = await this.getImageUrl(query);
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;

            return {
                success: true,
                output: `📸 *Images: ${query}*\n\n🖼️ More: ${searchUrl}`,
                imageUrl: imageUrl || undefined,
                links: [{ title: 'Google Images', url: searchUrl }]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search images: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // 🏏 Sports/Cricket score search
    async searchSports(query: string): Promise<SearchResultWithImage> {
        try {
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' live score')}`;
            const cricbuzzUrl = `https://www.cricbuzz.com/cricket-match/live-scores`;
            const espnUrl = `https://www.espncricinfo.com/live-cricket-score`;

            const output = `🏏 *${query}*

📊 Live Score Links:
• Google: ${googleUrl}
• Cricbuzz: ${cricbuzzUrl}
• ESPNCricinfo: ${espnUrl}

💡 _For live scores, check the links above!_`;

            return {
                success: true,
                output,
                links: [
                    { title: 'Google Sports', url: googleUrl },
                    { title: 'Cricbuzz', url: cricbuzzUrl },
                    { title: 'ESPNCricinfo', url: espnUrl }
                ]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search sports: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // 📰 News search
    async searchNews(query: string): Promise<SearchResultWithImage> {
        try {
            const googleNewsUrl = `https://news.google.com/search?q=${encodeURIComponent(query)}`;
            const bingNewsUrl = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}`;

            const output = `📰 *News: ${query}*

🗞️ Latest News:
• Google News: ${googleNewsUrl}
• Bing News: ${bingNewsUrl}`;

            return {
                success: true,
                output,
                links: [
                    { title: 'Google News', url: googleNewsUrl },
                    { title: 'Bing News', url: bingNewsUrl }
                ]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search news: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // 👤 Person/People search
    async searchPerson(query: string): Promise<SearchResultWithImage> {
        try {
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            const wikiUrl = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`;
            const linkedinUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
            const imageUrl = await this.getImageUrl(query + ' person');

            const output = `👤 *${query}*

🔍 Find more about this person:
• Google: ${googleUrl}
• Wikipedia: ${wikiUrl}
• LinkedIn: ${linkedinUrl}`;

            return {
                success: true,
                output,
                imageUrl: imageUrl || undefined,
                links: [
                    { title: 'Google', url: googleUrl },
                    { title: 'Wikipedia', url: wikiUrl },
                    { title: 'LinkedIn', url: linkedinUrl }
                ]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search person: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // 🎵 Music search
    async searchMusic(query: string): Promise<SearchResultWithImage> {
        try {
            const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;
            const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' song')}`;
            const jiosaavnUrl = `https://www.jiosaavn.com/search/${encodeURIComponent(query)}`;

            const output = `🎵 *Music: ${query}*

🎧 Listen on:
• Spotify: ${spotifyUrl}
• YouTube: ${youtubeUrl}
• JioSaavn: ${jiosaavnUrl}`;

            return {
                success: true,
                output,
                links: [
                    { title: 'Spotify', url: spotifyUrl },
                    { title: 'YouTube Music', url: youtubeUrl },
                    { title: 'JioSaavn', url: jiosaavnUrl }
                ]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search music: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // 🎬 Movie/Show search
    async searchMovie(query: string): Promise<SearchResultWithImage> {
        try {
            const imdbUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(query)}`;
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' movie')}`;
            const justWatchUrl = `https://www.justwatch.com/in/search?q=${encodeURIComponent(query)}`;
            const imageUrl = await this.getImageUrl(query + ' movie poster');

            const output = `🎬 *Movie: ${query}*

🍿 Find where to watch:
• IMDB: ${imdbUrl}
• Google: ${googleUrl}
• JustWatch: ${justWatchUrl}`;

            return {
                success: true,
                output,
                imageUrl: imageUrl || undefined,
                links: [
                    { title: 'IMDB', url: imdbUrl },
                    { title: 'Google', url: googleUrl },
                    { title: 'JustWatch', url: justWatchUrl }
                ]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search movie: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // 📍 Location/Place search
    async searchLocation(query: string): Promise<SearchResultWithImage> {
        try {
            const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
            const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' location')}`;
            const imageUrl = await this.getImageUrl(query + ' place');

            const output = `📍 *Location: ${query}*

🗺️ Find on map:
• Google Maps: ${mapsUrl}
• Google Search: ${googleUrl}`;

            return {
                success: true,
                output,
                imageUrl: imageUrl || undefined,
                links: [
                    { title: 'Google Maps', url: mapsUrl },
                    { title: 'Google', url: googleUrl }
                ]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search location: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // 🎮 Game search
    async searchGame(query: string): Promise<SearchResultWithImage> {
        try {
            const steamUrl = `https://store.steampowered.com/search/?term=${encodeURIComponent(query)}`;
            const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' gameplay')}`;
            const igdbUrl = `https://www.igdb.com/search?utf8=✓&q=${encodeURIComponent(query)}`;
            const imageUrl = await this.getImageUrl(query + ' game');

            const output = `🎮 *Game: ${query}*

🕹️ Find the game:
• Steam: ${steamUrl}
• Gameplay Videos: ${youtubeUrl}
• IGDB: ${igdbUrl}`;

            return {
                success: true,
                output,
                imageUrl: imageUrl || undefined,
                links: [
                    { title: 'Steam', url: steamUrl },
                    { title: 'YouTube Gameplay', url: youtubeUrl },
                    { title: 'IGDB', url: igdbUrl }
                ]
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to search game: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    // 🔧 Smart search - automatically detects search type
    async smartSearch(query: string): Promise<SearchResultWithImage> {
        const lowerQuery = query.toLowerCase();

        // Detect search type from keywords
        if (lowerQuery.includes('score') || lowerQuery.includes('match') || lowerQuery.includes('vs') ||
            lowerQuery.includes('cricket') || lowerQuery.includes('football') || lowerQuery.includes('ipl') ||
            lowerQuery.includes('t20') || lowerQuery.includes('odi') || lowerQuery.includes('world cup')) {
            return this.searchSports(query);
        }

        if (lowerQuery.includes('news') || lowerQuery.includes('latest') || lowerQuery.includes('breaking')) {
            return this.searchNews(query.replace(/news|latest|breaking/gi, '').trim());
        }

        if (lowerQuery.includes('who is') || lowerQuery.includes('about') || lowerQuery.includes('biography')) {
            return this.searchPerson(query.replace(/who is|about|biography/gi, '').trim());
        }

        if (lowerQuery.includes('song') || lowerQuery.includes('music') || lowerQuery.includes('lyrics') ||
            lowerQuery.includes('album') || lowerQuery.includes('singer')) {
            return this.searchMusic(query.replace(/song|music|lyrics|album|singer/gi, '').trim());
        }

        if (lowerQuery.includes('movie') || lowerQuery.includes('film') || lowerQuery.includes('watch') ||
            lowerQuery.includes('series') || lowerQuery.includes('show')) {
            return this.searchMovie(query.replace(/movie|film|watch|series|show/gi, '').trim());
        }

        if (lowerQuery.includes('video') || lowerQuery.includes('tutorial') || lowerQuery.includes('youtube')) {
            return this.searchYouTube(query.replace(/video|tutorial|youtube/gi, '').trim());
        }

        if (lowerQuery.includes('buy') || lowerQuery.includes('price') || lowerQuery.includes('amazon') ||
            lowerQuery.includes('shop') || lowerQuery.includes('order')) {
            return this.searchAmazon(query.replace(/buy|price|amazon|shop|order/gi, '').trim());
        }

        if (lowerQuery.includes('image') || lowerQuery.includes('photo') || lowerQuery.includes('picture') ||
            lowerQuery.includes('wallpaper')) {
            return this.searchImages(query.replace(/image|photo|picture|wallpaper/gi, '').trim());
        }

        if (lowerQuery.includes('location') || lowerQuery.includes('map') || lowerQuery.includes('direction') ||
            lowerQuery.includes('where is') || lowerQuery.includes('near me')) {
            return this.searchLocation(query.replace(/location|map|direction|where is|near me/gi, '').trim());
        }

        if (lowerQuery.includes('game') || lowerQuery.includes('gameplay') || lowerQuery.includes('steam') ||
            lowerQuery.includes('play')) {
            return this.searchGame(query.replace(/game|gameplay|steam|play/gi, '').trim());
        }

        // Default to general search
        return this.search(query);
    }
}
