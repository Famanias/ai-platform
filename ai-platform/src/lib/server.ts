// import { serve } from 'bun';
// import { writeFile, readFile } from 'fs/promises';
// import * as dotenv from 'dotenv';

// // Access the API token from the environment
// dotenv.config();

// const HF_API_TOKEN = process.env.HF_API_TOKEN || '';
// const HISTORY_FILE = 'user_history.json';

// async function getHistory(): Promise<string[]> {
//   try {
//     const data = await readFile(HISTORY_FILE, 'utf8');
//     return JSON.parse(data);
//   } catch {
//     return [];
//   }
// }

// async function saveHistory(text: string) {
//   const history = await getHistory();
//   history.push(text);
//   await writeFile(HISTORY_FILE, JSON.stringify(history));
// }

// serve({
//   port: 3000,
//   async fetch(req) {
//     // Handle CORS preflight (OPTIONS) requests
//     if (req.method === 'OPTIONS') {
//       return new Response(null, {
//         status: 204,
//         headers: {
//           'Access-Control-Allow-Origin': 'http://localhost:5173',
//           'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//           'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//         },
//       });
//     }

//     const corsHeaders = {
//       'Access-Control-Allow-Origin': 'http://localhost:5173',
//       'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//     };

//     // Handle GET request to root (/)
//     if (req.method === 'GET' && req.url === 'http://localhost:3000/') {
//       return new Response('AI Platform Server is running!', {
//         headers: corsHeaders,
//       });
//     }

//     // Handle POST request to /api/process
//     if (req.method === 'POST' && req.url.endsWith('/api/process')) {
//       const { text } = await req.json();
//       await saveHistory(text);

//       const history = await getHistory();
//       const context = history.length ? `Previous inputs: ${history.join(', ')}. ` : '';

//       const hfResponse = await fetch('https://api-inference.huggingface.co/models/Qwen/Qwen2-7B-Instruct', {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${HF_API_TOKEN}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           inputs: `${context}Given this input: "${text}", provide a context-aware suggestion or response.`,
//           parameters: {
//             max_length: 150,
//             temperature: 0.7,
//           },
//         }),
//       });

//       if (!hfResponse.ok) {
//         const errorText = await hfResponse.text();
//         console.log('Hugging Face API Error:', errorText);
//         return new Response(JSON.stringify({ error: `Failed to get response from Hugging Face: ${errorText}` }), {
//           status: 500,
//           headers: { 'Content-Type': 'application/json', ...corsHeaders },
//         });
//       }

//       const data = await hfResponse.json();
//       const reply = Array.isArray(data) ? data[0].generated_text : data.generated_text || 'No response generated';
//       return new Response(JSON.stringify({ reply }), {
//         headers: { 'Content-Type': 'application/json', ...corsHeaders },
//       });
//     }

//     // Default response for unmatched routes
//     return new Response('Not Found', {
//       status: 404,
//       headers: corsHeaders,
//     });
//   },
// });

// console.log('Server running at http://localhost:3000');