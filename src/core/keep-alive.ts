import express from 'express';
import qrcode from 'qrcode';
import { currentQR, isConnected } from './state.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('KeepAlive');

// Track uptime for monitoring
let startTime = Date.now();
let pingCount = 0;

export function startKeepAlive() {
    const app = express();
    const port = process.env.PORT || 3000;

    // Health check endpoint for Render (MUST respond quickly)
    app.get('/health', (req, res) => {
        res.status(200).json({
            status: 'ok',
            connected: isConnected,
            uptime: Math.floor((Date.now() - startTime) / 1000),
            pingCount: pingCount,
            timestamp: new Date().toISOString()
        });
    });

    // Ping endpoint for external cron services
    app.get('/ping', (req, res) => {
        pingCount++;
        logger.debug(`Ping received (count: ${pingCount})`);
        res.status(200).send('pong');
    });

    app.get('/', async (req, res) => {
        const style = `
            <style>
                body { font-family: sans-serif; text-align: center; padding: 20px; background: #f0f2f5; }
                .container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: inline-block; }
                h1 { color: #333; }
                img { max-width: 300px; }
                .stats { font-size: 12px; color: #666; margin-top: 20px; }
            </style>
        `;

        const uptimeMinutes = Math.floor((Date.now() - startTime) / 60000);

        if (isConnected) {
            return res.send(`
                <html><head><title>Clawdbot Status</title>${style}</head><body>
                    <div class="container">
                        <h1>Clawdbot is Active! 🤖✅</h1>
                        <p>WhatsApp is connected and ready.</p>
                        <div class="stats">Uptime: ${uptimeMinutes} minutes | Pings: ${pingCount}</div>
                    </div>
                </body></html>
            `);
        }

        if (currentQR) {
            try {
                const qrImage = await qrcode.toDataURL(currentQR);
                return res.send(`
                    <html><head><title>Scan QR Code</title>${style}</head><body>
                        <div class="container">
                            <h1>Scan this QR Code 📱</h1>
                            <img src="${qrImage}" alt="QR Code" />
                            <p>Open WhatsApp > Settings > Linked Devices > Link a Device</p>
                            <p><small>Refreshing in 5 seconds...</small></p>
                        </div>
                        <script>setTimeout(() => location.reload(), 5000);</script>
                    </body></html>
                `);
            } catch (e) {
                logger.error('QR generation error:', e);
                return res.status(500).send('Error generating QR code');
            }
        }

        res.send(`
            <html><head><title>Clawdbot Starting...</title>${style}</head><body>
                <div class="container">
                    <h1>Clawdbot is Starting... ⏳</h1>
                    <p>Waiting for QR code...</p>
                    <script>setTimeout(() => location.reload(), 3000);</script>
                </div>
            </body></html>
        `);
    });

    const server = app.listen(port, () => {
        logger.info(`Keep-alive server listening on port ${port}`);
    });

    // ============================================
    // ANTI-SLEEP SYSTEM (Prevents Render spin-down)
    // ============================================

    const externalUrl = process.env.RENDER_EXTERNAL_URL;

    if (externalUrl) {
        // Strategy 1: Self-ping every 5 minutes (well within 15-min limit)
        const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes

        setInterval(async () => {
            try {
                const response = await fetch(`${externalUrl}/ping`);
                if (response.ok) {
                    logger.debug('Self-ping successful');
                }
            } catch (err: any) {
                logger.warn('Self-ping failed:', err.message);
            }
        }, PING_INTERVAL);

        logger.info(`Anti-sleep enabled: Self-pinging ${externalUrl} every 5 minutes`);

        // Strategy 2: Immediate first ping after 30 seconds
        setTimeout(async () => {
            try {
                await fetch(`${externalUrl}/ping`);
                logger.debug('Initial self-ping completed');
            } catch (err) {
                // Ignore initial ping errors
            }
        }, 30000);
    } else {
        logger.warn('RENDER_EXTERNAL_URL not set - Anti-sleep disabled!');
        logger.warn('Set RENDER_EXTERNAL_URL in Render dashboard to prevent spin-down');
    }

    // Strategy 3: Internal activity simulation (keeps Node.js event loop active)
    setInterval(() => {
        // Simple activity to keep the process "warm"
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        logger.debug(`Memory: ${heapUsedMB}MB heap used`);
    }, 60000); // Every minute

    return server;
}

