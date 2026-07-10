import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { RAW_DIR, ensureStorageDirs } from '../lib/storage';

console.log('Starting Royaljed Video Transcoding Worker...');

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Helper to download files from Google Drive with live progress reporting to Redis
function downloadDriveFile(fileId: string, dest: string, lessonId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const initialUrl = `https://docs.google.com/uc?export=download&id=${fileId}`;

    function requestUrl(url: string) {
      const client = url.startsWith('http://') ? http : https;
      client.get(url, (res) => {
        // Handle all redirects (301, 302, 303, 307, 308)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            requestUrl(redirectUrl);
          } else {
            reject(new Error(`Redirect location missing (status ${res.statusCode})`));
          }
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download from Drive. Status: ${res.statusCode}`));
          return;
        }

        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          // Parse HTML to extract confirmation token and optional uuid for large files
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            const confirmMatch = body.match(/name="confirm"\s+value="([^"]+)"/) || body.match(/confirm=([a-zA-Z0-9-_]+)/);
            const uuidMatch = body.match(/name="uuid"\s+value="([^"]+)"/);

            if (confirmMatch) {
              const confirmToken = confirmMatch[1];
              let confirmUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmToken}`;
              if (uuidMatch) {
                confirmUrl += `&uuid=${uuidMatch[1]}`;
              }
              requestUrl(confirmUrl);
            } else {
              reject(new Error('Drive file is not publicly accessible. Ensure "Anyone with the link can view" is enabled.'));
            }
          });
        } else {
          // Stream binary data directly to raw path while publishing progress to Redis
          const totalBytes = res.headers['content-length'] ? parseInt(res.headers['content-length']) : 0;
          let downloadedBytes = 0;
          let lastProgressUpdate = 0;

          const fileStream = fs.createWriteStream(dest);

          res.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const now = Date.now();
            if (now - lastProgressUpdate > 1000) {
              lastProgressUpdate = now;
              const percent = totalBytes ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
              const statusText = `Downloading: ${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)}`;
              redis.set(`lesson:progress:${lessonId}`, JSON.stringify({ percent, statusText }), 'EX', 3600).catch(console.error);
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });
          fileStream.on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
          });
        }
      }).on('error', reject);
    }

    requestUrl(initialUrl);
  });
}

const worker = new Worker(
  'video-transcode',
  async (job) => {
    const { lessonId, schoolSlug, rawPath, hlsOutputDir, playlistName, driveFileId } = job.data;
    console.log(`Processing job ${job.id}: transcoding video for lesson ${lessonId}`);

    try {
      // 1. Update lesson status to PROCESSING (in case it wasn't already set)
      await prisma.lesson.update({
        where: { id: lessonId },
        data: {
          videoStatus: 'PROCESSING',
          videoError: null,
        },
      });

      // 2. Ensure HLS output directory exists
      if (!fs.existsSync(hlsOutputDir)) {
        fs.mkdirSync(hlsOutputDir, { recursive: true });
      }

      // 3. Resolve input path (download from Drive if necessary)
      let inputPath = rawPath;
      if (driveFileId) {
        ensureStorageDirs();
        inputPath = path.join(RAW_DIR, `${lessonId}_raw.mp4`);
        console.log(`Downloading Google Drive File ${driveFileId} to ${inputPath}...`);
        await downloadDriveFile(driveFileId, inputPath, lessonId);
        console.log(`Google Drive download finished successfully.`);
      }

      const input = inputPath.replace(/\\/g, '/');
      const segmentFilename = path.join(hlsOutputDir, 'segment_%03d.ts').replace(/\\/g, '/');
      const playlistFile = path.join(hlsOutputDir, playlistName).replace(/\\/g, '/');

      console.log(`Running FFmpeg on input: ${input}`);
      console.log(`HLS Output Directory: ${hlsOutputDir}`);

      // 4. Spawn FFmpeg child process
      const args = [
        '-y', // Overwrite output files
        '-i', input,
        '-codec:v', 'libx264',
        '-codec:a', 'aac',
        '-hls_time', '10', // 10-second segments
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', segmentFilename,
        playlistFile,
      ];

      await new Promise<void>((resolve, reject) => {
        const ffmpegProcess = spawn('ffmpeg', args);
        let errorLog = '';
        let totalDurationSeconds = 0;
        let lastProgressUpdate = 0;

        ffmpegProcess.stderr.on('data', (data) => {
          const output = data.toString();
          errorLog += output;

          // Parse duration: "Duration: 00:02:15.30"
          const durationMatch = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})/);
          if (durationMatch) {
            const h = parseInt(durationMatch[1]);
            const m = parseInt(durationMatch[2]);
            const s = parseInt(durationMatch[3]);
            totalDurationSeconds = h * 3600 + m * 60 + s;
          }

          // Parse elapsed time: "time=00:00:45.10"
          const timeMatch = output.match(/time=\s*(\d{2}):(\d{2}):(\d{2})/);
          if (timeMatch && totalDurationSeconds > 0) {
            const h = parseInt(timeMatch[1]);
            const m = parseInt(timeMatch[2]);
            const s = parseInt(timeMatch[3]);
            const elapsed = h * 3600 + m * 60 + s;
            const percent = Math.min(100, Math.round((elapsed / totalDurationSeconds) * 100));

            const now = Date.now();
            if (now - lastProgressUpdate > 1000) {
              lastProgressUpdate = now;
              redis.set(
                `lesson:progress:${lessonId}`,
                JSON.stringify({
                  percent,
                  statusText: `Transcoding: ${percent}% done`,
                }),
                'EX',
                3600
              ).catch(console.error);
            }
          }
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            console.error(`FFmpeg error log:\n${errorLog}`);
            reject(new Error(`FFmpeg transcoding failed with exit code ${code}`));
          }
        });

        ffmpegProcess.on('error', (err) => {
          console.error('Failed to spawn FFmpeg:', err);
          reject(err);
        });
      });

      // 5. Update lesson record to READY
      const relativePlaylistPath = `storage/hls/${lessonId}/${playlistName}`;
      await prisma.lesson.update({
        where: { id: lessonId },
        data: {
          videoPath: relativePlaylistPath,
          videoStatus: 'READY',
          videoError: null,
        },
      });

      console.log(`Transcoding successful for lesson ${lessonId}. Playlist saved to ${relativePlaylistPath}`);

      // Clean up progress from Redis on success
      await redis.del(`lesson:progress:${lessonId}`).catch(() => {});

      // 6. Optional: Clean up the raw file if configured
      // For safety, we keep it, or we can choose to delete it. Let's keep it in storage/raw/ for now.
    } catch (err: any) {
      console.error(`Error processing job ${job.id}:`, err);

      // Clean up progress from Redis on failure
      await redis.del(`lesson:progress:${lessonId}`).catch(() => {});

      // Record failure state in db
      try {
        await prisma.lesson.update({
          where: { id: lessonId },
          data: {
            videoStatus: 'FAILED',
            videoError: err.message || 'Unknown transcoding error',
          },
        });
      } catch (dbErr) {
        console.error('Failed to update lesson to FAILED status in DB:', dbErr);
      }

      throw err; // Signal to BullMQ that the job failed
    }
  },
  {
    connection: redis as any,
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully.`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} failed with error: ${err.message}`);
});
