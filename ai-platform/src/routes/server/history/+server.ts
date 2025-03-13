// In src/routes/server/history/+server.ts
import type { RequestHandler } from '@sveltejs/kit';
import { writeFile, readFile } from 'fs/promises';
import { json } from '@sveltejs/kit';
import { v4 as uuidv4 } from 'uuid';

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

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const GET: RequestHandler = async ({ url }) => {
  const chatId = url.searchParams.get('chatId');
  const history = await getHistory();
  if (chatId && history[chatId]) {
    return json(history[chatId], { headers: corsHeaders });
  }
  return json(Object.keys(history), { headers: corsHeaders }); // Return chat IDs
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { chatId, messages } = await request.json();
    const history = await getHistory();

    if (chatId === null) {
      // Create new chat
      const newChatId = await createNewChat();
      return json({ chatId: newChatId }, { headers: corsHeaders });
    }

    if (!chatId || !Array.isArray(messages)) {
      return json({ error: 'Invalid chatId or messages format' }, { status: 400, headers: corsHeaders });
    }

    history[chatId] = messages;
    await saveHistory(history);
    return json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error('Server error:', error);
    return json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
};

export const DELETE: RequestHandler = async ({ url }) => {
  const chatId = url.searchParams.get('chatId');
  if (!chatId) {
    return json({ error: 'Chat ID is required' }, { status: 400, headers: corsHeaders });
  }

  const history = await getHistory();
  if (!(chatId in history)) {
    return json({ error: 'Chat not found' }, { status: 404, headers: corsHeaders });
  }

  delete history[chatId];
  await saveHistory(history);
  return json({ success: true }, { headers: corsHeaders });
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};