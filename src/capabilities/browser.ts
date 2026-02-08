import { chromium, Browser, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';
import open from 'open';
import { Logger } from '../utils/logger.js';
import { ExecutionResult } from '../core/task-executor.js';

export class BrowserControl {
    private logger: Logger;
    private browser: Browser | null = null;
    private page: Page | null = null;

    constructor() {
        this.logger = new Logger('Browser');
    }

    async initialize(): Promise<void> {
        // Browser will be launched on demand
        this.logger.info('Browser control initialized');
    }

    private async ensureBrowser(): Promise<Page> {
        if (!this.browser || !this.browser.isConnected()) {
            this.logger.info('Launching browser...');
            this.browser = await chromium.launch({
                headless: false // Show browser for user to see
            });
        }

        if (!this.page || this.page.isClosed()) {
            const context = await this.browser.newContext();
            this.page = await context.newPage();
        }

        return this.page;
    }

    async open(url: string): Promise<ExecutionResult> {
        try {
            // Ensure URL has protocol
            let finalUrl = url;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                finalUrl = `https://${url}`;
            }

            this.logger.info(`Opening URL: ${finalUrl}`);

            // Use system default browser for simple opens
            await open(finalUrl);

            return {
                success: true,
                output: `🌐 Opened ${finalUrl} in your default browser`
            };
        } catch (error) {
            this.logger.error('Open URL error:', error);
            return {
                success: false,
                error: `Failed to open URL: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async search(query: string): Promise<ExecutionResult> {
        try {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            await open(searchUrl);

            return {
                success: true,
                output: `🔍 Searching Google for: "${query}"`
            };
        } catch (error) {
            this.logger.error('Search error:', error);
            return {
                success: false,
                error: `Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async screenshot(url?: string, fullPage: boolean = false): Promise<ExecutionResult> {
        try {
            const page = await this.ensureBrowser();

            if (url) {
                let finalUrl = url;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    finalUrl = `https://${url}`;
                }
                await page.goto(finalUrl, { waitUntil: 'networkidle' });
            }

            const screenshotDir = path.resolve('screenshots');
            await fs.mkdir(screenshotDir, { recursive: true });

            const filename = `screenshot_${Date.now()}.png`;
            const filepath = path.join(screenshotDir, filename);

            await page.screenshot({ path: filepath, fullPage });

            return {
                success: true,
                output: `📸 Screenshot saved!`,
                attachments: [filepath]
            };
        } catch (error) {
            this.logger.error('Screenshot error:', error);
            return {
                success: false,
                error: `Failed to take screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async navigateAndExtract(url: string, selector?: string): Promise<ExecutionResult> {
        try {
            const page = await this.ensureBrowser();

            let finalUrl = url;
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                finalUrl = `https://${url}`;
            }

            await page.goto(finalUrl, { waitUntil: 'networkidle' });

            let content: string;
            if (selector) {
                const element = await page.$(selector);
                content = element ? await element.textContent() || '' : 'Element not found';
            } else {
                content = await page.title();
            }

            return {
                success: true,
                output: `🌐 Page loaded: ${await page.title()}\n📄 Content: ${content.substring(0, 500)}`
            };
        } catch (error) {
            this.logger.error('Navigate error:', error);
            return {
                success: false,
                error: `Failed to navigate: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async close(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}
