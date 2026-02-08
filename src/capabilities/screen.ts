import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger.js';
import { ExecutionResult } from '../core/task-executor.js';

const execAsync = promisify(exec);

export class ScreenCapture {
    private logger: Logger;

    constructor() {
        this.logger = new Logger('Screen');
    }

    async capture(): Promise<ExecutionResult> {
        try {
            const screenshotDir = path.resolve('screenshots');
            await fs.mkdir(screenshotDir, { recursive: true });

            const filename = `screen_${Date.now()}.png`;
            const filepath = path.join(screenshotDir, filename);

            // Use PowerShell to capture screen on Windows
            const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen
        $bitmap = New-Object System.Drawing.Bitmap($screen.Bounds.Width, $screen.Bounds.Height)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen($screen.Bounds.Location, [System.Drawing.Point]::Empty, $screen.Bounds.Size)
        $bitmap.Save('${filepath.replace(/\\/g, '\\\\')}')
        $graphics.Dispose()
        $bitmap.Dispose()
      `;

            await execAsync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, {
                timeout: 10000
            });

            this.logger.info(`Screenshot saved to ${filepath}`);

            return {
                success: true,
                output: `📸 Screenshot captured!`,
                attachments: [filepath]
            };
        } catch (error) {
            this.logger.error('Screenshot error:', error);
            return {
                success: false,
                error: `Failed to capture screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    async captureRegion(x: number, y: number, width: number, height: number): Promise<ExecutionResult> {
        try {
            const screenshotDir = path.resolve('screenshots');
            await fs.mkdir(screenshotDir, { recursive: true });

            const filename = `region_${Date.now()}.png`;
            const filepath = path.join(screenshotDir, filename);

            const psScript = `
        Add-Type -AssemblyName System.Drawing
        $bitmap = New-Object System.Drawing.Bitmap(${width}, ${height})
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.CopyFromScreen(${x}, ${y}, 0, 0, [System.Drawing.Size]::new(${width}, ${height}))
        $bitmap.Save('${filepath.replace(/\\/g, '\\\\')}')
        $graphics.Dispose()
        $bitmap.Dispose()
      `;

            await execAsync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, {
                timeout: 10000
            });

            return {
                success: true,
                output: `📸 Region screenshot captured!`,
                attachments: [filepath]
            };
        } catch (error) {
            this.logger.error('Region screenshot error:', error);
            return {
                success: false,
                error: `Failed to capture region: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
