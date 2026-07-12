'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';

type SubmissionType = 'TEXT' | 'AUDIO' | 'VIDEO';

type RubricCriterion = {
  name: string;
  percentage: number;
  description?: string;
};

type ScoreRow = {
  criteria: string;
  score: number;
};

type TimestampComment = {
  timestampSeconds: number;
  comment: string;
};

interface SubmissionDetailPayload {
  submission: {
    id: string;
    assignmentId: string;
    studentId: string;
    attemptNumber: number;
    status: 'DRAFT' | 'SUBMITTED' | 'GRADED';
    submittedAt: string;
    filePath: string | null;
    textContent: string | null;
    originalFileName: string | null;
    mimeType: string | null;
    student: {
      id: string;
      fullName: string;
      email: string;
    };
    assignment: {
      id: string;
      title: string;
      description: string | null;
      instructions: string | null;
      submissionType: SubmissionType;
      dueDate: string;
      rubricJson: unknown;
      classes: Array<{ id: string; name: string }>;
    };
    grade: {
      id: string;
      scoresJson: unknown;
      percentage: number;
      feedbackText: string | null;
      gradedAt: string;
      timestampedFeedback: Array<{
        id: string;
        timestampSeconds: number;
        comment: string;
      }>;
    } | null;
  };
}

interface TutorSubmissionReviewClientProps {
  schoolSlug: string;
  submissionId: string;
  initialDetail: SubmissionDetailPayload;
}

function asRubricCriteria(raw: unknown): RubricCriterion[] {
  if (!Array.isArray(raw)) return [];

  const results: RubricCriterion[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const name = 'name' in item ? String(item.name).trim() : '';
    const percentage = 'percentage' in item ? Number(item.percentage) : NaN;
    const description = 'description' in item ? String(item.description).trim() : undefined;

    if (!name || !Number.isFinite(percentage) || percentage <= 0) {
      continue;
    }

    results.push({
      name,
      percentage,
      description: description || undefined,
    });
  }

  return results;
}

function asScoreRows(raw: unknown): ScoreRow[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const criteria = 'criteria' in item ? String(item.criteria).trim() : '';
      const score = 'score' in item ? Number(item.score) : NaN;
      if (!criteria || !Number.isFinite(score)) return null;
      return { criteria, score };
    })
    .filter((item): item is ScoreRow => Boolean(item));
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

