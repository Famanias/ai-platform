<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let inputText: string = '';
  let response: string = '';
  let displayedResponse: string = '';
  let error: string = '';
  let displayResponse: boolean = false;
  let messages: Message[] = [];
  let chatContainer: HTMLDivElement;
  let availableChats: string[] = [];
  let currentChatId: string | null = null;
  let showHistory: boolean = false;
  let abortController: AbortController | null = null;
  let shouldStop: boolean = false;

  interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp: string;
  }

  onMount(async () => {
    try {
      console.log('Initializing with a temporary empty chat...');
      currentChatId = null;
      messages = [];

      console.log('Fetching existing chat history...');
      const res = await fetch('/server/history');
      if (!res.ok) {
        throw new Error('Failed to fetch chat history');
      }
      availableChats = await res.json();

      console.log('Current chat ID:', currentChatId);
      console.log('Available chats:', availableChats);
      chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
    } catch (error) {
      console.error('Failed to initialize:', error);
      error = 'Failed to load chat history. Please try again.';
    }
  });

  async function createNewChat(messagesToSave: Message[] = []): Promise<string> {
    try {
      const res = await fetch('/server/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: null, messages: messagesToSave }),
      });
      if (!res.ok) {
        throw new Error('Failed to create new chat');
      }
      const data = await res.json();
      const chatId = data.chatId;
      availableChats = [...availableChats, chatId];
      showHistory = false;
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
        showHistory = false;
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
        currentChatId = null;
        messages = [];
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      error = 'Failed to delete chat. Please try again.';
    }
  }

  function cleanResponse(rawResponse: string): string {
    return rawResponse.trim() || "I couldn't generate a response. Please try again!";
  }

  async function typeResponse(text: string, userMessage: Message) {
    displayedResponse = '';
    displayResponse = true;
    const typingSpeed = 10;
    for (let i = 0; i < text.length && !shouldStop; i++) {
      displayedResponse = text.slice(0, i + 1);
      await new Promise(resolve => setTimeout(resolve, typingSpeed));
    }
    displayResponse = false;
    if(!shouldStop) {
      messages = [...messages, { role: 'ai', content: text, timestamp: new Date().toLocaleTimeString() }];
      await saveMessages();
    }else{
      messages = messages.filter(m => m !== userMessage);
    }
    chatContainer?.scrollTo({ top: chatContainer.scrollHeight, behavior: 'smooth' });
  }

  async function submitInput() {
    if (!inputText.trim()) return;

    const userMessage = { 
      role: 'user' as const, 
      content: inputText, 
      timestamp: new Date().toLocaleTimeString() 
    };
    messages = [...messages, userMessage];

    let shouldCreateNewChat = currentChatId === null;

    try {
      response = '';
      displayedResponse = '';
      error = '';
      displayResponse = false;
      shouldStop = false;

      abortController = new AbortController();

      const res = await fetch('/server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
        signal: abortController.signal
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      response = cleanResponse(data.reply);
      if(!shouldStop) {
        await new Promise(resolve => setTimeout(resolve, 300));
        await typeResponse(response, userMessage);
        if (shouldCreateNewChat) {
          currentChatId = await createNewChat(messages);
        } else {
          await saveMessages();
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        await new Promise(resolve => setTimeout(resolve, 500));
        messages = messages.filter(m => m !== userMessage);
      }else{
        error = err instanceof Error ? err.message : String(err) || 'An unexpected error occurred.';
        if (shouldCreateNewChat) {
          currentChatId = await createNewChat(messages);
        } else {
          await saveMessages();
        }
      }
    } finally {
      inputText = '';
      abortController = null;
      shouldStop = false;
    }
  }

  function stopRequest() {
    if (abortController) {
      abortController.abort();
    }
    shouldStop = true;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitInput();
    }
  }
</script>

<main class="chat-app">
  <div class="chat-content">
    <button
      class="toggle-button {showHistory ? 'active' : ''}" on:click={() => (showHistory = !showHistory)}
      title={showHistory ? 'Hide History' : 'Show History'}
      aria-label={showHistory ? 'Hide History' : 'Show History'}>
      <img src="/32223.png" alt="Show history" class="icon" transition:fade={{ duration: 200 }} />
    </button>
    <div class="chat-container" bind:this={chatContainer}>
      {#if messages.length === 0 && !displayResponse && !messages.some(m => m.content)}
        <div class="text-center py-4">
          Start a conversation by typing a message below!
        </div>
      {/if}
      {#each messages.filter(m => m.content && m.timestamp) as message}
        <div class="message-wrapper {message.role}">
          <div class="message {message.role === 'user' ? 'user-message' : 'ai-message'}">
            <span>{message.role === 'user' ? '👤' : '🤖'}</span>
            <div>
              <p>{message.content}</p>
              <p class="timestamp">{message.timestamp}</p>
            </div>
          </div>
        </div>
      {/each}
      {#if displayResponse}
        <div class="message-wrapper ai">
          <div class="ai-message">
            <span class="label">AI:</span>
            <p>{displayedResponse}</p>
          </div>
        </div>
      {/if}
    </div>
    <div class="input-area">
      <form class="chat-form" on:submit|preventDefault={submitInput}>
        <textarea 
          class="chat-input" 
          bind:value={inputText} 
          placeholder="Type your message.." 
          rows="2" 
          on:keydown={handleKeydown}
        ></textarea>
        
          <button 
            type="submit" 
            class="submit-button" 
            disabled={!inputText.trim()}
            aria-label="Submit message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="#252525" style="width: 1.25rem; height: 1.25rem;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
      </form>
    </div>
  </div>
  {#if showHistory}
    <div class="sidebar" transition:fade={{ duration: 300}}>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2>Chat History</h2>
        <button class="close-button" on:click={() => (showHistory = false)} aria-label="Close history">✕</button>
      </div>
      <button
        class="new-chat-button"
        on:click={() => {
          currentChatId = null;
          messages = [];
          showHistory = false;
        }}
      >
        New Chat
      </button>
      {#each availableChats as chatId}
        <div style="display: flex; align-items: center; width: 100%; margin-bottom: 0.25rem;">
          <button
            class="chat-item {currentChatId === chatId ? 'selected' : ''}"
            on:click={() => loadChat(chatId)}
          >
            <p>Chat {chatId.slice(0, 8)}...</p>
            <p>Yesterday</p>
          </button>
          <button class="delete-button" on:click={() => deleteChat(chatId)} aria-label="Delete chat">🗑️</button>
        </div>
      {/each}
    </div>
  {/if}
</main>