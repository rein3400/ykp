'use client';

import { useState } from 'react';

type Message = { role: 'user' | 'ai'; content: string };

export function AiAssistantClient() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const q = question.trim();
    if (!q) return;
    setHistory((h) => [...h, { role: 'user', content: q }]);
    setQuestion('');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ops/ai-assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j?.error?.message ?? 'AI gagal');
        return;
      }
      setHistory((h) => [...h, { role: 'ai', content: j.data.answer }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='rounded-xl border bg-white p-4 space-y-4'>
      <div className='h-96 space-y-3 overflow-y-auto rounded border bg-slate-50 p-3'>
        {history.length === 0 && (
          <div className='text-sm text-slate-500'>Contoh: "Apa yang harus dilakukan kalau serving time melebihi 180 detik?" atau "Jelaskan bedanya status NEEDS_REVIEW dan FAIL di QC."</div>
        )}
        {history.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === 'user' ? 'ml-auto bg-indigo-600 text-white' : 'bg-white text-slate-800 shadow-sm'
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <div className='text-sm text-slate-500'>AI sedang menjawab…</div>}
        {error && <div className='text-sm text-red-600'>{error}</div>}
      </div>
      <div className='flex gap-2'>
        <input
          className='flex-1 rounded border px-3 py-2 text-sm'
          placeholder='Tanya AI Assistant…'
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        />
        <button onClick={submit} disabled={loading || !question.trim()} className='rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50'>
          Kirim
        </button>
      </div>
    </div>
  );
}
