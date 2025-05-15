import dotenv from 'dotenv';
import path from 'path';
import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import Redis from 'ioredis';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import helmet from 'helmet';
import sanitizeHtml from 'sanitize-html';
import { Queue, Worker, Job } from 'bullmq';
import pino from 'pino';
import pinoHttp from 'pino-http';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(helmet());

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Redis setup
const redisConnectionOptions = { host: 'redis', port: 6379 };
const redis = new Redis(redisConnectionOptions);

// BullMQ setup
const messageQueue = new Queue('message-processing', { connection: redisConnectionOptions });

interface MessagePayload {
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
}

// Elasticsearch setup
const es = new ElasticClient({ node: 'http://elasticsearch:9200' });

// Pino setup
const logger = pino();
const pinoMiddleware = pinoHttp({ logger });

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase: SupabaseClient | undefined;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  logger.info('Supabase client initialized successfully.');
} else {
  logger.warn('Supabase URL or Key not provided. Supabase client not initialized.');
}

app.use(pinoMiddleware);

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chat API - Toolzz',
      version: '1.0.0',
      description: 'API para chat em tempo real'
    }
  },
  apis: ['./src/server.ts']
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(express.json());

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Verifica status do servidor
 *     responses:
 *       200:
 *         description: OK
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

/**
 * @openapi
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       required:
 *         - userId
 *         - userName
 *         - content
 *       properties:
 *         userId:
 *           type: string
 *           description: ID do usuário que enviou
 *         userName:
 *           type: string
 *           description: Nome do usuário que enviou
 *         content:
 *           type: string
 *           description: Conteúdo da mensagem
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Data e hora da mensagem (gerado automaticamente)
 */

/**
 * @openapi
 * /message:
 *   post:
 *     summary: Envia mensagem para a sala via REST
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Message'
 *     responses:
 *       200:
 *         description: Mensagem enviada
 */
app.post('/message', async (req: Request, res: Response) => {
  const { userId, userName, content } = req.body;
  const sanitizedUserName = sanitizeHtml(userName, { allowedTags: [], allowedAttributes: {} });
  const sanitizedContent = sanitizeHtml(content, { allowedTags: [], allowedAttributes: {} });
  if (!userId || !userName || !content) {
    res.status(400).json({ error: 'userId, userName e content são obrigatórios' });
    return;
  }

  const message = {
    userId,
    userName: sanitizedUserName,
    content: sanitizedContent,
    timestamp: new Date().toISOString()
  };

  // Emite para REST e socket.io
  io.emit('message', message);

    // Adiciona à fila do BullMQ para processamento assíncrono
    try {
      await messageQueue.add('process-message', message);
      logger.info('Message added to BullMQ queue (REST)');
    } catch (queueError: any) {
      logger.error('Error adding message to BullMQ queue (REST): %s', queueError.message);
    }

    await redis.lpush('chat:messages', JSON.stringify(message));
    await redis.ltrim('chat:messages', 0, 99);
  res.status(200).json({ status: 'queued', messageId: message.userId + '-' + message.timestamp });
});

/**
 * @openapi
 * /messages:
 *   get:
 *     summary: Retorna mensagens do chat paginadas do histórico (Supabase).
 *     parameters:
 *       - in: query
 *         name: page
 *         required: true
 *         schema:
 *           type: integer
 *         description: Número da página para exibir.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Número de mensagens por página (padrão 10).
 *     responses:
 *       200:
 *         description: Lista de mensagens paginada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 totalMessages:
 *                   type: integer
 *       400:
 *         description: Parâmetros inválidos ('page' não fornecido ou não numérico, 'limit' não numérico se fornecido).
 *       500:
 *         description: Erro ao buscar mensagens ou Supabase não configurado.
 */
