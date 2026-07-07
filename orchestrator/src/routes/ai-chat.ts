import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { routeAi, type TaskType } from '../services/ai-router.js';

const chatSchema = z.object({
  task_type: z.enum(['sop', 'trading_reasoning', 'coding', 'image', 'general']).default('general'),
  user_message: z.string().min(1).max(4000),
  context: z.string().max(4000).optional(),
  preferred_model: z.enum(['gpt', 'qwen', 'gemini', 'claude']).optional(),
  user_id: z.string().optional()
});

export default async function aiChatRoutes(app: FastifyInstance): Promise<void> {
  app.post('/ai/chat', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid payload', issues: parsed.error.issues });
    }
    const { task_type, user_message, context, preferred_model, user_id } = parsed.data;
    const result = await routeAi({
      taskType: task_type as TaskType,
      userMessage: user_message,
      context,
      preferredModel: preferred_model,
      userId: user_id
    });
    return reply.send(result);
  });
}