import 'dotenv/config';
import * as fs from 'fs';

async function listModels() {
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync('model-list.log', msg + '\n');
    };

    log('Fetching available models via REST API...');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        log('❌ GEMINI_API_KEY is missing');
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.models) {
            log('\n✅ Available Models:');
            data.models.forEach((m: any) => {
                if (m.supportedGenerationMethods?.includes('generateContent')) {
                    log(`- ${m.name}`);
                }
            });
        } else {
            log('❌ No models found in response.');
            log(JSON.stringify(data, null, 2));
        }

    } catch (error: any) {
        log(`❌ Failed to list models: ${error.message}`);
    }
}

listModels();
