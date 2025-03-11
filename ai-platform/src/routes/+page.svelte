<script lang="ts">
  let inputText: string = '';
  let response: string = '';
  let error: string = '';
  let thinking: string = ''; // Holds the raw response with <think> tags
  let isThinking: boolean = false; // Tracks if the app is in the thinking state

  // Function to strip <think> tags and extract the final reply
  function cleanResponse(rawResponse: string): string {
    console.log('Raw response:', rawResponse); // Debug log
    const thinkMatch = rawResponse.match(/<think>.*<\/think>\s*(.*)/s);
    if (thinkMatch && thinkMatch[1]) {
      return thinkMatch[1].trim(); // Extract text after </think>
    }
    return rawResponse.trim(); // Fallback if no <think> tags
  }

  async function submitInput() {
    try {
      // Reset previous states
      response = '';
      error = '';
      thinking = '';
      isThinking = true;
      console.log('Starting request, isThinking:', isThinking); // Debug log

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
      console.log('Received data:', data); // Debug log
      thinking = data.reply; // Store the raw response with <think> tags
      response = cleanResponse(data.reply); // Clean it for the final display
    } catch (err) {
      if (err instanceof Error) {
        error = err.message || 'Failed to connect to the server. Please try again.';
        console.error('Fetch error:', err);
      } else {
        error = String(err) || 'An unexpected error occurred. Please try again.';
        console.error('Unexpected error:', err);
      }
    } finally {
      isThinking = false; // End thinking state
      console.log('Request complete, isThinking:', isThinking); // Debug log
    }
  }
</script>

<style>
  .thinking {
    opacity: 0.5; /* 50% opacity */
    color: #666; /* Gray color */
    transition: opacity 0.3s ease, height 0.3s ease; /* Smooth fade-out and height collapse */
    overflow: hidden; /* Prevents content overflow during transition */
  }
  .thinking.hidden {
    opacity: 0; /* Fully transparent when hidden */
    height: 0; /* Collapse height */
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
  {#if isThinking && thinking}
    <div class="mt-4 p-4 thinking" class:hidden={!isThinking}>
      <h2 class="font-semibold">Thinking:</h2>
      <p>{thinking}</p>
    </div>
  {/if}
  {#if response}
    <div class="mt-4 p-4 bg-gray-100 rounded">
      <h2 class="font-semibold">Response:</h2>
      <p>{response}</p>
    </div>
  {/if}
  {#if error}
    <div class="mt-4 p-4 bg-red-100 text-red-700 rounded">
      <h2 class="font-semibold">Error:</h2>
      <p>{error}</p>
    </div>
  {/if}
</main>