import { ParsedCommand } from './command-parser.js';
import { FileSystem } from '../capabilities/filesystem.js';
import { BrowserControl } from '../capabilities/browser.js';
import { SystemControl } from '../capabilities/system.js';
import { ScreenCapture } from '../capabilities/screen.js';
import { ProductivityManager, Reminder } from '../capabilities/productivity.js';
import { WebSearch } from '../capabilities/websearch.js';
import { Logger } from '../utils/logger.js';

export interface ExecutionResult {
    success: boolean;
    output?: string;
    attachments?: string[];
    imageUrl?: string;
    error?: string;
}

export class TaskExecutor {
    private logger: Logger;
    private filesystem: FileSystem;
    private browser: BrowserControl;
    private system: SystemControl;
    private screen: ScreenCapture;
    private productivity: ProductivityManager;
    private websearch: WebSearch;
    private onReminderTrigger?: (reminder: Reminder) => void;

    constructor() {
        this.logger = new Logger('TaskExecutor');
        this.filesystem = new FileSystem();
        this.browser = new BrowserControl();
        this.system = new SystemControl();
        this.screen = new ScreenCapture();
        this.productivity = new ProductivityManager();
        this.websearch = new WebSearch();
    }

    setReminderCallback(callback: (reminder: Reminder) => void): void {
        this.onReminderTrigger = callback;
    }

    async initialize(): Promise<void> {
        this.logger.info('Initializing task executor...');
        await this.browser.initialize();
        await this.productivity.initialize((reminder) => {
            if (this.onReminderTrigger) {
                this.onReminderTrigger(reminder);
            }
        });
    }

    async execute(command: ParsedCommand): Promise<ExecutionResult> {
        this.logger.info(`Executing command: ${command.type}`);

        try {
            switch (command.type) {
                // File operations
                case 'file_search':
                    return await this.filesystem.search(
                        command.params.pattern as string,
                        command.params.directory as string,
                        command.params.recursive as boolean
                    );

                case 'file_read':
                    return await this.filesystem.read(command.params.path as string);

                case 'file_download':
                    return await this.filesystem.download(
                        command.params.url as string,
                        command.params.destination as string
                    );

                case 'dir_list':
                    return await this.filesystem.listDirectory(command.params.path as string);

                // Browser operations
                case 'browser_open':
                    return await this.browser.open(command.params.url as string);

                case 'browser_search':
                    return await this.browser.search(command.params.query as string);

                case 'browser_screenshot':
                    return await this.browser.screenshot(
                        command.params.url as string | undefined,
                        command.params.fullPage as boolean | undefined
                    );

                // System operations
                case 'system_run':
                    return await this.system.runCommand(command.params.command as string);

                case 'system_open_app':
                    return await this.system.openApp(command.params.appName as string);

                case 'system_info':
                    return await this.system.getSystemInfo(command.params.type as string);

                // Screenshot
                case 'screenshot':
                    return await this.screen.capture();

                // ===== PRODUCTIVITY =====
                case 'add_note':
                    const note = await this.productivity.addNote(
                        command.params.content as string,
                        command.params.tags as string[] | undefined
                    );
                    return {
                        success: true,
                        output: `📝 Note saved!\n\n"${note.content}"`
                    };

                case 'get_notes':
                    const notes = await this.productivity.getNotes(command.params.limit as number || 5);
                    if (notes.length === 0) {
                        return { success: true, output: '📝 No notes yet. Add one with: note [your text]' };
                    }
                    const notesList = notes.map((n, i) => `${i + 1}. ${n.content}`).join('\n');
                    return { success: true, output: `📝 **Your Notes:**\n\n${notesList}` };

                case 'add_todo':
                    const todo = await this.productivity.addTodo(
                        command.params.task as string,
                        command.params.priority as 'low' | 'medium' | 'high' || 'medium'
                    );
                    return {
                        success: true,
                        output: `✅ Todo added!\n\n"${todo.task}"`
                    };

                case 'get_todos':
                    const todos = await this.productivity.getTodos();
                    if (todos.length === 0) {
                        return { success: true, output: '✅ No todos! You\'re all caught up. Add one with: todo [task]' };
                    }
                    const todosList = todos.map((t, i) => {
                        const priority = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
                        return `${i + 1}. ${priority} ${t.task}`;
                    }).join('\n');
                    return { success: true, output: `📋 **Your Todos:**\n\n${todosList}` };

                case 'complete_todo':
                    const completed = await this.productivity.completeTodo(command.params.index as number);
                    if (completed) {
                        return { success: true, output: `✅ Done! Completed: "${completed.task}"` };
                    }
                    return { success: false, output: '❌ Todo not found' };

                case 'add_reminder':
                    const timeStr = command.params.time as string;
                    const triggerAt = this.productivity.parseTimeString(timeStr);
                    if (!triggerAt) {
                        return { success: false, output: '❌ Could not parse time. Try: "in 30 minutes" or "at 5pm"' };
                    }
                    const reminder = await this.productivity.addReminder(
                        command.params.message as string,
                        triggerAt
                    );
                    return {
                        success: true,
                        output: `⏰ Reminder set for ${triggerAt.toLocaleTimeString()}!\n\n"${reminder.message}"`
                    };

                case 'get_reminders':
                    const reminders = await this.productivity.getReminders();
                    if (reminders.length === 0) {
                        return { success: true, output: '⏰ No reminders set. Add one with: remind me in 30 min to [task]' };
                    }
                    const remindersList = reminders.map((r, i) =>
                        `${i + 1}. ${r.triggerAt.toLocaleTimeString()} - ${r.message}`
                    ).join('\n');
                    return { success: true, output: `⏰ **Your Reminders:**\n\n${remindersList}` };

                // ===== WEB SEARCH =====
                case 'web_search':
                    return await this.websearch.search(command.params.query as string);

                case 'smart_search':
                    return await this.websearch.smartSearch(command.params.query as string);

                case 'youtube_search':
                    return await this.websearch.searchYouTube(command.params.query as string);

                case 'amazon_search':
                    return await this.websearch.searchAmazon(command.params.query as string);

                case 'sports_search':
                    return await this.websearch.searchSports(command.params.query as string);

                case 'news_search':
                    return await this.websearch.searchNews(command.params.query as string);

                case 'person_search':
                    return await this.websearch.searchPerson(command.params.query as string);

                case 'music_search':
                    return await this.websearch.searchMusic(command.params.query as string);

                case 'movie_search':
                    return await this.websearch.searchMovie(command.params.query as string);

                case 'location_search':
                    return await this.websearch.searchLocation(command.params.query as string);

                case 'game_search':
                    return await this.websearch.searchGame(command.params.query as string);

                case 'image_search':
                    return await this.websearch.searchImages(command.params.query as string);

                // Help
                case 'help':
                    return {
                        success: true,
                        output: 'Use /help for available commands'
                    };

                default:
                    return {
                        success: false,
                        error: `Unknown command type: ${command.type}`
                    };
            }
        } catch (error) {
            this.logger.error(`Command execution error:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    async shutdown(): Promise<void> {
        await this.browser.close();
        this.productivity.shutdown();
    }
}
