<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition'; // Import slide transition

  let inputText: string = '';
  let response: string = '';
  let displayedResponse: string = '';
  let error: string = '';
  let thinking: string = '';
  let rawThinking: string = 'Processing your request...';
  let isThinking: boolean = false;
  let displayThinking: boolean = false;
  let displayResponse: boolean = false;
  let messages: Message[] = [];
  let chatContainer: HTMLDivElement;
  let availableChats: string[] = [];
  let currentChatId: string | null = null;
  let showHistory: boolean = false; // Toggle for history sidebar

  interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp: string;
  }

  onMount(async () => {
    try {
      const res = await fetch('/server/history');
      if (res.ok) {
        availableChats = await res.json();
        if (availableChats.length > 0) {
          currentChatId = availableChats[0]; // Load the most recent chat by default
          await loadChat(currentChatId);
        } else {
          currentChatId = await createNewChat();
          availableChats = [currentChatId];
        }
      }
    } catch (error) {
      console.error('Failed to load chats:', error);
      error = 'Failed to load chat history. Please try again.';
    }
  });

  async function createNewChat(): Promise<string> {
    try {
      const res = await fetch('/server/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: null, messages: [] }),
      });
      if (!res.ok) {
        throw new Error('Failed to create new chat');
      }
      const data = await res.json();
      const chatId = data.chatId;
      availableChats = [...availableChats, chatId];
      if (currentChatId) await saveMessages(); // Save current chat before switching
      currentChatId = chatId;
      messages = [];
      showHistory = false; // Close sidebar after creating new chat
      return chatId;
    } catch (error) {
      console.error('Error creating new chat:', error);
      error = 'Failed to create new chat. Please try again.';
      throw error;
    }
  }

  async function loadChat(chatId: string) {
    try {
      const res = await fetch(`/server/history?chatId=${chatId}`);
      if (res.ok) {
        messages = await res.json();
        currentChatId = chatId;
        showHistory = false; // Close sidebar after selection
        chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
      } else {
        throw new Error('Failed to load chat');
      }
    } catch (error) {
      console.error('Error loading chat:', error);
      error = 'Failed to load chat. Please try again.';
    }
  }

  async function saveMessages() {
    if (currentChatId) {
      try {
        await fetch('/server/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: currentChatId, messages }),
        });
      } catch (error) {
        console.error('Error saving messages:', error);
        error = 'Failed to save messages. Please try again.';
      }
    }
  }

  async function deleteChat(chatId: string) {
    if (!confirm('Are you sure you want to delete this chat?')) return;
    try {
      const res = await fetch(`/server/history?chatId=${chatId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete chat');
      }
      availableChats = availableChats.filter(id => id !== chatId);
      if (currentChatId === chatId) {
        if (availableChats.length > 0) {
          // Load the first available chat
          currentChatId = availableChats[0];
          await loadChat(currentChatId);
        } else {
          // Create a new chat if no chats remain
          currentChatId = await createNewChat();
          availableChats = [currentChatId];
        }
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      error = 'Failed to delete chat. Please try again.';
    }
  }

  function cleanResponse(rawResponse: string): string {
    const thinkMatch = rawResponse.match(/<think>[\s\S]*<\/think>\s*([\s\S]*)/);
    return thinkMatch && thinkMatch[1] ? thinkMatch[1].trim() : "It looks like I got stuck thinking. Please try again!";
  }

  function extractThinking(rawResponse: string): string {
    const thinkMatch = rawResponse.match(/<think>([\s\S]*)<\/think>/);
    return thinkMatch && thinkMatch[1] ? thinkMatch[1].trim() : 'Processing your request...';
  }

  async function typeThinking(text: string) {
    thinking = '';
    displayThinking = true;
    const typingSpeed = 25;
    for (let i = 0; i < text.length; i++) {
      thinking = text.slice(0, i + 1);
      await new Promise(resolve => setTimeout(resolve, typingSpeed));
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    displayThinking = false;
  }

  async function typeResponse(text: string) {
    displayedResponse = '';
    displayResponse = true;
    const typingSpeed = 10;
    for (let i = 0; i < text.length; i++) {
      displayedResponse = text.slice(0, i + 1);
      await new Promise(resolve => setTimeout(resolve, typingSpeed));
    }
    displayResponse = false;
    messages = [...messages, { role: 'ai', content: text, timestamp: new Date().toLocaleTimeString() }];
    await saveMessages();
  }

  async function submitInput() {
    if (!inputText.trim() || !currentChatId) return;

    messages = [...messages, { role: 'user', content: inputText, timestamp: new Date().toLocaleTimeString() }];
    await saveMessages();

    try {
      response = '';
      displayedResponse = '';
      error = '';
      displayResponse = false;
      isThinking = true;
      displayThinking = true;
      thinking = 'Processing your request...';

      const res = await fetch('/server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      rawThinking = extractThinking(data.reply);
      response = cleanResponse(data.reply);
      await typeThinking(rawThinking);
      await new Promise(resolve => setTimeout(resolve, 300));
      await typeResponse(response);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err) || 'An unexpected error occurred.';
      displayThinking = false;
    } finally {
      isThinking = false;
      inputText = '';
    }
  }
</script>

<main class="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col font-sans relative">
  <header class="bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md p-4 z-50">
    <div class="max-w-3xl mx-auto flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold">AI Platform</h1>
        <p class="text-sm">Your context-aware assistant</p>
      </div>
      <button
        on:click={() => (showHistory = !showHistory)}
        class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
      >
        History
      </button>
    </div>
  </header>

  <!-- History Sidebar (Animated) -->
  {#if showHistory}
    <div
      class="fixed top-0 left-0 h-full bg-white shadow-lg w-64 p-4 z-50"
      transition:slide={{ duration: 300, axis: 'x' }}
    >
      <h2 class="text-lg font-semibold text-gray-800 mb-2">Chat History</h2>
      <button
        on:click={() => createNewChat()}
        class="w-full bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg mb-2"
      >
        New Chat
      </button>
      {#each availableChats as chatId}
        <div class="flex items-center w-full mb-1">
          <button
            on:click={() => loadChat(chatId)}
            class="flex-1 text-left p-2 bg-gray-100 hover:bg-gray-200 rounded-lg {currentChatId === chatId ? 'bg-blue-200' : ''}"
          >
            Chat {chatId.slice(0, 8)}...
          </button>
          <button
            on:click={() => deleteChat(chatId)}
            class="ml-2 text-red-500 hover:text-red-700"
          >
            🗑️
          </button>
        </div>
      {/each}
      <button on:click={() => (showHistory = false)} class="mt-4 text-red-500 hover:underline">Close</button>
    </div>
  {/if}

  <div class="flex-1 max-w-3xl mx-auto w-full p-4 sm:p-6 flex flex-col z-50">
    <div bind:this={chatContainer} class="flex-1 bg-white rounded-lg shadow-md p-4 overflow-y-auto mb-4">
      {#if messages.length === 0 && !displayThinking && !displayResponse && !messages.some(m => m.content)}
        <div class="text-center text-gray-500 py-4">
          Start a conversation by typing a message below!
        </div>
      {/if}

      {#each messages.filter(m => m.content && m.timestamp) as message}
        <div class="mb-4 flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
          <div class="{message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800 border-l-4 border-blue-500'} p-3 rounded-lg max-w-[75%] shadow-sm flex items-start">
            <span class="mr-2">{message.role === 'user' ? '👤' : '🤖'}</span>
            <div>
              <p>{message.content}</p>
              {#if message.role === 'user'}
                <p class="text-xs text-gray-300 mt-1">{message.timestamp}</p>
              {/if}
              {#if message.role === 'ai'}
                <p class="text-xs text-gray-500 mt-1">{message.timestamp}</p>
              {/if}
              <!-- <p class="text-xs text-gray-500 mt-1">{message.timestamp}</p> -->
            </div>
          </div>
        </div>
      {/each}

      {#if displayThinking}
        <div class="mb-4 flex justify-start">
          <div class="bg-gray-200 text-gray-600 p-3 rounded-lg max-w-[75%] shadow-sm">
            <span class="font-semibold">Thinking:</span>
            <p>{thinking}</p>
          </div>
        </div>
      {/if}

      {#if displayResponse}
        <div class="mb-4 flex justify-start">
          <div class="bg-gray-100 text-gray-800 border-l-4 border-blue-500 p-3 rounded-lg max-w-[75%] shadow-sm">
            <span class="font-semibold text-blue-600">AI:</span>
            <p>{displayedResponse}</p>
          </div>
        </div>
      {/if}
    </div>

    <form on:submit|preventDefault={submitInput} class="flex flex-col sm:flex-row gap-3">
      <textarea
        bind:value={inputText}
        placeholder="Type your message..."
        rows="2"
        class="flex-1 p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      ></textarea>
      <button
        type="submit"
        disabled={isThinking}
        class="bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-lg shadow-md transition disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {#if isThinking}
          <span class="animate-pulse">...</span>
        {:else}
          Send
        {/if}
      </button>
    </form>

    {#if error}
      <div class="mt-4 p-4 bg-red-100 text-red-700 rounded-lg">
        <h2 class="font-semibold">Error:</h2>
        <p>{error}</p>
        <button on:click={submitInput} class="mt-2 text-blue-500 hover:underline">Retry</button>
      </div>
    {/if}
  </div>
</main>