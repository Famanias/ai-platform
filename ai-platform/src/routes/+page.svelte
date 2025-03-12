<script lang="ts">
  let inputText: string = '';
  let response: string = ''; // Final response text to display
  let displayedResponse: string = ''; // Text being typed out
  let error: string = '';
  let thinking: string = ''; // Current displayed thinking text
  let rawThinking: string = 'Processing your request...'; // Raw <think> content
  let isThinking: boolean = false;
  let displayThinking: boolean = false;
  let displayResponse: boolean = false; // Controls response visibility and animation trigger

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
    // Pause before fading out thinking
    await new Promise(resolve => setTimeout(resolve, 1000)); // Linger time
    displayThinking = false; // Trigger fade-out
  }

  // Simulate typing animation for response
  async function typeResponse(text: string) {
    displayedResponse = ''; // Reset displayed text
    displayResponse = true; // Show response box and start animation
    const typingSpeed = 10; // Milliseconds per character (adjustable)
    for (let i = 0; i < text.length; i++) {
      displayedResponse = text.slice(0, i + 1);
      await new Promise(resolve => setTimeout(resolve, typingSpeed));
    }
  }

  async function submitInput() {
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
    }
  }
</script>

<style>
  .thinking {
    opacity: 0.7;
    color: #666;
    transition: opacity 0.5s ease-out, height 1s ease-in;
    overflow: hidden;
    white-space: pre-wrap;
  }
  .thinking.hidden {
    opacity: 0;
    height: 0;
  }
  .response {
    opacity: 0; /* Start hidden */
    transition: opacity 0.5s ease; /* Fade-in for the container */
  }
  .response.visible {
    opacity: 1; /* Fully visible */
  }
</style>

<main class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">AI Platform</h1>
  <form on:submit|preventDefault={submitInput} class="space-y-4">
    <textarea
      bind:value={inputText}
      placeholder="Tell me something..."
      class="w-full p-2 border rounded"
    ></textarea>
    <button type="submit" class="bg-blue-500 text-white p-2 rounded">Submit</button>
  </form>
  {#if displayThinking}
    <div class="mt-4 p-4 thinking" class:hidden={!displayThinking}>
      <h2 class="font-semibold">Thinking:</h2>
      <p>{thinking}</p>
    </div>
  {/if}
  {#if displayResponse}
    <div class="mt-4 p-4 bg-gray-100 rounded response" class:visible={displayResponse}>
      <h2 class="font-semibold">Response:</h2>
      <p>{displayedResponse}</p>
    </div>
  {/if}
  {#if error}
    <div class="mt-4 p-4 bg-red-100 text-red-700 rounded">
      <h2 class="font-semibold">Error:</h2>
      <p>{error}</p>
    </div>
  {/if}
</main>