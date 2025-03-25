// In src/routes/server/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, readFile } from 'fs/promises';
import { json } from '@sveltejs/kit';

const HISTORY_FILE = `${process.cwd()}/user_history.json`;
const USER_INFO_FILE = `${process.cwd()}/user_information.json`;
const MODEL_INFO_FILE = `${process.cwd()}/model_information.json`;

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

interface UserInfo {
  name: string;
  age: number;
  gender: string;
  personality: string[];
  interests: string[];
  location: string;
  tone_preference: string;
}

interface ModelInfo {
  name: string;
  alias: string;
  description: string;
  tone: string;
}

// Load user information
async function getUserInfo(): Promise<UserInfo | null> {
  try {
    const data = await readFile(USER_INFO_FILE, 'utf8');
    const parsed = JSON.parse(data).user_information;
    if (parsed && typeof parsed === 'object') return parsed as UserInfo;
    throw new Error('Invalid user info format');
  } catch (error) {
    console.error('Error reading user info:', error);
    return null;
  }
}

// Load model information
async function getModelInfo(): Promise<ModelInfo | null> {
  try {
    const data = await readFile(MODEL_INFO_FILE, 'utf8');
    const parsed = JSON.parse(data).model_information;
    if (parsed && typeof parsed === 'object') return parsed as ModelInfo;
    throw new Error('Invalid model info format');
  } catch (error) {
    console.error('Error reading model info:', error);
    return null; // Fallback if file doesn’t exist
  }
}

// Existing getHistory function
async function getHistory(): Promise<Message[]> {
  try {
    const data = await readFile(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.values(parsed).flat() as Message[];
    }
    throw new Error('Invalid history format');
  } catch (error) {
    console.error('Error reading history:', error);
    return [];
  }
}

// Existing fetchWithRetry function (unchanged)
async function fetchWithRetry(url: string, options: RequestInit, retries: number = 3, delay: number = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);
    if (response.status === 503) {
      console.log(`503 Service Unavailable, retrying (${i + 1}/${retries}) after ${delay}ms...`);
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    return response;
  }
  throw new Error('Max retries reached for 503 Service Unavailable');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { text } = await request.json();
    if (!text) {
      return json({ error: 'Text input is required' }, { status: 400, headers: corsHeaders });
    }

    console.log('Received text:', text);
    const history = await getHistory();
    const userInfo = await getUserInfo();
    const modelInfo = await getModelInfo();

    const userInputs = history.filter(msg => msg.role === 'user').map(msg => msg.content);
    const historyContext = userInputs.length ? `Previous inputs: ${userInputs.join(', ')}. ` : '';

    // Build user info context
    const userContext = userInfo
      ? `User info: Name: ${userInfo.name}, Age: ${userInfo.age}, Personality: ${userInfo.personality.join(', ')}, Location: ${userInfo.location}, Interests: ${userInfo.interests.join(', ')}, Preferred tone: ${userInfo.tone_preference}. `
      : 'No user info available. ';

    // Build model info context
    const modelContext = modelInfo
      ? `I am ${modelInfo.name} (aka ${modelInfo.alias}), ${modelInfo.description}. My tone is ${modelInfo.tone}. `
      : 'I’m a nameless AI, just here to help. ';

    const fullPrompt = `${modelContext}${userContext}${historyContext}Given this input: "${text}", provide a context-aware suggestion or response.`;

    const ollamaResponse = await fetchWithRetry(
      'http://localhost:11434/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'deepseek-r1:7b',
          messages: [{ role: 'user', content: fullPrompt }],
          stream: false,
          options: { temperature: 0.6, num_predict: 600 },
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
  return new Response('AI Platform Server Endpoint is running!', {
    headers: corsHeaders,
  });
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};