app.get('/messages', async (req: Request, res: Response) => {
  const pageParam = req.query.page as string;
  const limitParam = req.query.limit as string;

  if (!pageParam) {
    res.status(400).json({ error: "Parâmetro 'page' é obrigatório." });
  }

  const page = parseInt(pageParam);
  let limit = parseInt(limitParam);

  if (isNaN(page) || page < 1) {
    res.status(400).json({ error: "Parâmetro 'page' deve ser um número positivo." });
  }

  if (limitParam && (isNaN(limit) || limit < 1)) {
    res.status(400).json({ error: "Parâmetro 'limit' deve ser um número positivo, se fornecido." });
  }
  if (!limitParam || isNaN(limit) || limit < 1) {
    limit = 10; // Valor padrão para limit
  }

  if (!supabase) {
    res.status(500).json({ error: 'Supabase client não inicializado. Histórico de mensagens indisponível.' });
  }
  else {
    try {
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        logger.error('Error counting messages from Supabase:', countError.message);
        res.status(500).json({ error: 'Erro ao contar mensagens do Supabase.' });
      }

      const totalMessages = count || 0;
      const totalPages = Math.ceil(totalMessages / limit);

      const { data: supabaseMessages, error: fetchError } = await supabase
        .from('messages')
        .select('user_id, user_name, content, timestamp')
        .order('timestamp', { ascending: false })
        .range(from, to);

      if (fetchError) {
        logger.error('Error fetching messages from Supabase for history:', fetchError.message);
        res.status(500).json({ error: 'Erro ao buscar mensagens do Supabase.' });
      }

      const messages = supabaseMessages ? supabaseMessages.map(m => ({
        userId: m.user_id,
        userName: m.user_name,
        content: m.content,
        timestamp: m.timestamp,
      })) : [];

      res.status(200).json({
        data: messages,
        totalPages,
        currentPage: page,
        totalMessages
      });
    } catch (e: any) {
      logger.error('Exception fetching message history from Supabase:', e.message);
      res.status(500).json({ error: 'Erro interno ao processar o histórico de mensagens.' });
    }
  }
});

/**
 * @openapi
 * /search:
 *   get:
 *     summary: Busca mensagens contendo um termo
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de mensagens encontradas
 */
app.get('/search', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q || typeof q !== 'string') {
    res.status(400).json({ error: 'Parâmetro q é obrigatório' });
    return;
  }

  const result = await es.search({
    index: 'chat-messages',
    query: {
      multi_match: {
        query: q,
        fields: ['content', 'userName']
      }
    }
  });

  const hits = result.hits.hits.map(hit => hit._source);
  res.status(200).json(hits);
});

/**
 * @openapi
 * /users-online:
 *   get:
 *     summary: Retorna a quantidade de usuários online
 *     responses:
 *       200:
 *         description: Quantidade de usuários online
 */
app.get('/users-online', async (_req: Request, res: Response) => {
  const users = await redis.smembers('chat:users');
  res.status(200).json({ usersOnline: users.length });
});

