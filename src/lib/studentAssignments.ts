import path from 'path';
import { SubmissionType } from '@prisma/client';
import { SUBMISSIONS_DIR } from './storage';

const AUDIO_MIME_TO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
};

const VIDEO_MIME_TO_EXT: Record<string, string> = {
  'video/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
};

function isSafeStorageSegment(segment: string) {
  return /^[A-Za-z0-9_-]+$/.test(segment);
}

export function getSubmissionFileExtension(file: File, submissionType: SubmissionType) {
  const normalizedType = file.type.toLowerCase();

  if (submissionType === 'TEXT') {
    return null;
  }

  if (submissionType === 'AUDIO') {
    return AUDIO_MIME_TO_EXT[normalizedType] || null;
  }

  if (submissionType === 'VIDEO') {
    return VIDEO_MIME_TO_EXT[normalizedType] || null;
  }

  return null;
}

export function assertSafeStorageSegment(segment: string, label: string) {
  if (!isSafeStorageSegment(segment)) {
    throw new Error(`Invalid ${label}`);
  }
}

export function buildSubmissionDirectory(schoolId: string, assignmentId: string, studentId: string) {
  assertSafeStorageSegment(schoolId, 'school id');
  assertSafeStorageSegment(assignmentId, 'assignment id');
  assertSafeStorageSegment(studentId, 'student id');

  const resolvedPath = path.resolve(SUBMISSIONS_DIR, schoolId, assignmentId, studentId);
  const resolvedRoot = path.resolve(SUBMISSIONS_DIR) + path.sep;

  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error('Invalid submission storage path');
  }

  return resolvedPath;
}
