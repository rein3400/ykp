// Probe the hermez vision path end-to-end: handleText with a base64 image
// using minimax-m3 via Ollama Cloud. Sets env inline (no .env needed).
process.env.LLM_API_KEY = 'ce6c4c70f8a149d4b223ca70928d1102.puLdC5RjBegXZJCtdU2PTlIP';
process.env.LLM_BASE_URL = 'https://ollama.com/v1';
process.env.LLM_MODEL = 'deepseek-v4-flash';
process.env.LLM_VISION_MODEL = 'minimax-m3';

// 1x1 red PNG, base64
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const { handleText } = await import('../ykp-hermez/dist/brain.js');
const reply = await handleText(123, 'Warna apa gambar ini?', PNG, {});
console.log('REPLY:', reply);
