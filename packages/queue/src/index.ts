import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

export const AGENT_RUN_QUEUE = "agent-runs";

let connection: IORedis | undefined;

function getConnection(): IORedis {
  connection ??= new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
  });
  return connection;
}

let queue: Queue | undefined;

export function getAgentRunQueue(): Queue {
  queue ??= new Queue(AGENT_RUN_QUEUE, { connection: getConnection() });
  return queue;
}

/** Enqueues a one-off run (not a repeating schedule) — used by "run now" triggers. */
export async function enqueueAgentRun(userId: string): Promise<void> {
  await getAgentRunQueue().add("run-agent", { userId });
}

export function createAgentRunWorker(processJob: (userId: string) => Promise<void>): Worker {
  return new Worker(
    AGENT_RUN_QUEUE,
    async (job: Job) => {
      await processJob(job.data.userId as string);
    },
    { connection: getConnection(), concurrency: 1 },
  );
}
