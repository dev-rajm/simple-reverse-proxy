import http from 'node:http';
import cluster, { Worker } from 'node:cluster';
import { ConfigSchemaType, rootConfigSchema } from './config.schema';
import {
  workerMessageSchema,
  WorkerMessageType,
  WorkerMessageReplyType,
} from './server.schema';

interface CreateServerConfig {
  port: number;
  workerCount: number;
  config: ConfigSchemaType;
}

export async function createServer(config: CreateServerConfig) {
  const { workerCount } = config;

  const WORKER_POOL: Worker[] = [];

  if (cluster.isPrimary) {
    console.log('Master process is up');

    for (let i = 1; i <= workerCount; i++) {
      const w = cluster.fork({ config: JSON.stringify(config.config) });
      WORKER_POOL.push(w);
      console.log(`Master process: Worker node spined: ${i}`);
    }

    const server = http.createServer(function (req, res) {
      const index = Math.floor(Math.random() * WORKER_POOL.length);
      const worker = WORKER_POOL[index];

      if (!worker) {
        throw new Error(`Worker not found!`);
      }

      const payload: WorkerMessageType = {
        requestType: 'HTTP',
        headers: req.headers,
        body: null,
        path: `${req.url}`,
      };

      worker.send(JSON.stringify(payload));
    });

    server.listen(config.port, function () {
      console.log(`Reverse proxy ninja listening on ${config.port}`);
    });
  } else {
    console.log('Worker node');
    const config = await rootConfigSchema.parseAsync(
      JSON.parse(`${process.env.config}`)
    );

    process.on('message', async (msg: string) => {
      const messageValidated = await workerMessageSchema.parseAsync(
        JSON.parse(msg)
      );

      const requestUrl = messageValidated.path;
      const rule = config.server.rules.find(e => e.path === requestUrl);

      if (!rule) {
        const reply: WorkerMessageReplyType = {
          errorCode: '404',
          error: 'Rule not found',
        };

        if (process.send) process.send(JSON.stringify(reply));
      }

      const upstreamID = rule?.upstreams[0];
      if (!upstreamID) {
        const reply: WorkerMessageReplyType = {
          errorCode: '500',
          error: 'Upstream not found',
        };

        if (process.send) process.send(JSON.stringify(reply));
      }
    });
  }
}