export default function TutorSubmissionReviewClient({
  schoolSlug,
  submissionId,
  initialDetail,
}: TutorSubmissionReviewClientProps) {
  const [detail, setDetail] = useState<SubmissionDetailPayload>(initialDetail);
  const submission = detail.submission;

  const rubric = useMemo(() => asRubricCriteria(submission.assignment.rubricJson), [submission.assignment.rubricJson]);

  const initialScoreMap = useMemo(() => {
    const existing = new Map(asScoreRows(submission.grade?.scoresJson).map((row) => [row.criteria, row.score]));

    return rubric.reduce<Record<string, number>>((acc, item) => {
      acc[item.name] = Math.max(0, Math.min(100, existing.get(item.name) ?? 0));
      return acc;
    }, {});
  }, [rubric, submission.grade?.scoresJson]);

  const [scoreMap, setScoreMap] = useState<Record<string, number>>(initialScoreMap);
  const [feedbackText, setFeedbackText] = useState(submission.grade?.feedbackText ?? '');
  const [timelineComments, setTimelineComments] = useState<TimestampComment[]>(
    submission.grade?.timestampedFeedback.map((entry) => ({
      timestampSeconds: entry.timestampSeconds,
      comment: entry.comment,
    })) ?? []
  );
  const [commentDraft, setCommentDraft] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);

  const weightedPercentage = useMemo(() => {
    const totalWeight = rubric.reduce((sum, item) => sum + item.percentage, 0);
    if (totalWeight <= 0) return 0;

    const score = rubric.reduce((sum, criterion) => {
      const criterionScore = Math.max(0, Math.min(100, scoreMap[criterion.name] ?? 0));
      return sum + criterionScore * (criterion.percentage / totalWeight);
    }, 0);

    return Number(score.toFixed(2));
  }, [rubric, scoreMap]);

  const isMediaSubmission = submission.assignment.submissionType === 'AUDIO' || submission.assignment.submissionType === 'VIDEO';

  const mediaUrl = isMediaSubmission
    ? `/api/ec/${schoolSlug}/tutor/submissions/${submissionId}/media`
    : null;

  function addTimestampComment() {
    const trimmed = commentDraft.trim();
    if (!trimmed) return;

    setTimelineComments((prev) => {
      const next = [
        ...prev,
        {
          timestampSeconds: Math.floor(currentTime),
          comment: trimmed,
        },
      ];

      return next.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    });

    setCommentDraft('');
  }

  function jumpToTime(seconds: number) {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = seconds;
    mediaRef.current.play().catch(() => undefined);
  }

  async function handleSaveGrade() {
    setSaveState('saving');
    setErrorMessage(null);

    try {
      const scoresPayload = rubric.map((criterion) => ({
        criteria: criterion.name,
        score: Math.max(0, Math.min(100, scoreMap[criterion.name] ?? 0)),
      }));

      const response = await fetch(`/api/ec/${schoolSlug}/tutor/submissions/${submissionId}/grade`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scores: scoresPayload,
          feedbackText: feedbackText.trim(),
          timestampedFeedback: timelineComments,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setSaveState('error');
        setErrorMessage(payload.error || 'Failed to save grade.');
        return;
      }

      setDetail((prev) => ({
        submission: {
          ...prev.submission,
          status: 'GRADED',
          grade: {
            id: payload.grade.id,
            scoresJson: payload.grade.scoresJson,
            percentage: payload.grade.percentage,
            feedbackText: payload.grade.feedbackText,
            gradedAt: payload.grade.gradedAt,
            timestampedFeedback: payload.grade.timestampedFeedback,
          },
        },
      }));

      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setErrorMessage('Unexpected error while saving grade.');
      console.error('Failed to save grade:', error);
    }
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <Link
            href={`/ec/${schoolSlug}/tutor/dashboard`}
            className="text-sm font-semibold text-brandGreenDark"
          >
            Back to Tutor Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{submission.assignment.title}</h1>
          <p className="mt-2 text-sm text-slate-600">
            Student: <span className="font-medium text-slate-900">{submission.student.fullName}</span> ({submission.student.email})
          </p>
          <p className="mt-1 text-sm text-slate-600">Attempt #{submission.attemptNumber} · Submitted {new Date(submission.submittedAt).toLocaleString()}</p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-6">
            <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight">Submission content</h2>

              {submission.assignment.submissionType === 'TEXT' ? (
                <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                  {submission.textContent || 'No text content submitted.'}
                </p>
              ) : null}

              {submission.assignment.submissionType === 'AUDIO' && mediaUrl ? (
                <div className="mt-4 space-y-3">
                  <audio
                    ref={(node) => {
                      mediaRef.current = node;
                    }}
                    controls
                    preload="metadata"
                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                    className="w-full"
                    src={mediaUrl}
                  />
                  <p className="text-sm text-slate-600">Current playback time: {formatTimestamp(currentTime)}</p>
                </div>
              ) : null}

              {submission.assignment.submissionType === 'VIDEO' && mediaUrl ? (
                <div className="mt-4 space-y-3">
                  <video
                    ref={(node) => {
                      mediaRef.current = node;
                    }}
                    controls
                    preload="metadata"
                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                    className="w-full rounded-2xl border border-slate-200 bg-black"
                    src={mediaUrl}
                  />
                  <p className="text-sm text-slate-600">Current playback time: {formatTimestamp(currentTime)}</p>
                </div>
              ) : null}
            </article>

            <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">Timeline feedback</h2>
                <span className="rounded-full bg-brandGreenSoft px-3 py-1 text-xs font-semibold text-brandTealDeep">
                  {timelineComments.length} comments
                </span>
              </div>

              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">Comment</label>
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  placeholder="Highlight pronunciation moments, pacing, and diction notes."
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={addTimestampComment}
                    className="rounded-full bg-brandGreen px-4 py-2 text-sm font-semibold text-brandTealDeep transition hover:bg-brandGreen/90"
                  >
                    Add at {formatTimestamp(currentTime)}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {timelineComments.map((entry, index) => (
                  <div
                    key={`${entry.timestampSeconds}-${index}`}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => jumpToTime(entry.timestampSeconds)}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brandTealDeep"
                    >
                      {formatTimestamp(entry.timestampSeconds)}
                    </button>

                    <p className="flex-1 text-sm text-slate-700">{entry.comment}</p>

                    <button
                      type="button"
                      onClick={() =>
                        setTimelineComments((prev) => prev.filter((_, rowIndex) => rowIndex !== index))
                      }
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {timelineComments.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No timestamped comments yet.
                  </p>
                ) : null}
              </div>
            </article>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold tracking-tight">Rubric scoring</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                  {weightedPercentage.toFixed(2)}%
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {rubric.map((criterion) => (
                  <div key={criterion.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{criterion.name}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        {criterion.percentage}%
                      </span>
                    </div>

                    {criterion.description ? (
                      <p className="mt-1 text-xs text-slate-600">{criterion.description}</p>
                    ) : null}

                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={scoreMap[criterion.name] ?? 0}
                        onChange={(event) =>
                          setScoreMap((prev) => ({
                            ...prev,
                            [criterion.name]: Number(event.target.value),
                          }))
                        }
                        className="h-2 w-full cursor-pointer"
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scoreMap[criterion.name] ?? 0}
                        onChange={(event) =>
                          setScoreMap((prev) => ({
                            ...prev,
                            [criterion.name]: Math.max(0, Math.min(100, Number(event.target.value) || 0)),
                          }))
                        }
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                ))}

                {rubric.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    This assignment has no valid rubric items.
                  </p>
                ) : null}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight">Tutor feedback</h2>
              <textarea
                value={feedbackText}
                onChange={(event) => setFeedbackText(event.target.value)}
                rows={6}
                className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                placeholder="Add qualitative feedback, tone coaching notes, and next-practice guidance."
              />

              {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}

              {saveState === 'saved' ? (
                <p className="mt-3 text-sm text-green-700">Grade saved successfully.</p>
              ) : null}

              <button
                type="button"
                onClick={handleSaveGrade}
                disabled={saveState === 'saving' || rubric.length === 0}
                className="mt-4 inline-flex rounded-full bg-brandGreen px-5 py-2.5 text-sm font-semibold text-brandTealDeep transition hover:bg-brandGreen/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveState === 'saving' ? 'Saving...' : 'Save grade'}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
