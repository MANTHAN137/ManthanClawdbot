import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';

async function testFinal() {
    const log = (msg: string) => {
        console.log(msg);
        fs.appendFileSync('model-test-final.log', msg + '\n');
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        log('No API Key');
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Testing a mix of old stable, new stable, and preview models
    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-2.0-flash',
        'gemini-flash-latest',
        'gemini-pro-latest'
    ];

    log('Starting extensive model test...');

    for (const m of models) {
        try {
            log(`\n----------------------------------------`);
            log(`Testing ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent('Hi');
            log(`✅ ${m} SUCCESS: ${result.response.text()}`);
        } catch (error: any) {
            log(`❌ ${m} FAILED: ${error.message}`);
            if (error.message.includes('429')) log('   -> Rate Limit Hit');
            if (error.message.includes('404')) log('   -> Model Not Found / Not Supported');
        }
    }
}

testFinal();
