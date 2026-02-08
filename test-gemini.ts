import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function testGemini() {
    console.log('Testing Gemini API...');

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY is missing in .env');
        return;
    }
    console.log('✅ API Key found');

    const genAI = new GoogleGenerativeAI(apiKey);

    // Test 1: Try gemini-1.5-flash
    try {
        console.log('\nTesting model: gemini-1.5-flash...');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Say hello!');
        console.log('✅ Success! Response:', result.response.text());
    } catch (error) {
        console.error('❌ Failed with gemini-1.5-flash:', error instanceof Error ? error.message : error);
    }

    // Test 2: Try gemini-pro (fallback)
    try {
        console.log('\nTesting model: gemini-pro...');
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent('Say hello!');
        console.log('✅ Success! Response:', result.response.text());
    } catch (error) {
        console.error('❌ Failed with gemini-pro:', error instanceof Error ? error.message : error);
    }
}

testGemini();
