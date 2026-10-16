/** Ops bot identity: dedicated ops token first, shared token as fallback. */
export function telegramBotToken(): string {
  return [process.env.TELEGRAM_OPS_BOT_TOKEN, process.env.TELEGRAM_BOT_TOKEN]
    .map((value) => (value ?? '').trim())
    .find((value) => value !== '') ?? '';
}