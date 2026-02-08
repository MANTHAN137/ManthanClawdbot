import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../utils/logger.js';

export interface Note {
    id: string;
    content: string;
    createdAt: Date;
    tags?: string[];
}

export interface Todo {
    id: string;
    task: string;
    done: boolean;
    priority: 'low' | 'medium' | 'high';
    createdAt: Date;
    dueDate?: Date;
}

export interface Reminder {
    id: string;
    message: string;
    triggerAt: Date;
    createdAt: Date;
    completed: boolean;
}

export class ProductivityManager {
    private logger: Logger;
    private dataDir: string;
    private notes: Note[] = [];
    private todos: Todo[] = [];
    private reminders: Reminder[] = [];
    private reminderCheckInterval: NodeJS.Timeout | null = null;
    private onReminderTrigger?: (reminder: Reminder) => void;

    constructor() {
        this.logger = new Logger('Productivity');
        this.dataDir = path.resolve('.clawdbot_data');
    }

    async initialize(onReminderTrigger?: (reminder: Reminder) => void): Promise<void> {
        this.onReminderTrigger = onReminderTrigger;

        // Create data directory
        await fs.mkdir(this.dataDir, { recursive: true });

        // Load existing data
        await this.loadData();

        // Start reminder checker
        this.startReminderChecker();

        this.logger.info('Productivity manager initialized');
    }

    // ===== NOTES =====
    async addNote(content: string, tags?: string[]): Promise<Note> {
        const note: Note = {
            id: Date.now().toString(),
            content,
            createdAt: new Date(),
            tags
        };
        this.notes.push(note);
        await this.saveData();
        this.logger.info(`Note added: ${content.substring(0, 30)}...`);
        return note;
    }

    async getNotes(limit: number = 10): Promise<Note[]> {
        return this.notes.slice(-limit).reverse();
    }

    async searchNotes(query: string): Promise<Note[]> {
        const lowerQuery = query.toLowerCase();
        return this.notes.filter(n =>
            n.content.toLowerCase().includes(lowerQuery) ||
            n.tags?.some(t => t.toLowerCase().includes(lowerQuery))
        );
    }

    // ===== TODOS =====
    async addTodo(task: string, priority: 'low' | 'medium' | 'high' = 'medium', dueDate?: Date): Promise<Todo> {
        const todo: Todo = {
            id: Date.now().toString(),
            task,
            done: false,
            priority,
            createdAt: new Date(),
            dueDate
        };
        this.todos.push(todo);
        await this.saveData();
        this.logger.info(`Todo added: ${task}`);
        return todo;
    }

    async getTodos(includeCompleted: boolean = false): Promise<Todo[]> {
        const filtered = includeCompleted ? this.todos : this.todos.filter(t => !t.done);
        return filtered.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    async completeTodo(idOrIndex: string | number): Promise<Todo | null> {
        let todo: Todo | undefined;

        if (typeof idOrIndex === 'number') {
            const active = this.todos.filter(t => !t.done);
            todo = active[idOrIndex - 1];
        } else {
            todo = this.todos.find(t => t.id === idOrIndex);
        }

        if (todo) {
            todo.done = true;
            await this.saveData();
            this.logger.info(`Todo completed: ${todo.task}`);
        }
        return todo || null;
    }

    // ===== REMINDERS =====
    async addReminder(message: string, triggerAt: Date): Promise<Reminder> {
        const reminder: Reminder = {
            id: Date.now().toString(),
            message,
            triggerAt,
            createdAt: new Date(),
            completed: false
        };
        this.reminders.push(reminder);
        await this.saveData();
        this.logger.info(`Reminder set for ${triggerAt.toLocaleString()}: ${message}`);
        return reminder;
    }

    async getReminders(): Promise<Reminder[]> {
        return this.reminders.filter(r => !r.completed).sort((a, b) =>
            a.triggerAt.getTime() - b.triggerAt.getTime()
        );
    }

    parseTimeString(timeStr: string): Date | null {
        const now = new Date();
        const lower = timeStr.toLowerCase();

        // Parse "in X minutes/hours"
        const inMatch = lower.match(/in\s+(\d+)\s*(min|minute|hour|hr|h|m|second|sec|s)/);
        if (inMatch) {
            const amount = parseInt(inMatch[1]);
            const unit = inMatch[2];

            if (unit.startsWith('h')) {
                return new Date(now.getTime() + amount * 60 * 60 * 1000);
            } else if (unit.startsWith('m')) {
                return new Date(now.getTime() + amount * 60 * 1000);
            } else if (unit.startsWith('s')) {
                return new Date(now.getTime() + amount * 1000);
            }
        }

        // Parse "at X:XX" or "at X pm/am"
        const atMatch = lower.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
        if (atMatch) {
            let hours = parseInt(atMatch[1]);
            const minutes = atMatch[2] ? parseInt(atMatch[2]) : 0;
            const ampm = atMatch[3];

            if (ampm === 'pm' && hours < 12) hours += 12;
            if (ampm === 'am' && hours === 12) hours = 0;

            const target = new Date(now);
            target.setHours(hours, minutes, 0, 0);

            // If time is in the past, set for tomorrow
            if (target <= now) {
                target.setDate(target.getDate() + 1);
            }

            return target;
        }

        // Parse "tomorrow"
        if (lower.includes('tomorrow')) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(9, 0, 0, 0); // Default to 9 AM
            return tomorrow;
        }

        return null;
    }

    private startReminderChecker(): void {
        this.reminderCheckInterval = setInterval(async () => {
            const now = new Date();

            for (const reminder of this.reminders) {
                if (!reminder.completed && reminder.triggerAt <= now) {
                    reminder.completed = true;
                    await this.saveData();

                    if (this.onReminderTrigger) {
                        this.onReminderTrigger(reminder);
                    }
                }
            }
        }, 30000); // Check every 30 seconds
    }

    // ===== DATA PERSISTENCE =====
    private async loadData(): Promise<void> {
        try {
            const dataFile = path.join(this.dataDir, 'productivity.json');
            const data = await fs.readFile(dataFile, 'utf-8');
            const parsed = JSON.parse(data);

            this.notes = parsed.notes || [];
            this.todos = parsed.todos || [];
            this.reminders = (parsed.reminders || []).map((r: Reminder) => ({
                ...r,
                triggerAt: new Date(r.triggerAt),
                createdAt: new Date(r.createdAt)
            }));
        } catch {
            // File doesn't exist yet, start fresh
        }
    }

    private async saveData(): Promise<void> {
        const dataFile = path.join(this.dataDir, 'productivity.json');
        await fs.writeFile(dataFile, JSON.stringify({
            notes: this.notes,
            todos: this.todos,
            reminders: this.reminders
        }, null, 2));
    }

    shutdown(): void {
        if (this.reminderCheckInterval) {
            clearInterval(this.reminderCheckInterval);
        }
    }
}
