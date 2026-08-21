// Tiny 2x2 PNG (red pixel) for vision probe
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkYDjAwMDAwMjIAAUBAQEBP6jKAAAAAElFTkSuQmCC',
  'base64'
);

const body = {
  model: 'minimax-m3',
  max_tokens: 60,
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Apa isi gambar ini? Jawab singkat dalam Bahasa Indonesia.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } }
      ]
    }
  ]
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
