"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';

interface LessonItem {
  id: string;
  title: string;
  description?: string | null;
  lessonType: 'VIDEO' | 'AUDIO' | 'TEXT';
  level: string;
  moduleTitle: string;
  videoPath?: string | null;
  streamUrl?: string | null;
}

interface Props {
  schoolSlug: string;
  lessons?: LessonItem[];
  practiceSessionCount?: number;
}

export default function StudentPracticeDashboardClient({
  schoolSlug,
  lessons: initialLessons = [],
  practiceSessionCount = 0,
}: Props) {
  const [lessons, setLessons] = useState<LessonItem[]>(initialLessons || []);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const selectedLesson = useMemo(() => lessons.find((l) => l.id === selectedLessonId) ?? null, [lessons, selectedLessonId]);

  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const studentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const referenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordPlayerRef = useRef<HTMLAudioElement | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const studentAnalyserRef = useRef<AnalyserNode | null>(null);
  const referenceAnalyserRef = useRef<AnalyserNode | null>(null);
  const hlsRef = useRef<any | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const getExtensionFromMime = (mime: string) => {
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
    if (mime.includes('wav')) return 'wav';
    if (mime.includes('webm')) return 'webm';
    return 'dat';
  };

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) {
          // ignore
        }
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => undefined);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedLesson) return;

    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    if (selectedLesson.lessonType === 'VIDEO' && selectedLesson.streamUrl && videoRef.current) {
      const video = videoRef.current;
      video.crossOrigin = 'anonymous';
      video.muted = false;

      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(selectedLesson.streamUrl!);
          hls.attachMedia(video);
          hlsRef.current = hls;
        } else {
          video.src = selectedLesson.streamUrl!;
        }
      });
    }
  }, [selectedLesson]);

  const beginRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Audio recording is not supported in this browser.');
      return;
    }

    try {
      setErrorMessage(null);
      setSavedMessage(null);
      setStatusMessage('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      const chunks: BlobPart[] = [];

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });

      recorder.addEventListener('stop', () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setStatusMessage('Recording complete. Play it back and save it when ready.');

        if (studentAnalyserRef.current) {
          studentAnalyserRef.current.disconnect();
          studentAnalyserRef.current = null;
        }

        if (audioContextRef.current) {
          audioContextRef.current.close().catch(() => undefined);
          audioContextRef.current = null;
        }
      });

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      studentAnalyserRef.current = analyser;

      const canvas = studentCanvasRef.current;
      if (canvas) {
        const draw = () => {
          if (!studentAnalyserRef.current || !canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const width = canvas.width;
          const height = canvas.height;
          const dataArray = new Uint8Array(studentAnalyserRef.current.fftSize);
          studentAnalyserRef.current.getByteTimeDomainData(dataArray);

          ctx.fillStyle = 'rgba(255,255,255,0.1)';
          ctx.fillRect(0, 0, width, height);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#00ED64';
          ctx.beginPath();

          const sliceWidth = width / dataArray.length;
          let x = 0;

          for (let i = 0; i < dataArray.length; i += 1) {
            const v = dataArray[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            x += sliceWidth;
          }

          ctx.lineTo(width, height / 2);
          ctx.stroke();
          animationFrameRef.current = window.requestAnimationFrame(draw);
        };

        draw();
      }

      recorder.start();
      setIsRecording(true);
      setStatusMessage('Recording live. Speak clearly into your microphone.');
    } catch (err) {
      setErrorMessage('Unable to start audio recording. Please allow microphone access.');
      setStatusMessage('Recording failed to start.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
  };

  const savePractice = async () => {
    if (!selectedLesson || !recordedBlob) {
      setErrorMessage('Please select a lesson and record audio before saving.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSavedMessage(null);
    setStatusMessage('Saving your practice session...');

    try {
      const formData = new FormData();
      formData.append('lessonId', selectedLesson.id);
      const extension = getExtensionFromMime(recordedBlob.type);
      formData.append('studentAudio', recordedBlob, `practice-${selectedLesson.id}.${extension}`);

      const res = await fetch(`/api/ec/${schoolSlug}/student/practice-sessions`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Unable to save practice session.');
        setStatusMessage('Practice session could not be saved.');
      } else {
        setSavedMessage('Your practice session was saved successfully. You can repeat the drill anytime.');
        setStatusMessage('Practice session saved. Great work!');
      }
    } catch (err) {
      setErrorMessage('Unable to save practice session. Please try again.');
      setStatusMessage('Practice save failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const startReferenceVisualization = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const AudioCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtor) return;

      const audioContext = new AudioCtor();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaElementSource(video);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      referenceAnalyserRef.current = analyser;

      const canvas = referenceCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const draw = () => {
        if (!referenceAnalyserRef.current) return;
        const width = canvas.width;
        const height = canvas.height;
        const bufferLength = referenceAnalyserRef.current.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        referenceAnalyserRef.current.getByteTimeDomainData(dataArray);

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, 0, width, height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00684A';
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i += 1) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animationFrameRef.current = window.requestAnimationFrame(draw);
      };

      await audioContext.resume();
      draw();
    } catch {
      // continue without visualization if it fails
    }
  };

  const handleSelectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setSavedMessage(null);
    setErrorMessage(null);
    setStatusMessage('Ready for lesson practice. Press Record to start.');
  };

  const actionWatchLesson = () => {
    if (lessons.length > 0) handleSelectLesson(lessons[0].id);
  };

  const actionPracticeSpeaking = () => {
    if (!selectedLessonId && lessons.length > 0) handleSelectLesson(lessons[0].id);
    const panel = document.getElementById('practice-panel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const actionSubmitAssignment = () => setStatusMessage('Assignment submission will be available soon.');
  const actionViewProgress = () => setStatusMessage(`You have saved ${practiceSessionCount} practice session${practiceSessionCount === 1 ? '' : 's'}.`);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{schoolSlug.replace(/-/g, ' ').toUpperCase()}</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Student Portal</h1>
                <p className="mt-2 text-sm text-slate-600">Welcome back, Demo Student</p>
              </div>

              <div className="space-y-2">
                {['Home', 'Lessons', 'Assignments', 'Practice', 'My Progress'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-3xl px-4 py-3 text-left text-sm font-medium transition ${
                      item === 'Practice' ? 'bg-brandTeal text-white shadow-sm' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                    onClick={
                      item === 'Home'
                        ? actionWatchLesson
                        : item === 'Lessons'
                        ? actionWatchLesson
                        : item === 'Assignments'
                        ? actionSubmitAssignment
                        : item === 'Practice'
                        ? actionPracticeSpeaking
                        : actionViewProgress
                    }
                  >
                    <span>{item}</span>
                    <span className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Go</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: `/auth/signin?school=${encodeURIComponent(schoolSlug)}` })}
                className="mt-6 w-full rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Sign Out
              </button>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-500">My Achievements</p>
              <div className="mt-5 grid gap-3">
                {['First Lesson', 'Rising Star', 'First Submit', 'Voice Active', 'Top Performer', 'On Fire'].map((title) => (
                  <div key={title} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                    <div className="mb-2 h-3 w-14 rounded-full bg-slate-300" />
                    <p className="font-semibold">{title}</p>
                    <p className="text-xs text-slate-400">Locked — keep learning to unlock</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-brandTeal">Good morning! 👋</p>
                  <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">Demo</h2>
                  <p className="mt-2 text-sm text-slate-600">Oshewolo Demo School · {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-brandTeal/10 bg-brandTealSoft text-lg font-semibold text-brandTeal">0%</div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[{ title: 'Lessons Watched', value: selectedLesson ? '1' : '0', label: `${lessons.length} available` }, { title: 'Assignments Done', value: '0', label: 'No assignments yet' }, { title: 'Average Score', value: '-', label: 'Practice score pending' }, { title: 'Practice Sessions', value: String(practiceSessionCount), label: 'Saved sessions' }].map((card) => (
                  <div key={card.title} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-6">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{card.title}</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
                    <p className="mt-2 text-sm text-slate-500">{card.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]" id="practice-panel">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Available Practice Lessons</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">Choose your next drill</h3>
                  </div>
                  <p className="text-sm text-slate-500">{lessons.length} active lessons</p>
                </div>

                <div className="mt-5 space-y-3">
                  {lessons.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">No lessons are available yet.</div>
                  ) : (
                    lessons.map((lesson) => (
                      <button key={lesson.id} type="button" onClick={() => handleSelectLesson(lesson.id)} className={`w-full rounded-3xl border px-4 py-4 text-left transition ${selectedLessonId === lesson.id ? 'border-brandTeal bg-brandTealSoft shadow-sm' : 'border-slate-200 bg-white hover:border-brandTeal/40'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{lesson.title}</p>
                            <p className="mt-1 text-sm text-slate-500">{lesson.moduleTitle}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">{lesson.lessonType}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button type="button" onClick={beginRecording} disabled={isRecording} className="rounded-3xl bg-brandTeal px-4 py-3 text-sm font-semibold text-white transition hover:bg-brandTealDark disabled:cursor-not-allowed disabled:bg-slate-300">Start Recording</button>
                  <button type="button" onClick={stopRecording} disabled={!isRecording} className="rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Stop Recording</button>
                </div>

                <div className="mt-6 space-y-4">
                  {recordedUrl ? <audio ref={recordPlayerRef} controls src={recordedUrl} className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-3" /> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Your recorded practice will appear here after you stop recording.</div>}
                  <button type="button" onClick={savePractice} disabled={!recordedBlob || isSaving} className="w-full rounded-3xl bg-brandGreen px-4 py-3 text-sm font-semibold text-brandTealDark transition hover:bg-brandGreen/90 disabled:cursor-not-allowed disabled:bg-slate-300">{isSaving ? 'Saving...' : 'Save Practice Session'}</button>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div>
                    <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Current Lesson</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">{selectedLesson?.title || 'Select a lesson'}</h3>
                    <p className="mt-2 text-sm text-slate-600">{selectedLesson?.description || 'Pick a lesson to load the reference player and waveform view.'}</p>
                  </div>

                  {selectedLesson?.lessonType === 'VIDEO' ? (
                    <div className="mt-6 space-y-5">
                      <div className="aspect-video overflow-hidden rounded-3xl border border-slate-200 bg-black">
                        <video ref={videoRef} controls className="h-full w-full bg-black object-cover" playsInline onPlay={startReferenceVisualization} />
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">Reference Waveform</p>
                          <canvas ref={referenceCanvasRef} className="mt-3 h-36 w-full rounded-3xl bg-white" width={640} height={160} />
                        </div>
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-900">Your Voice Waveform</p>
                          <canvas ref={studentCanvasRef} className="mt-3 h-36 w-full rounded-3xl bg-white" width={640} height={160} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Practice playback is supported for video lessons. Select a video lesson to begin.</div>
                  )}
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">How to use this drill</h3>
                  <ol className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 list-decimal list-inside">
                    <li>Select a lesson from the list.</li>
                    <li>Press <strong>Start Recording</strong> and practice along with the lesson.</li>
                    <li>Stop the recording and review your audio.</li>
                    <li>Save your session for later review.</li>
                  </ol>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
