const locks = new Map<string, symbol>();

export async function acquireProcessorLock(key: string): Promise<() => Promise<void>> {
  if (locks.has(key)) throw new Error('Telegram processor busy; retry required');
  const token = Symbol(key);
  locks.set(key, token);
  return async () => {
    if (locks.get(key) !== token) throw new Error('Processor lock ownership changed');
    locks.delete(key);
  };
}
