// In src/routes/server/history/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, readFile } from 'fs/promises';
import { json } from '@sveltejs/kit';
import { v4 as uuidv4 } from 'uuid'; // Install with `bun add uuid`

interface Message {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

interface ChatHistory {
  [chatId: string]: Message[];
}

const HISTORY_FILE = `${process.cwd()}/user_history.json`; // Absolute path for reliability

async function getHistory(): Promise<ChatHistory> {
  try {
    const data = await readFile(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return {};
  } catch (error) {
    console.error('Error reading history:', error);
    return {};
  }
}

async function saveHistory(history: ChatHistory) {
  try {
    const maxChats = 10; // Limit to last 10 chats
    const trimmedHistory = Object.fromEntries(
      Object.entries(history).slice(-maxChats)
    );
    await writeFile(HISTORY_FILE, JSON.stringify(trimmedHistory, null, 2));
  } catch (error) {
    console.error('Error saving history:', error);
    throw new Error('Failed to save history');
  }
}

async function createNewChat(): Promise<string> {
  const chatId = uuidv4(); // Generate a unique ID
  const history = await getHistory();
  history[chatId] = [];
  await saveHistory(history);
  return chatId;
}

export const GET: RequestHandler = async ({ url }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  const chatId = url.searchParams.get('chatId');
  const history = await getHistory();
  if (chatId && history[chatId]) {
    return json(history[chatId], { headers: corsHeaders });
  }
  return json(Object.keys(history), { headers: corsHeaders }); // Return chat IDs
};

export const POST: RequestHandler = async ({ request }) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  try {
    const { chatId, messages } = await request.json();
    if (!chatId || !Array.isArray(messages)) {
      return json({ error: 'Invalid chatId or messages format' }, { status: 400, headers: corsHeaders });
    }

    const history = await getHistory();
    history[chatId] = messages;
    await saveHistory(history);
    return json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('Server error:', error);
    return json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
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