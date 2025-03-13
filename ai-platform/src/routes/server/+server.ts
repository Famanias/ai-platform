// In src/routes/server/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, readFile } from 'fs/promises';
import { json } from '@sveltejs/kit';

async function fetchWithRetry(url: string, options: RequestInit, retries: number = 3, delay: number = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status === 503) {
      console.log(`503 Service Unavailable, retrying (${i + 1}/${retries}) after ${delay}ms...`);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
    return response;
  }
  throw new Error('Max retries reached for 503 Service Unavailable');
}

const HISTORY_FILE = 'user_history.json';

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

async function getHistory(): Promise<Message[]> {
  try {
    const data = await readFile(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) throw new Error('Invalid history format');
    return parsed;
  } catch (error) {
    console.error('Error reading history:', error);
    return [];
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const { text } = await request.json();
    if (!text) {
      return json({ error: 'Text input is required' }, { status: 400, headers: corsHeaders });
    }

    console.log('Received text:', text);
    const history = await getHistory();
    const userInputs = history.filter(msg => msg.role === 'user').map(msg => msg.content);
    const context = userInputs.length ? `Previous inputs: ${userInputs.join(', ')}. ` : '';

    const ollamaResponse = await fetchWithRetry(
      'http://localhost:11434/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-r1:7b',
          messages: [{ role: 'user', content: `${context}Given this input: "${text}", provide a context-aware suggestion or response.` }],
          stream: false,
          options: { temperature: 0.6, num_predict: 500 },
        }),
      },
      3,
      2000
    );

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();
      console.log('Ollama API Error:', errorText);
      return json({ error: `Failed to get response from Ollama: ${errorText}` }, { status: 500, headers: corsHeaders });
    }

    const data = await ollamaResponse.json();
    const reply = data.message?.content || 'No response generated';
    return json({ reply }, { headers: corsHeaders });
  } catch (error) {
    console.error('Server error:', error);
    return json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
};

export const GET: RequestHandler = async () => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  return new Response('AI Platform Server Endpoint is running!', {
    headers: corsHeaders,
  });
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:5173',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};