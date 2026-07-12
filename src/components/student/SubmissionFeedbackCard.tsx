'use client';

import { useRef, useState } from 'react';

type SubmissionType = 'TEXT' | 'AUDIO' | 'VIDEO';

type GradeScore = {
  criteria: string;
  score: number;
};

type TimestampedFeedback = {
  id: string;
  timestampSeconds: number;
  comment: string;
};

interface SubmissionFeedbackCardProps {
  schoolSlug: string;
  assignmentId: string;
  submission: {
    id: string;
    attemptNumber: number;
    status: string;
    submittedAt: Date;
    textContent: string | null;
    originalFileName: string | null;
    mimeType: string | null;
    grade: {
      id: string;
      scoresJson: unknown;
      percentage: number;
      feedbackText: string | null;
      gradedAt: Date;
      tutor: {
        id: string;
        fullName: string;
        email: string;
      };
      timestampedFeedback: TimestampedFeedback[];
    } | null;
  };
  submissionType: SubmissionType;
}

function formatTimestamp(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function asGradeScores(raw: unknown): GradeScore[] {
  if (!Array.isArray(raw)) return [];

  const results: GradeScore[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const criteria = 'criteria' in item ? String(item.criteria).trim() : '';
    const score = 'score' in item ? Number(item.score) : NaN;

    if (!criteria || !Number.isFinite(score)) continue;

    results.push({
      criteria,
      score,
    });
  }

  return results;
}

export default function SubmissionFeedbackCard({
  schoolSlug,
  assignmentId,
  submission,
  submissionType,
}: SubmissionFeedbackCardProps) {
  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const isMediaSubmission = submissionType === 'AUDIO' || submissionType === 'VIDEO';
  const scores = asGradeScores(submission.grade?.scoresJson);

  const mediaUrl = isMediaSubmission
    ? `/api/ec/${schoolSlug}/student/assignments/${assignmentId}/submissions/${submission.id}/media`
    : null;

  const jumpToTime = (seconds: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = seconds;
    mediaRef.current.play().catch(() => undefined);
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-slate-900">Attempt #{submission.attemptNumber}</strong>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {submission.status}
        </span>
      </div>

      <p className="mt-2 text-slate-600">Submitted at {submission.submittedAt.toLocaleString()}</p>

      {submission.textContent ? <p className="mt-3 whitespace-pre-wrap text-slate-700">{submission.textContent}</p> : null}
      {submission.originalFileName ? (
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">File: {submission.originalFileName}</p>
      ) : null}

      {submissionType === 'AUDIO' && mediaUrl ? (
        <div className="mt-3 space-y-2">
          <audio
            ref={(node) => {
              mediaRef.current = node;
            }}
            controls
            preload="metadata"
            className="w-full rounded-2xl border border-slate-200 bg-white p-2"
            src={mediaUrl}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          />
          <p className="text-xs text-slate-500">Playback: {formatTimestamp(currentTime)}</p>
        </div>
      ) : null}

      {submissionType === 'VIDEO' && mediaUrl ? (
        <div className="mt-3 space-y-2">
          <video
            ref={(node) => {
              mediaRef.current = node;
            }}
            controls
            preload="metadata"
            className="w-full rounded-2xl border border-slate-200 bg-black"
            src={mediaUrl}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          />
          <p className="text-xs text-slate-500">Playback: {formatTimestamp(currentTime)}</p>
        </div>
      ) : null}

      {submission.grade ? (
        <div className="mt-4 rounded-2xl border border-brandGreen/20 bg-brandGreenSoft p-4 text-brandTealDeep">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em]">Grade & feedback</h3>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-brandTealDeep">
              {submission.grade.percentage.toFixed(2)}%
            </span>
          </div>

          <p className="mt-2 text-xs">
            Graded by {submission.grade.tutor.fullName} on {submission.grade.gradedAt.toLocaleString()}
          </p>

          {scores.length > 0 ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {scores.map((row) => (
                <div key={row.criteria} className="rounded-xl bg-white/80 px-3 py-2 text-xs">
                  <p className="font-medium text-brandTealDeep">{row.criteria}</p>
                  <p className="mt-1">{row.score.toFixed(2)} / 100</p>
                </div>
              ))}
            </div>
          ) : null}

          {submission.grade.feedbackText ? (
            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-white/80 px-3 py-2 text-sm text-brandTealDeep">
              {submission.grade.feedbackText}
            </p>
          ) : null}

          {submission.grade.timestampedFeedback.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Timeline comments</p>
              {submission.grade.timestampedFeedback.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-start gap-2 rounded-xl bg-white/80 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => jumpToTime(entry.timestampSeconds)}
                    disabled={!isMediaSubmission}
                    className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brandTealDeep disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    {formatTimestamp(entry.timestampSeconds)}
                  </button>
                  <p className="flex-1 text-sm text-brandTealDeep">{entry.comment}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
          Not graded yet.
        </div>
      )}
    </article>
  );
}
