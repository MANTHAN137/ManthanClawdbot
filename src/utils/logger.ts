import chalk from 'chalk';

export class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    private getTimestamp(): string {
        return new Date().toLocaleTimeString();
    }

    info(message: string, ...args: unknown[]): void {
        console.log(
            chalk.gray(`[${this.getTimestamp()}]`),
            chalk.blue(`[${this.context}]`),
            message,
            ...args
        );
    }

    success(message: string, ...args: unknown[]): void {
        console.log(
            chalk.gray(`[${this.getTimestamp()}]`),
            chalk.green(`[${this.context}]`),
            chalk.green(message),
            ...args
        );
    }

    warn(message: string, ...args: unknown[]): void {
        console.log(
            chalk.gray(`[${this.getTimestamp()}]`),
            chalk.yellow(`[${this.context}]`),
            chalk.yellow(message),
            ...args
        );
    }

    error(message: string, ...args: unknown[]): void {
        console.error(
            chalk.gray(`[${this.getTimestamp()}]`),
            chalk.red(`[${this.context}]`),
            chalk.red(message),
            ...args
        );
    }

    debug(message: string, ...args: unknown[]): void {
        if (process.env.LOG_LEVEL === 'debug') {
            console.log(
                chalk.gray(`[${this.getTimestamp()}]`),
                chalk.magenta(`[${this.context}]`),
                chalk.gray(message),
                ...args
            );
        }
    }
}
