import express from 'express';
import { Logger } from './utils/logger.js';

const logger = new Logger('KeepAlive');

export function startKeepAlive() {
    const app = express();
    const port = process.env.PORT || 3000;

    app.get('/', (req, res) => {
        res.send('Clawdbot is alive! 🤖✨');
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
