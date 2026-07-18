import { AiAssistantClient } from './ai-assistant-client';

export const dynamic = 'force-dynamic';

export default function AiAssistantPage() {
  return (
    <div className='space-y-4'>
      <div>
        <h1 className='text-2xl font-bold'>AI Assistant</h1>
        <p className='text-sm text-slate-500'>Tanya seputar operasional, KPI, cara pakai modul, atau troubleshooting.</p>
      </div>
      <AiAssistantClient />
    </div>
  );
}