io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);

  // Adiciona o usuário à lista de usuários online
  redis.sadd('chat:users', socket.id);

  socket.on('message', async (msg: { userId: string; userName: string, content: string }) => {
    const sanitizedUserName = sanitizeHtml(msg.userName, { allowedTags: [], allowedAttributes: {} });
    const sanitizedContent = sanitizeHtml(msg.content, { allowedTags: [], allowedAttributes: {} });
    const message = {
      userId: msg.userId,
      userName: sanitizedUserName,
      content: sanitizedContent,
      timestamp: new Date().toISOString()
    };
    io.emit('message', message);

    // Adiciona à fila do BullMQ para processamento assíncrono
    try {
      await messageQueue.add('process-message', message);
      logger.info('Message added to BullMQ queue (Socket)');
    } catch (queueError: any) {
      logger.error('Error adding message to BullMQ queue (Socket):', queueError.message);
    }

    // Mantém o cache rápido no Redis para exibição imediata
    await redis.lpush('chat:messages', JSON.stringify(message));
    await redis.ltrim('chat:messages', 0, 99);
  });

  // Suporte para "fulano está digitando..."
  socket.on('start_typing', (data: { userName: string }) => {
    socket.broadcast.emit('start_typing', { userName: data.userName });
  });
  socket.on('stop_typing', (data: { userName: string }) => {
    socket.broadcast.emit('stop_typing', { userName: data.userName });
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
    redis.srem('chat:users', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, async () => {
  logger.info(`Attempting to start server on port: ${PORT}`);

  // Limpa usuários online do Redis
  try {
    await redis.del('chat:users');
    logger.info('Cleared online users from Redis.');
  } catch (error: any) {
    logger.error('Error clearing online users from Redis:', error.message);
  }

  // Limpa mensagens do Redis
  try {
    await redis.del('chat:messages');
    logger.info('Cleared cached messages from Redis.');
  } catch (error: any) {
    logger.error('Error clearing cached messages from Redis:', error.message);
  }

  // Helper function to delay execution
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Elasticsearch setup with retry logic
  const esIndexName = 'chat-messages';
  const MAX_ES_RETRIES = 10;
  const ES_RETRY_DELAY_MS = 5000; // 5 seconds
  let esReady = false;

  for (let attempt = 1; attempt <= MAX_ES_RETRIES; attempt++) {
    try {
      logger.info(`Attempting to connect to Elasticsearch (attempt ${attempt}/${MAX_ES_RETRIES})...`);
      await es.ping();
      logger.info('Successfully connected to Elasticsearch.');
      esReady = true;
      break; // Exit loop on successful connection
    } catch (error: any) {
      logger.error(`Failed to connect to Elasticsearch on attempt ${attempt}:`, error.message);
      if (attempt < MAX_ES_RETRIES) {
        logger.info(`Retrying in ${ES_RETRY_DELAY_MS / 1000} seconds...`);
        await delay(ES_RETRY_DELAY_MS);
      } else {
        logger.error('Max retries reached. Elasticsearch setup failed. Server might be in a degraded state.');
      }
    }
  }

  if (esReady) {
    try {
      logger.info(`Attempting to delete Elasticsearch index: ${esIndexName}...`);
      const exists = await es.indices.exists({ index: esIndexName });
      if (exists) {
        await es.indices.delete({ index: esIndexName, ignore_unavailable: true });
        logger.info(`Elasticsearch index '${esIndexName}' deleted successfully.`);
      } else {
        logger.info(`Elasticsearch index '${esIndexName}' does not exist, skipping deletion.`);
      }
      logger.info(`Attempting to create Elasticsearch index: ${esIndexName}...`);
      await es.indices.create({ index: esIndexName });
      logger.info(`Elasticsearch index '${esIndexName}' created successfully.`);

      // Popula o Elasticsearch com os dados do Supabase (somente se ES estiver pronto)
      if (supabase) {
        logger.info('Attempting to populate Elasticsearch from Supabase...');
        try {
          const { data: supabaseMessages, error: fetchError } = await supabase
            .from('messages')
            .select('user_id, user_name, content, timestamp')
            .order('timestamp', { ascending: false }) // Ordem decrescente
            .limit(100);

          if (fetchError) {
            logger.error('Error fetching messages from Supabase for ES population:', fetchError.message);
          } else if (supabaseMessages && supabaseMessages.length > 0) {
            logger.info(`Fetched ${supabaseMessages.length} messages from Supabase for ES.`);
            const messagesToCache = supabaseMessages.map(m => ({
              userId: m.user_id,
              userName: m.user_name,
              content: m.content,
              timestamp: m.timestamp,
            }));

            logger.info('Populating Elasticsearch with fetched messages...');
            let esSuccessCount = 0;
            for (const m of messagesToCache) {
              try {
                await es.index({
                  index: esIndexName,
                  document: m
                });
                esSuccessCount++;
              } catch (esError: any) {
                logger.error(`Error indexing message ID ${m.userId}-${m.timestamp} to Elasticsearch:`, esError.message);
              }
            }
            logger.info(`Successfully indexed ${esSuccessCount} out of ${messagesToCache.length} messages to Elasticsearch.`);
            if (esSuccessCount < messagesToCache.length) {
              logger.warn(`Failed to index ${messagesToCache.length - esSuccessCount} messages to Elasticsearch.`);
            }
          } else {
            logger.info('No messages found in Supabase to populate Elasticsearch.');
          }
        } catch (e: any) {
          logger.error('Exception during ES data population from Supabase:', e.message);
        }
      } else {
        logger.warn('Supabase client not initialized. Skipping ES data population.');
      }

    } catch (error: any) {
      logger.error(`Error during Elasticsearch index '${esIndexName}' setup after connection:`, error.message);
    }
  } else {
    logger.warn('Elasticsearch is not ready. Skipping index setup and data population for Elasticsearch.');
  }

  // Popula o Redis com os dados do Supabase (independente do ES)
  if (supabase) {
    logger.info('Attempting to populate Redis from Supabase...');
    try {
      const { data: supabaseMessagesRedis, error: fetchErrorRedis } = await supabase
        .from('messages')
        .select('user_id, user_name, content, timestamp')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (fetchErrorRedis) {
        logger.error('Error fetching messages from Supabase for Redis population:', fetchErrorRedis.message);
      } else if (supabaseMessagesRedis && supabaseMessagesRedis.length > 0) {
        logger.info(`Fetched ${supabaseMessagesRedis.length} messages from Supabase for Redis.`);
        const messagesToCacheRedis = supabaseMessagesRedis.map(m => ({
          userId: m.user_id,
          userName: m.user_name,
          content: m.content,
          timestamp: m.timestamp,
        }));

        try {
          const redisPipeline = redis.pipeline();
          for (const m of messagesToCacheRedis) {
            redisPipeline.lpush('chat:messages', JSON.stringify(m));
          }
          await redisPipeline.exec();
          await redis.ltrim('chat:messages', 0, 99);
          logger.info(`Successfully populated Redis with ${messagesToCacheRedis.length} messages.`);
        } catch (redisError: any) {
          logger.error('Error populating Redis from Supabase:', redisError.message);
        }
      } else {
        logger.info('No messages found in Supabase to populate Redis.');
      }
    } catch (e: any) {
      logger.error('Exception during Redis data population from Supabase:', e.message);
    }
  } else {
    logger.warn('Supabase client not initialized. Skipping Redis data population.');
  }

  logger.info(`Server running on port: ${PORT}`);

  // BullMQ Worker Setup
  const worker = new Worker('message-processing', async (job: Job<MessagePayload>) => {
    const message = job.data;
    logger.info(`Processing message from queue: ${message.userId} - ${message.timestamp}`);

    // Salva no Supabase
    if (supabase) {
      try {
        const { error: supabaseError } = await supabase
          .from('messages')
          .insert([{
            user_id: message.userId,
            user_name: message.userName,
            content: message.content,
            timestamp: message.timestamp,
          }]);
        if (supabaseError) {
          logger.error(`Error saving message to Supabase (Worker - Job ID: ${job.id}):`, supabaseError.message);
          throw supabaseError; // Faz o job falhar e ser retentado se configurado
        }
        logger.info(`Message saved to Supabase (Worker - Job ID: ${job.id})`);
      } catch (e: any) {
        logger.error(`Exception saving message to Supabase (Worker - Job ID: ${job.id}):`, e.message);
        throw e; // Faz o job falhar
      }
    } else {
      logger.warn(`Supabase client not initialized. Skipping persistence for message (Worker - Job ID: ${job.id}).`);
    }

    // Indexa no Elasticsearch
    if (esReady) { // Verifica se o ES está pronto (esReady é definido no seu código de inicialização)
      try {
        await es.index({
          index: 'chat-messages', // esIndexName pode ser usado aqui se preferir
          document: message
        });
        logger.info(`Message indexed in Elasticsearch (Worker - Job ID: ${job.id})`);
      } catch (esError: any) {
        logger.error(`Error indexing message in Elasticsearch (Worker - Job ID: ${job.id}):`, esError.message);
        // Não relança o erro para não impedir o salvamento no Supabase se o ES falhar temporariamente
        // Considere uma lógica de dead-letter queue para falhas de ES
      }
    } else {
      logger.warn(`Elasticsearch not ready. Skipping indexing for message (Worker - Job ID: ${job.id}).`);
    }
  }, { connection: redisConnectionOptions });

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} has completed.`);
  });

  worker.on('failed', (job, err) => {
    if (job) {
        logger.error(`Job ${job.id} has failed with ${err.message}`);
    } else {
        logger.error(`A job has failed with ${err.message}`);
    }
  });

  logger.info('BullMQ Worker started and listening for messages.');
});

export default app;
