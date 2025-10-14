// backend/src/modules/ai/gemini_client.js
// Hybrid AI: Gemini primary intent extraction via function calling

const { GoogleGenerativeAI } = require('@google/generative-ai');

function ensureArrayOfStrings(v) {
  if (Array.isArray(v)) return v.map(x => String(x)).filter(Boolean);
  if (v == null) return [];
  return String(v).split(/[,\s]+/).filter(Boolean);
}

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getIntentFromGemini(query) {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('[GEMINI_DEBUG] API Key exists:', !!apiKey);
  console.log('[GEMINI_DEBUG] API Key length:', apiKey ? apiKey.length : 0);
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY in environment');

  const genAI = new GoogleGenerativeAI(apiKey);
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Define a tool for function calling
  const tools = [
    {
      functionDeclarations: [
        {
          name: 'findProducts',
          description: 'Extract shopping intent from a user query for product search',
          parameters: {
            type: 'OBJECT',
            properties: {
              category: { type: 'STRING', description: 'Category slug or name e.g., smartphones, laptops, accessories, books, clothes, instruments' },
              minPrice: { type: 'NUMBER', description: 'Minimum price in VND' },
              maxPrice: { type: 'NUMBER', description: 'Maximum price in VND' },
              condition: { type: 'STRING', description: 'new | used' },
              keywords: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Optional keyword terms' },
            },
          },
        },
      ],
    },
  ];

  const req = {
    contents: [
      {
        role: 'user',
        parts: [{ text: query || '' }],
      },
    ],
    tools,
    toolConfig: { functionCallingConfig: { mode: 'ANY' } },
  };

  const res = await model.generateContent(req);
  const out = res?.response;
  const calls = out?.functionCalls || out?.candidates?.[0]?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall) || [];

  const first = Array.isArray(calls) && calls.length ? calls[0] : null;
  const args = first?.args || {};

  // Normalize
  const category = args.category != null ? String(args.category) : null;
  const minPrice = toNumberOrNull(args.minPrice);
  const maxPrice = toNumberOrNull(args.maxPrice);
  const condition = args.condition != null ? String(args.condition).toLowerCase() : null;
  const keywords = ensureArrayOfStrings(args.keywords);

  return { category, minPrice, maxPrice, condition, keywords };
}

module.exports = { getIntentFromGemini };


