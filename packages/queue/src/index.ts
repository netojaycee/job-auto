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

export const MANUAL_APPLY_QUEUE = "manual-applies";

export interface ManualApplyJobData {
  userId: string;
  rawText: string;
  applicationEmail: string | null;
}

let manualApplyQueue: Queue | undefined;

export function getManualApplyQueue(): Queue {
  manualApplyQueue ??= new Queue(MANUAL_APPLY_QUEUE, { connection: getConnection() });
  return manualApplyQueue;
}

/** Enqueues one pasted-job-listing apply — see apps/worker/src/apply/manual-intake.ts. */
export async function enqueueManualApply(data: ManualApplyJobData): Promise<void> {
  await getManualApplyQueue().add("manual-apply", data);
}

export function createManualApplyWorker(processJob: (data: ManualApplyJobData) => Promise<void>): Worker {
  return new Worker(
    MANUAL_APPLY_QUEUE,
    async (job: Job) => {
      await processJob(job.data as ManualApplyJobData);
    },
    { connection: getConnection(), concurrency: 1 },
  );
}

export const MANUAL_OUTREACH_QUEUE = "manual-outreach";

export interface ManualOutreachJobData {
  userId: string;
  companyName: string;
  /** Omit to have the worker guess one — see apps/worker/src/leads/email-guess.ts. */
  contactEmail?: string;
  website?: string;
  context: string;
}

let manualOutreachQueue: Queue | undefined;

export function getManualOutreachQueue(): Queue {
  manualOutreachQueue ??= new Queue(MANUAL_OUTREACH_QUEUE, { connection: getConnection() });
  return manualOutreachQueue;
}

/** Enqueues one user-submitted cold email target — see apps/worker/src/leads/manual-outreach.ts. */
export async function enqueueManualOutreach(data: ManualOutreachJobData): Promise<void> {
  await getManualOutreachQueue().add("manual-outreach", data);
}

export function createManualOutreachWorker(
  processJob: (data: ManualOutreachJobData) => Promise<void>,
): Worker {
  return new Worker(
    MANUAL_OUTREACH_QUEUE,
    async (job: Job) => {
      await processJob(job.data as ManualOutreachJobData);
    },
    { connection: getConnection(), concurrency: 1 },
  );
}
