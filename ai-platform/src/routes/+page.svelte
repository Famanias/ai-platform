<script lang="ts">
  let inputText: string = '';
  let response: string = ''; // Final response text to display
  let displayedResponse: string = ''; // Text being typed out
  let error: string = '';
  let thinking: string = ''; // Current displayed thinking text
  let rawThinking: string = 'Processing your request...'; // Raw <think> content
  let isThinking: boolean = false;
  let displayThinking: boolean = false;
  let displayResponse: boolean = false; // Controls response typing animation
  let messages: { role: 'user' | 'ai', content: string }[] = []; // Store conversation history

  // Function to strip <think> tags and extract the final reply
  function cleanResponse(rawResponse: string): string {
    const thinkMatch = rawResponse.match(/<think>[\s\S]*<\/think>\s*([\s\S]*)/);
    return thinkMatch && thinkMatch[1]
      ? thinkMatch[1].trim()
      : "It looks like I got stuck thinking. Please try asking again or rephrase your question!";
  }

  // Extract <think> content for typing
  function extractThinking(rawResponse: string): string {
    const thinkMatch = rawResponse.match(/<think>([\s\S]*)<\/think>/);
    return thinkMatch && thinkMatch[1] ? thinkMatch[1].trim() : 'Processing your request...';
  }

  // Simulate typing animation for thinking
  async function typeThinking(text: string) {
    thinking = '';
    displayThinking = true;
    const typingSpeed = 25; // Milliseconds per character
    for (let i = 0; i < text.length; i++) {
      thinking = text.slice(0, i + 1);
      await new Promise(resolve => setTimeout(resolve, typingSpeed));
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Linger time
    displayThinking = false; // Trigger fade-out
  }

  // Simulate typing animation for response
  async function typeResponse(text: string) {
    displayedResponse = ''; // Reset displayed text
    displayResponse = true; // Start animation
    const typingSpeed = 10; // Milliseconds per character
    for (let i = 0; i < text.length; i++) {
      displayedResponse = text.slice(0, i + 1);
      await new Promise(resolve => setTimeout(resolve, typingSpeed));
    }
    displayResponse = false; // End animation
    messages = [...messages, { role: 'ai', content: text }]; // Add to history after typing
  }

  async function submitInput() {
    if (!inputText.trim()) return; // Prevent empty submissions

    // Add user message to conversation history
    messages = [...messages, { role: 'user', content: inputText }];

    try {
      response = '';
      displayedResponse = '';
      error = '';
      displayResponse = false; // Reset response visibility
      isThinking = true;
      displayThinking = true;
      thinking = 'Processing your request...';

      const res = await fetch('/server', {
        method: 'POST',
        body: JSON.stringify({ text: inputText }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Request failed with status ${res.status}`);
      }

      const data = await res.json();
      rawThinking = extractThinking(data.reply);
      response = cleanResponse(data.reply); // Precompute response
      await typeThinking(rawThinking); // Type out thinking content
      await new Promise(resolve => setTimeout(resolve, 300)); // Transition gap
      await typeResponse(response); // Type out response content
    } catch (err) {
      if (err instanceof Error) {
        error = err.message || 'Failed to connect to the server. Please try again.';
      } else {
        error = String(err) || 'An unexpected error occurred. Please try again.';
      }
      displayThinking = false;
    } finally {
      isThinking = false;
      inputText = ''; // Clear input after submission
    }
  }
</script>

<main class="min-h-screen bg-gray-50 flex flex-col font-sans">
  <!-- Header -->
  <header class="bg-white shadow-sm p-4">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-2xl font-bold text-gray-800">AI Platform</h1>
      <p class="text-sm text-gray-500">Your context-aware assistant</p>
    </div>
  </header>

  <!-- Chat Container -->
  <div class="flex-1 max-w-3xl mx-auto w-full p-4 flex flex-col">
    <div class="flex-1 bg-white rounded-lg shadow-md p-4 overflow-y-auto mb-4">
      {#if messages.length === 0 && !displayThinking && !displayResponse}
        <div class="text-center text-gray-500 py-4">
          Start a conversation by typing a message below!
        </div>
      {/if}

      {#each messages as message}
        <div
          class="mb-4 flex {message.role === 'user' ? 'justify-end' : 'justify-start'}"
        >
          <div
            class="{message.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-800'} p-3 rounded-lg max-w-[75%] shadow-sm"
          >
            {#if message.role === 'ai'}
              <span class="font-semibold text-blue-600">AI:</span>
            {/if}
            <p>{message.content}</p>
          </div>
        </div>
      {/each}

      {#if displayThinking}
        <div class="mb-4 flex justify-start">
          <div
            class="bg-gray-200 text-gray-600 p-3 rounded-lg max-w-[75%] shadow-sm"
          >
            <span class="font-semibold">Thinking:</span>
            <p>{thinking}</p>
          </div>
        </div>
      {/if}

      {#if displayResponse}
        <div class="mb-4 flex justify-start">
          <div class="bg-gray-100 text-gray-800 p-3 rounded-lg max-w-[75%] shadow-sm">
            <span class="font-semibold text-blue-600">AI:</span>
            <p>{displayedResponse}</p>
          </div>
        </div>
      {/if}
    </div>

    <!-- Input Form -->
    <form on:submit|preventDefault={submitInput} class="flex gap-3">
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
      </div>
    {/if}
  </div>
</main>