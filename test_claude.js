require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = new Anthropic({ apiKey: KEY });

async function testModel() {
  console.log('Testing claude-haiku-4-5-20251001...');
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Say exactly "Hello"' }],
    });
    const text = res.content.find((b) => b.type === 'text')?.text?.trim();
    console.log(`OK: ${text}`);
  } catch (e) {
    console.error(`FAILED: ${e.message}`);
    process.exit(1);
  }
}

if (!KEY) {
  console.error('Error: ANTHROPIC_API_KEY not set in .env');
  process.exit(1);
}

testModel();
