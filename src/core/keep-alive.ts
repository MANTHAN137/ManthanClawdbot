import express from 'express';
import qrcode from 'qrcode';
import { currentQR, isConnected } from './state.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('KeepAlive');

export function startKeepAlive() {
    const app = express();
    const port = process.env.PORT || 3000;

    app.get('/', async (req, res) => {
        const style = `
            <style>
                body { font-family: sans-serif; text-align: center; padding: 20px; background: #f0f2f5; }
                .container { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); display: inline-block; }
                h1 { color: #333; }
                img { max-width: 300px; }
            </style>
        `;

        if (isConnected) {
            return res.send(`
                <html><head><title>Clawdbot Status</title>${style}</head><body>
                    <div class="container">
                        <h1>Clawdbot is Active! 🤖✅</h1>
                        <p>WhatsApp is connected and ready.</p>
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

    app.listen(port, () => {
        logger.info(`Keep-alive server listening on port ${port}`);
    });

    // Optional: Self-ping if external URL is provided
    const url = process.env.RENDER_EXTERNAL_URL;
    if (url) {
        setInterval(() => {
            fetch(url)
                .then(() => logger.debug('Self-ping success'))
                .catch(err => logger.warn('Self-ping failed:', err.message));
        }, 14 * 60 * 1000); // Ping every 14 minutes (Render sleeps after 15)
    }
}
