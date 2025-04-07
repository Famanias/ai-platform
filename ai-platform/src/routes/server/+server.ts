// In src/routes/server/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, readFile } from 'fs/promises';
import { env } from '$env/dynamic/private';
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

    const apiKey = env.GROQ_API_KEY;

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'user', content: fullPrompt }],
          temperature: 0.3,
          max_tokens: 1024
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log('API Error:', errorText);
      return json({ error: `Failed to get response from Model: ${errorText}` }, { status: 500, headers: corsHeaders });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'No response generated';
    console.log('Model reply:', response);
    
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