import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { analyzeScreenshot } from '../modules/screenshot.js';

const schema = z.object({ imageUrl: z.string().url(), context: z.string().optional() });

export default async function screenshotRoutes(app: FastifyInstance): Promise<void> {
  app.post('/screenshot/analyze', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'invalid', issues: parsed.error.issues });
    const res = await analyzeScreenshot(parsed.data);
    return reply.send(res);
  });
}