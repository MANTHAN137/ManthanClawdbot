import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { Logger } from '../utils/logger.js';
import { ExecutionResult } from '../core/task-executor.js';

export class FileSystem {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('FileSystem');
    }

    async search(pattern: string, directory: string = '.', recursive: boolean = true): Promise<ExecutionResult> {
        try {
            const searchPath = path.resolve(directory);
            const searchPattern = recursive ? `**/${pattern}` : pattern;

            this.logger.info(`Searching for "${pattern}" in ${searchPath}`);

            const files = await glob(searchPattern, {
                cwd: searchPath,
                nodir: false,
                absolute: true,
                ignore: ['**/node_modules/**', '**/.git/**']
            });

            if (files.length === 0) {
                return {
                    success: true,
                    output: `🔍 No files found matching "${pattern}" in ${searchPath}`
                };
            }

            const output = [
                `🔍 Found ${files.length} file(s) matching "${pattern}":`,
                '',
                ...files.slice(0, 20).map(f => `📄 ${f}`),
                files.length > 20 ? `\n... and ${files.length - 20} more files` : ''
            ].join('\n');

            return { success: true, output };
        } catch (error) {
            this.logger.error('Search error:', error);
            return {
                success: false,
                error: `Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async listDirectory(dirPath: string = '.'): Promise<ExecutionResult> {
        try {
            const resolvedPath = path.resolve(dirPath);
            const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

            const items = await Promise.all(
                entries.slice(0, 30).map(async (entry) => {
                    const icon = entry.isDirectory() ? '📁' : '📄';
                    const fullPath = path.join(resolvedPath, entry.name);

                    try {
                        const stats = await fs.stat(fullPath);
                        const size = entry.isFile() ? this.formatSize(stats.size) : '';
                        return `${icon} ${entry.name} ${size}`;
                    } catch {
                        return `${icon} ${entry.name}`;
                    }
                })
            );

            const output = [
                `📂 Contents of ${resolvedPath}:`,
                '',
                ...items,
                entries.length > 30 ? `\n... and ${entries.length - 30} more items` : ''
            ].join('\n');

            return { success: true, output };
        } catch (error) {
            this.logger.error('List directory error:', error);
            return {
                success: false,
                error: `Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async read(filePath: string): Promise<ExecutionResult> {
        try {
            const resolvedPath = path.resolve(filePath);
            const stats = await fs.stat(resolvedPath);

            if (stats.size > 1024 * 100) { // 100KB limit
                return {
                    success: false,
                    error: `File too large (${this.formatSize(stats.size)}). Maximum is 100KB.`
                };
            }

            const content = await fs.readFile(resolvedPath, 'utf-8');
            const lines = content.split('\n');
            const preview = lines.slice(0, 50).join('\n');

            const output = [
                `📄 File: ${resolvedPath}`,
                `📊 Size: ${this.formatSize(stats.size)} | Lines: ${lines.length}`,
                '',
                '```',
                preview,
                lines.length > 50 ? `\n... (${lines.length - 50} more lines)` : '',
                '```'
            ].join('\n');

            return { success: true, output };
        } catch (error) {
            this.logger.error('Read file error:', error);
            return {
                success: false,
                error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async download(url: string, destination?: string): Promise<ExecutionResult> {
        try {
            const fileName = destination || path.basename(new globalThis.URL(url).pathname) || 'download';
            const downloadPath = path.resolve(process.env.DOWNLOAD_DIR || '.', fileName);

            this.logger.info(`Downloading ${url} to ${downloadPath}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            await fs.writeFile(downloadPath, buffer);

            return {
                success: true,
                output: `✅ Downloaded successfully!\n📁 Saved to: ${downloadPath}\n📊 Size: ${this.formatSize(buffer.length)}`
            };
        } catch (error) {
            this.logger.error('Download error:', error);
            return {
                success: false,
                error: `Failed to download: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    private formatSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
}
