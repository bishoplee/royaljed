import { Queue } from 'bullmq';
import { redis } from './redis';

export const videoTranscodeQueue = new Queue('video-transcode', {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});
