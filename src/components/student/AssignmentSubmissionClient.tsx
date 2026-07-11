'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type SubmissionType = 'VIDEO' | 'AUDIO' | 'TEXT';

interface AssignmentSubmissionClientProps {
  schoolSlug: string;
  assignmentId: string;
  assignmentTitle: string;
  submissionType: SubmissionType;
  attemptsUsed: number;
  maxAttempts: number;
  remainingAttempts: number;
  canSubmit: boolean;
}

export default function AssignmentSubmissionClient({
  schoolSlug,
  assignmentId,
  assignmentTitle,
  submissionType,
  attemptsUsed,
  maxAttempts,
  remainingAttempts,
  canSubmit,
}: AssignmentSubmissionClientProps) {
  const router = useRouter();
  const [textContent, setTextContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const isTextSubmission = submissionType === 'TEXT';
  const isMediaSubmission = submissionType === 'AUDIO' || submissionType === 'VIDEO';
  const mediaLabel = submissionType === 'AUDIO' ? 'audio' : 'video';

  const recorderMimeType = useMemo(() => {
    if (submissionType === 'VIDEO') return 'video/webm';
    return 'audio/webm';
  }, [submissionType]);

  useEffect(() => {
    return () => {
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [recordedUrl]);

  useEffect(() => {
    if (!isMediaSubmission) {
      return;
    }

    if (submissionType !== 'VIDEO' || !previewRef.current) {
      return;
    }

    if (mediaStreamRef.current) {
      previewRef.current.srcObject = mediaStreamRef.current;
    }
  }, [isMediaSubmission, submissionType]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('Recording is not supported in this browser.');
      return;
    }

    try {
      setErrorMessage(null);
      setSuccessMessage(null);
      setRecordedBlob(null);

      const stream = await navigator.mediaDevices.getUserMedia(
        submissionType === 'VIDEO'
          ? { audio: true, video: true }
          : { audio: true }
      );

      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: recorderMimeType });
      mediaRecorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        const blob = new Blob(chunksRef.current, { type: recorderMimeType });
        const nextUrl = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl((previousUrl) => {
          if (previousUrl) {
            URL.revokeObjectURL(previousUrl);
          }
          return nextUrl;
        });
        setIsRecording(false);
      });

      if (submissionType === 'VIDEO' && previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.muted = true;
        previewRef.current.play().catch(() => undefined);
      }

      recorder.start();
      setIsRecording(true);
    } catch {
      setErrorMessage('Unable to start recording. Please allow microphone or camera access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const submitAssignment = async () => {
    if (isSubmitting) {
      return;
    }

    if (!canSubmit) {
      setErrorMessage('You cannot submit this assignment right now.');
      return;
    }

    if (isTextSubmission && textContent.trim().length === 0) {
      setErrorMessage('Please enter your response before submitting.');
      return;
    }

    if (isMediaSubmission && !recordedBlob) {
      setErrorMessage(`Record or attach a ${mediaLabel} submission before sending.`);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();

      if (isTextSubmission) {
        formData.append('textContent', textContent.trim());
      } else if (recordedBlob) {
        const extension = submissionType === 'VIDEO' ? 'webm' : 'webm';
        formData.append('submissionFile', recordedBlob, `${assignmentId}.${extension}`);
      }

      const response = await fetch(`/api/ec/${schoolSlug}/student/assignments/${assignmentId}/submissions`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || 'Unable to submit assignment.');
        return;
      }

      setSuccessMessage('Submission received successfully.');
      setTextContent('');
      setRecordedBlob(null);
      router.refresh();
    } catch {
      setErrorMessage('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Submission workspace</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Submit {assignmentTitle}</h2>
        </div>
        <div className="rounded-full bg-brandGreenSoft px-4 py-2 text-sm font-medium text-brandTealDeep">
          {remainingAttempts} of {maxAttempts} attempts left
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-brandGreen/20 bg-brandGreenSoft px-4 py-3 text-sm text-brandTealDeep">
            {successMessage}
          </div>
        ) : null}

        {isTextSubmission ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Text response</span>
            <textarea
              value={textContent}
              onChange={(event) => setTextContent(event.target.value)}
              rows={10}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 focus:border-brandGreen"
              placeholder="Type your response here..."
            />
          </label>
        ) : null}

        {isMediaSubmission ? (
          <div className="space-y-4">
            {submissionType === 'VIDEO' ? (
              <video
                ref={previewRef}
                playsInline
                autoPlay
                muted
                className="h-72 w-full rounded-3xl border border-slate-200 bg-slate-950 object-cover"
              />
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startRecording}
                disabled={isRecording || !canSubmit}
                className="rounded-full bg-brandGreen px-5 py-3 text-sm font-semibold text-brandTealDeep transition hover:bg-brandGreen/90 disabled:cursor-not-allowed disabled:bg-slate-200"
              >
                {isRecording ? 'Recording...' : `Record ${mediaLabel}`}
              </button>
              <button
                type="button"
                onClick={stopRecording}
                disabled={!isRecording}
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Stop
              </button>
            </div>

            {recordedUrl ? (
              submissionType === 'VIDEO' ? (
                <video src={recordedUrl} controls className="w-full rounded-3xl border border-slate-200 bg-slate-950" />
              ) : (
                <audio src={recordedUrl} controls className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-3" />
              )
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No {mediaLabel} recorded yet. Use the record button to capture your response.
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={submitAssignment}
            disabled={!canSubmit || isSubmitting}
            className="rounded-full bg-brandOrange px-5 py-3 text-sm font-semibold text-white transition hover:bg-brandOrangeDark disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
          </button>
          <p className="text-sm text-slate-500">
            Attempt {attemptsUsed + 1} of {maxAttempts}
          </p>
        </div>
      </div>
    </div>
  );
}
