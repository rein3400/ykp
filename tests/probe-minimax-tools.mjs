const body = {
  model: 'minimax-m3',
  max_tokens: 100,
  messages: [{ role: 'user', content: 'Berapa 2+2? Gunakan tool kalkulator.' }],
  tools: [
    {
      type: 'function',
      function: {
        name: 'kalkulator',
        description: 'Hitung ekspresi',
        parameters: { type: 'object', properties: { expr: { type: 'string' } }, required: ['expr'] }
      }
    }
  ],
  tool_choice: 'auto'
};

const res = await fetch('https://ollama.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ce6c4c70f8a149d4b223ca70928d1102.puLdC5RjBegXZJCtdU2PTlIP'
  },
  body: JSON.stringify(body)
});
console.log('HTTP', res.status);
console.log(await res.text());
