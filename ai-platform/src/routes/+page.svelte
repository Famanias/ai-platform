<script lang="ts">
    let inputText: string = '';
    let response: string = '';
  
    async function submitInput() {
      const res = await fetch('http://localhost:3000/api/process', {
        method: 'POST',
        body: JSON.stringify({ text: inputText }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      response = data.reply;
    }
  </script>
  
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
    {#if response}
      <div class="mt-4 p-4 bg-gray-100 rounded">
        <h2 class="font-semibold">Response:</h2>
        <p>{response}</p>
      </div>
    {/if}
  </main>