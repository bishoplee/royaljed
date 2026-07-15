"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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
  studentName?: string | null;
  studentEmail?: string | null;
  lessonsPracticedCount?: number;
  assignmentsDoneCount?: number;
  assignmentsAssignedCount?: number;
  assignmentsPendingCount?: number;
}

export default function StudentPracticeDashboardClient({
  schoolSlug,
  lessons: initialLessons = [],
  practiceSessionCount = 0,
  studentName = null,
  studentEmail = null,
  lessonsPracticedCount = 0,
  assignmentsDoneCount = 0,
  assignmentsAssignedCount = 0,
  assignmentsPendingCount = 0,
}: Props) {
  const router = useRouter();
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
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number>(0);

  const greetingByTimeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const studentFirstName = useMemo(() => {
    if (!studentName) return 'Student';
    const first = studentName.trim().split(/\s+/)[0];
    return first || 'Student';
  }, [studentName]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const studentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const referenceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordPlayerRef = useRef<HTMLAudioElement | null>(null);
  const desktopProfileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileProfileMenuRef = useRef<HTMLDivElement | null>(null);

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
    const savedTheme = typeof window !== 'undefined' ? window.localStorage.getItem('student-dashboard-theme') : null;
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('student-dashboard-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewportHeight = () => {
      setViewportHeight(window.innerHeight);
    };

    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isMobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!isProfileMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inDesktop = desktopProfileMenuRef.current?.contains(target);
      const inMobile = mobileProfileMenuRef.current?.contains(target);

      if (!inDesktop && !inMobile) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

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
          ctx.strokeStyle = '#F26A19';
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
        ctx.strokeStyle = '#F26A19';
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

  const actionSubmitAssignment = () => {
    router.push(`/ec/${schoolSlug}/student/assignments`);
  };
  const actionViewProgress = () => setStatusMessage(`You have saved ${practiceSessionCount} practice session${practiceSessionCount === 1 ? '' : 's'}.`);

  const HomeIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );

  const LessonIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );

  const AssignmentIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M8 4h8" />
      <path d="M9 4h6v3H9z" />
      <rect x="5" y="7" width="14" height="13" rx="2" />
      <path d="M8 12h8M8 16h5" />
    </svg>
  );

  const MicIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11.5a6 6 0 0 0 12 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </svg>
  );

  const ProgressIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 16l4-5 4 3 6-7" />
      <path d="M4 20h16" />
    </svg>
  );

  const SparklesIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3l1.5 3.5L17 8l-3.5 1.5L12 13l-1.5-3.5L7 8l3.5-1.5L12 3z" />
      <path d="M5 14l.8 1.7L7.5 17l-1.7.8L5 19.5l-.8-1.7L2.5 17l1.7-.8L5 14z" />
      <path d="M19 14l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8.8-1.7z" />
    </svg>
  );

  const UserIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.4-3 3.8-4.5 7-4.5s5.6 1.5 7 4.5" />
    </svg>
  );

  const ThemeIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8z" />
    </svg>
  );

  const HelpIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.7-2.5 2-2.5 4" />
      <circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none" />
    </svg>
  );

  const LogoutIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M10 6H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
      <path d="M14 16l4-4-4-4" />
      <path d="M18 12H9" />
    </svg>
  );

  const ChevronRightIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );

  const MenuIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );

  const CloseIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );

  const navItems = [
    { key: 'home', label: 'Home', onClick: actionWatchLesson, Icon: HomeIcon },
    { key: 'lessons', label: 'Lessons', onClick: actionWatchLesson, Icon: LessonIcon },
    { key: 'assignments', label: 'Assignments', onClick: actionSubmitAssignment, Icon: AssignmentIcon },
    { key: 'practice', label: 'Practice', onClick: actionPracticeSpeaking, Icon: MicIcon },
    { key: 'progress', label: 'My Progress', onClick: actionViewProgress, Icon: ProgressIcon },
  ];

  const profileInitials = studentFirstName.slice(0, 2).toUpperCase();

  const navHeight = viewportHeight > 0 ? Math.max(420, viewportHeight - 64) : undefined;

  const dashboardCards = [
    { title: 'Lessons Watched', value: String(lessonsPracticedCount), label: `${lessons.length} available` },
    {
      title: 'Assignments Assigned',
      value: String(assignmentsAssignedCount),
      label: assignmentsAssignedCount > 0 ? 'Open assignment module' : 'No assignments yet',
    },
    {
      title: 'Assignments Done',
      value: String(assignmentsDoneCount),
      label: assignmentsDoneCount > 0 ? `${assignmentsDoneCount} submissions` : 'No assignments yet',
    },
    {
      title: 'Assignments Pending',
      value: String(assignmentsPendingCount),
      label: assignmentsPendingCount > 0 ? 'Awaiting your submission' : 'All clear',
    },
    { title: 'Practice Sessions', value: String(practiceSessionCount), label: 'Saved sessions' },
  ];

  return (
    <div className={`student-dashboard min-h-screen bg-[#e6e6e6] text-slate-900 font-sans ${isDarkMode ? 'student-dashboard-dark' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between md:hidden">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{schoolSlug.replace(/-/g, ' ').toUpperCase()}</p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Student Portal</h1>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700"
            aria-label="Open menu"
          >
            <MenuIcon className="h-6 w-6" />
          </button>
        </div>

        {isMobileNavOpen ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              aria-label="Close menu"
              className="absolute inset-0 bg-black/45"
            />
            <div className="absolute left-0 top-0 h-full w-[82%] max-w-xs border-r border-slate-200 bg-white p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Navigation</h2>
                <button
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-700"
                  aria-label="Close menu"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>

              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => {
                        item.onClick();
                        setIsMobileNavOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-medium bg-slate-50 text-slate-700 hover:bg-slate-100"
                    >
                      <item.Icon className="h-5 w-5" />
                      <span className="flex-1">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-slate-200 pt-4" ref={mobileProfileMenuRef}>
                <div className="relative">
                  {isProfileMenuOpen ? (
                    <div className="absolute bottom-full left-0 right-0 mb-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setStatusMessage('Profile settings will be available soon.');
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <UserIcon className="h-4 w-4" />
                        <span className="flex-1 text-left">Profile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDarkMode((prev) => !prev);
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <ThemeIcon className="h-4 w-4" />
                        <span className="flex-1 text-left">Theme</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusMessage('Help center will be available soon.');
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <HelpIcon className="h-4 w-4" />
                        <span className="flex-1 text-left">Help</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: `/auth/signin` })}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <LogoutIcon className="h-4 w-4" />
                        <span className="flex-1 text-left">Logout</span>
                      </button>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brandOrange text-xs font-semibold text-white">{profileInitials}</span>
                    <span className="flex-1 text-left">
                      <span className="block text-sm font-semibold text-slate-900">{studentFirstName}</span>
                      <span className="block text-xs text-slate-500">Student</span>
                    </span>
                    <ChevronRightIcon className={`h-4 w-4 text-slate-500 transition-transform ${isProfileMenuOpen ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-[88px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
          {/* Left navigation column (compact) */}
          <nav className="hidden md:sticky md:top-8 md:block md:self-start space-y-6" style={{ height: navHeight }}>
            <div className="dashboard-nav-card h-full rounded-[1.25rem] border border-[#d5d5d5] bg-[#f0f0f0] p-3 xl:p-4 overflow-hidden flex flex-col">
              <div className="m-4 mb-16">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{schoolSlug.replace(/-/g, ' ').toUpperCase()}</p>
                <h1 className="mt-2 hidden xl:block text-xl font-semibold tracking-tight text-slate-900">Student Portal</h1>
              </div>

              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={item.onClick}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm font-medium bg-slate-50 text-slate-700 hover:bg-slate-100"
                    >
                      <item.Icon className="h-5 w-5 shrink-0" />
                      <span className="hidden xl:inline flex-1">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-auto border-t border-slate-200 pt-4" ref={desktopProfileMenuRef}>
                <div className="relative">
                  {isProfileMenuOpen ? (
                    <div className="absolute bottom-full left-0 right-0 mb-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setStatusMessage('Profile settings will be available soon.');
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <UserIcon className="h-4 w-4" />
                        <span className="hidden xl:inline flex-1 text-left">Profile</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDarkMode((prev) => !prev);
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <ThemeIcon className="h-4 w-4" />
                        <span className="hidden xl:inline flex-1 text-left">Theme</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusMessage('Help center will be available soon.');
                          setIsProfileMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <HelpIcon className="h-4 w-4" />
                        <span className="hidden xl:inline flex-1 text-left">Help</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: `/auth/signin` })}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <LogoutIcon className="h-4 w-4" />
                        <span className="hidden xl:inline flex-1 text-left">Logout</span>
                      </button>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brandOrange text-xs font-semibold text-white">{profileInitials}</span>
                    <span className="hidden xl:block flex-1 text-left">
                      <span className="block text-sm font-semibold text-slate-900">{studentFirstName}</span>
                      <span className="block text-xs text-slate-500">Student</span>
                    </span>
                    <ChevronRightIcon className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isProfileMenuOpen ? 'rotate-90' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          </nav>

          {/* Main content column */}

          <main className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm" id="dashboard-header">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between mt-8 border-b-2 border-slate-200 pb-6">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-brandOrange">{greetingByTimeOfDay}! 👋</p>
                  <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">{studentFirstName}</h2>
                  <p className="mt-2 text-sm text-slate-600">{studentEmail ? `${studentEmail} · ` : ''}{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-brandOrange/20 bg-brandOrangeSoft text-lg font-semibold text-brandOrange">{(() => {
                  const total = lessons.length || 0;
                  const percent = total > 0 ? Math.round((lessonsPracticedCount / total) * 100) : 0;
                  return `${percent}%`;
                })()}</div>
              </div>

              <div className="mt-6 overflow-hidden bg-slate-50" id="dashboard-cards">
                <div className="grid sm:grid-cols-2 xl:grid-cols-4">
                  {dashboardCards.map((card, idx) => (
                    <div
                      key={card.title}
                      className={`px-5 py-6 ${
                        idx < dashboardCards.length - 1 ? 'border-b border-slate-200' : ''
                      } ${idx < 2 ? 'sm:border-b sm:border-slate-200' : 'sm:border-b-0'} ${
                        idx % 2 === 0 ? 'sm:border-r sm:border-slate-200' : 'sm:border-r-0'
                      } xl:border-b-0 ${idx < 3 ? 'xl:border-r xl:border-slate-200' : 'xl:border-r-0'}`}
                    >
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{card.title}</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-900">{card.value}</p>
                    <p className="mt-2 text-sm text-slate-500">{card.label}</p>
                  </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <a
                  href={`/api/ec/${schoolSlug}/student/reports/progress`}
                  download
                  className="rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition"
                >
                  Download Progress Report (PDF)
                </a>
                <button
                  type="button"
                  onClick={actionSubmitAssignment}
                  className="rounded-2xl bg-brandOrange px-4 py-2 text-xs font-semibold text-white transition hover:bg-brandOrangeDark"
                >
                  Open Assignment Module
                </button>
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
                      <button key={lesson.id} type="button" onClick={() => handleSelectLesson(lesson.id)} className={`w-full rounded-3xl border px-4 py-4 text-left transition ${selectedLessonId === lesson.id ? 'border-brandOrange bg-brandOrangeSoft shadow-sm' : 'border-slate-200 bg-white hover:border-brandOrange/40'}`}>
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
                  <button type="button" onClick={beginRecording} disabled={isRecording} className="rounded-3xl bg-brandOrange px-4 py-3 text-sm font-semibold text-white transition hover:bg-brandOrangeDark disabled:cursor-not-allowed disabled:bg-slate-300">Start Recording</button>
                  <button
                    type="button"
                    onClick={stopRecording}
                    disabled={!isRecording}
                    className="rounded-3xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:border disabled:border-slate-200 disabled:text-slate-600"
                  >
                    Stop Recording
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {recordedUrl ? <audio ref={recordPlayerRef} controls src={recordedUrl} className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-3" /> : <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Your recorded practice will appear here after you stop recording.</div>}
                  <button type="button" onClick={savePractice} disabled={!recordedBlob || isSaving} className="w-full rounded-3xl bg-brandOrange px-4 py-3 text-sm font-semibold text-white transition hover:bg-brandOrangeDark disabled:cursor-not-allowed disabled:bg-slate-300">{isSaving ? 'Saving...' : 'Save Practice Session'}</button>
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

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Achievements</p>
                <div className="mt-4 grid gap-2">
                  {['First Lesson', 'Rising Star', 'Voice Active'].map((title) => (
                    <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      <p className="font-semibold">{title}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
      <style jsx global>{`
        .student-dashboard-dark {
          background-color: #3b3b3b !important;
        }

        .student-dashboard-dark .dashboard-nav-card {
          background-color: #444444 !important;
          border-color: #595959 !important;
        }

        .student-dashboard-dark .bg-white {
          background-color: #444444 !important;
        }

        .student-dashboard-dark .bg-slate-50 {
          background-color: #4a4a4a !important;
        }

        .student-dashboard-dark .border-slate-200 {
          border-color: #595959 !important;
        }

        .student-dashboard-dark .text-slate-900 {
          color: #f2f2f2 !important;
        }

        .student-dashboard-dark .text-slate-700,
        .student-dashboard-dark .text-slate-600,
        .student-dashboard-dark .text-slate-500,
        .student-dashboard-dark .text-slate-400 {
          color: #cccccc !important;
        }

        .student-dashboard-dark .hover\\:bg-slate-100:hover,
        .student-dashboard-dark .hover\\:bg-slate-50:hover {
          background-color: #555555 !important;
        }

        .student-dashboard-dark .bg-black {
          background-color: #2f2f2f !important;
        }
      `}</style>
    </div>
  );
}
