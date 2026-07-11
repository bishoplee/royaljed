import path from 'path';
import fs from 'fs';

// Root storage directory
// Defaults to a "storage" folder in the workspace root, or can be overridden via ENV
export const STORAGE_ROOT = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), 'storage');

export const TMP_DIR = path.join(STORAGE_ROOT, 'tmp');
export const RAW_DIR = path.join(STORAGE_ROOT, 'raw');
export const HLS_DIR = path.join(STORAGE_ROOT, 'hls');
export const PRACTICE_DIR = path.join(STORAGE_ROOT, 'practice');
export const SUBMISSIONS_DIR = path.join(STORAGE_ROOT, 'submissions');

/**
 * Ensures that the required storage directories exist.
 */
export function ensureStorageDirs() {
  const dirs = [STORAGE_ROOT, TMP_DIR, RAW_DIR, HLS_DIR, PRACTICE_DIR, SUBMISSIONS_DIR];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
