import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testAlternatives() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return console.error('No API Key');

    const genAI = new GoogleGenerativeAI(apiKey);

    const models = [
        'gemini-2.0-flash-001',
        'gemini-2.0-flash-lite-001',
        'gemini-flash-latest',
        'gemini-pro-latest'
    ];

    for (const m of models) {
        try {
            console.log(`\nTesting ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent('Hi');
            console.log(`✅ ${m} SUCCESS:`, result.response.text());
        } catch (error: any) {
            console.log(`❌ ${m} FAILED: ${error.message}`);
        }
    }
}

testAlternatives();
