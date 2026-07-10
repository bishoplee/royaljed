'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  lessonType: 'VIDEO' | 'AUDIO' | 'TEXT';
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  videoPath: string | null;
  videoStatus: string | null;
  videoError: string | null;
  isFreePreview: boolean;
  active: boolean;
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  lessons: Lesson[];
}

interface CurriculumClientProps {
  schoolId: string;
  schoolSlug: string;
  initialModules: Module[];
}

interface TranscodeProgress {
  percent: number;
  statusText: string;
}

function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function normalizeProgress(progress: unknown): TranscodeProgress | null {
  if (!progress || typeof progress !== 'object') return null;

  const value = progress as Partial<TranscodeProgress>;
  const numericPercent = Number(value.percent);
  const percent = Number.isFinite(numericPercent)
    ? Math.max(0, Math.min(100, Math.round(numericPercent)))
    : 0;

  return {
    percent,
    statusText:
      typeof value.statusText === 'string' && value.statusText.trim()
        ? value.statusText
        : 'Processing video...',
  };
}

function TranscodeProgressIndicator({ progress }: { progress?: TranscodeProgress }) {
  const percent = progress?.percent ?? 0;
  const statusText = progress?.statusText || 'Preparing video processing...';
  const radius = 18;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-3 text-xs text-brandTeal font-medium bg-brandGreenSoft/50 border border-brandGreenDark/10 px-3 py-2 rounded-xl min-w-[220px]">
      <div className="relative w-11 h-11 flex-shrink-0">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 44 44">
          <circle
            cx="22"
            cy="22"
            r={radius}
            className="stroke-slate-200"
            strokeWidth="3.5"
            fill="none"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            className="stroke-brandTealDeep transition-all duration-300 ease-out"
            strokeWidth="3.5"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-brandTealDeep font-mono">
          {percent}%
        </div>
      </div>
      <div className="min-w-0 space-y-0.5">
        <div className="text-[11px] font-bold text-brandTealDeep uppercase tracking-wider">
          {percent}% Done
        </div>
        <div className="text-[10px] text-slate max-w-[190px] truncate" title={statusText}>
          {statusText}
        </div>
      </div>
    </div>
  );
}

export function CurriculumClient({ schoolId, schoolSlug, initialModules }: CurriculumClientProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [modules, setModules] = useState<Module[]>(initialModules);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Modals state
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  // Form states
  const [newModule, setNewModule] = useState({ title: '', description: '', level: 'BEGINNER' });
  const [newLesson, setNewLesson] = useState({
    moduleId: '',
    title: '',
    description: '',
    lessonType: 'VIDEO',
    level: 'BEGINNER',
    isFreePreview: false,
  });

  // Upload state
  const [uploadLessonId, setUploadLessonId] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState({ percent: 0, speed: '', status: '', loaded: 0, total: 0 });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'local' | 'drive'>('local');
  const [driveUrl, setDriveUrl] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Player state
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [playerLessonTitle, setPlayerLessonTitle] = useState('');
  const [watermarkPos, setWatermarkPos] = useState({ top: '20%', left: '20%' });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  // Keep modules in sync with server component props
  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  // Polling state for transcoding status
  const [pollingLessonId, setPollingLessonId] = useState<string | null>(null);
  const [transcodeProgress, setTranscodeProgress] = useState<Record<string, TranscodeProgress>>({});
  const processingLessonIds = useMemo(() => {
    const ids = new Set<string>();

    modules.forEach((mod) => {
      mod.lessons.forEach((lesson) => {
        if (lesson.videoStatus === 'PROCESSING') {
          ids.add(lesson.id);
        }
      });
    });

    if (pollingLessonId) {
      ids.add(pollingLessonId);
    }

    return Array.from(ids);
  }, [modules, pollingLessonId]);

  useEffect(() => {
    if (processingLessonIds.length === 0) return;

    let cancelled = false;

    const pollStatuses = async () => {
      try {
        const statusResults = await Promise.all(
          processingLessonIds.map(async (lessonId) => {
            const res = await fetch(`/api/ec/${schoolSlug}/admin/lessons/${lessonId}/status`);
            if (!res.ok) return null;
            const data = await res.json();
            return { lessonId, data };
          })
        );

        if (cancelled) return;

        let shouldRefresh = false;

        statusResults.forEach((result) => {
          if (!result) return;

          const { lessonId, data } = result;
          const progress = normalizeProgress(data.progress);

          if (progress) {
            setTranscodeProgress((prev) => ({
              ...prev,
              [lessonId]: progress,
            }));
          }

          if (data.videoStatus === 'READY' || data.videoStatus === 'FAILED') {
            setTranscodeProgress((prev) => {
              const next = { ...prev };
              delete next[lessonId];
              return next;
            });

            setModules((prev) =>
              prev.map((mod) => ({
                ...mod,
                lessons: mod.lessons.map((lesson) =>
                  lesson.id === lessonId
                    ? {
                        ...lesson,
                        videoPath: data.videoPath ?? lesson.videoPath,
                        videoStatus: data.videoStatus,
                        videoError: data.videoError ?? lesson.videoError,
                      }
                    : lesson
                ),
              }))
            );

            if (pollingLessonId === lessonId) {
              setPollingLessonId(null);
            }

            shouldRefresh = true;
          }
        });

        if (shouldRefresh) {
          router.refresh(); // Reload data from server
        }
      } catch (err) {
        console.error('Polling status error:', err);
      }
    };

    pollStatuses();
    const interval = setInterval(pollStatuses, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [processingLessonIds, pollingLessonId, schoolSlug, router]);

  // Watermark shifting effect
  useEffect(() => {
    if (!isPlayerOpen) return;

    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 70) + 15 + '%';
      const left = Math.floor(Math.random() * 70) + 15 + '%';
      setWatermarkPos({ top, left });
    }, 15000);

    return () => clearInterval(interval);
  }, [isPlayerOpen]);

  // HLS playback effect
  useEffect(() => {
    if (!isPlayerOpen || !activeLessonId || !videoRef.current) return;

    const video = videoRef.current;
    const streamUrl = `/api/ec/${schoolSlug}/lessons/${activeLessonId}/stream/index.m3u8`;
    let hlsInstance: any = null;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari/iOS support
      video.src = streamUrl;
    } else {
      // Use hls.js for other browsers
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          hlsInstance = new Hls();
          hlsInstance.loadSource(streamUrl);
          hlsInstance.attachMedia(video);
        }
      });
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [isPlayerOpen, activeLessonId, schoolSlug]);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModule.title.trim()) return;

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newModule),
      });

      if (res.ok) {
        setIsModuleModalOpen(false);
        setNewModule({ title: '', description: '', level: 'BEGINNER' });
        router.refresh();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error creating module');
    }
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLesson.moduleId || !newLesson.title.trim()) return;

    try {
      const res = await fetch(`/api/ec/${schoolSlug}/admin/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLesson),
      });

      if (res.ok) {
        setIsLessonModalOpen(false);
        setNewLesson({
          moduleId: '',
          title: '',
          description: '',
          lessonType: 'VIDEO',
          level: 'BEGINNER',
          isFreePreview: false,
        });
        router.refresh();
      } else {
        const errData = await res.json();
        alert(`Error: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error creating lesson');
    }
  };

  const handleStartUpload = (lessonId: string) => {
    setUploadLessonId(lessonId);
    setUploadFile(null);
    setUploadProgress({ percent: 0, speed: '', status: 'Please select a video file', loaded: 0, total: 0 });
    setUploadMode('local');
    setDriveUrl('');
    setImportError(null);
    setIsImporting(false);
    setIsUploadModalOpen(true);
  };

  const handleDriveImport = async () => {
    if (!driveUrl.trim() || !uploadLessonId) return;
    setIsImporting(true);
    setImportError(null);

    try {
      const response = await fetch(`/api/ec/${schoolSlug}/admin/lessons/upload/drive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: uploadLessonId,
          driveUrl: driveUrl.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize Drive import');
      }

      // Start polling for this lesson status immediately
      setPollingLessonId(uploadLessonId);
      setIsUploadModalOpen(false);

      // Auto-expand the module containing this lesson to show status bar
      const lessonObj = modules.flatMap(m => m.lessons).find(l => l.id === uploadLessonId);
      if (lessonObj) {
        setExpandedModules(prev => ({ ...prev, [lessonObj.moduleId]: true }));
      }

      router.refresh();
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || 'An unexpected error occurred during Google Drive import.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadFile(file);
      setUploadProgress({ percent: 0, speed: '', status: 'File selected. Ready to upload.', loaded: 0, total: file.size });
    }
  };

  const executeUpload = async () => {
    if (!uploadFile || !uploadLessonId) return;
    setIsUploading(true);

    const file = uploadFile;
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      // 1. Initialize upload session
      setUploadProgress({ percent: 0, speed: '---', status: 'Initializing upload...', loaded: 0, total: file.size });
      const initRes = await fetch(`/api/ec/${schoolSlug}/admin/lessons/upload/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          lessonId: uploadLessonId,
        }),
      });

      if (!initRes.ok) {
        throw new Error('Failed to initialize upload session');
      }

      const { uploadId, chunkSize } = await initRes.json();

      // 2. Upload chunks sequentially
      let totalUploadedBytes = 0;
      const startTime = Date.now();

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('uploadId', uploadId);
        formData.append('chunkIndex', i.toString());
        formData.append('chunk', chunk);

        let success = false;
        let attempts = 3;

        while (!success && attempts > 0) {
          try {
            const chunkStartTime = Date.now();
            const chunkRes = await fetch(`/api/ec/${schoolSlug}/admin/lessons/upload/chunk`, {
              method: 'POST',
              body: formData,
            });

            if (chunkRes.ok) {
              success = true;
              totalUploadedBytes += chunk.size;

              const elapsedSeconds = (Date.now() - startTime) / 1000;
              const currentSpeed = (totalUploadedBytes / (1024 * 1024)) / elapsedSeconds; // MB/s
              const percent = Math.round((totalUploadedBytes / file.size) * 100);

              setUploadProgress({
                percent,
                speed: `${currentSpeed.toFixed(1)} MB/s`,
                status: `Uploading chunk ${i + 1} of ${totalChunks}...`,
                loaded: totalUploadedBytes,
                total: file.size,
              });
            } else {
              attempts--;
            }
          } catch (e) {
            attempts--;
            if (attempts === 0) throw e;
          }
        }
      }

      // 3. Finalize merge
      setUploadProgress({ percent: 100, speed: '---', status: 'Merging chunks on server...', loaded: file.size, total: file.size });
      const completeRes = await fetch(`/api/ec/${schoolSlug}/admin/lessons/upload/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          lessonId: uploadLessonId,
          totalChunks,
        }),
      });

      if (!completeRes.ok) {
        throw new Error('Failed to finalize chunk merger');
      }

      setUploadProgress({
        percent: 100,
        speed: '---',
        status: 'Upload complete! background transcoding in progress...',
        loaded: file.size,
        total: file.size,
      });

      // Close upload modal, activate status polling
      setTimeout(() => {
        setIsUploadModalOpen(false);
        setIsUploading(false);
        setPollingLessonId(uploadLessonId);
        router.refresh();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setUploadProgress({
        percent: 0,
        speed: '0',
        status: `Upload failed: ${err.message || 'Unknown network error'}`,
        loaded: 0,
        total: 0,
      });
      setIsUploading(false);
    }
  };

  const handlePlayVideo = (lesson: Lesson) => {
    setActiveLessonId(lesson.id);
    setPlayerLessonTitle(lesson.title);
    setIsPlayerOpen(true);
  };

  const userEmail = session?.user?.email || 'admin@royaljed.com';
  const userName = session?.user?.name || 'Administrator';
  const dateStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex items-center gap-4 bg-canvas border border-slate/10 p-4 rounded-lg">
        <button
          onClick={() => setIsModuleModalOpen(true)}
          className="rounded-full bg-brandTealDeep hover:bg-brandTealDeep/90 text-white font-medium text-xs px-5 py-2.5 transition-colors"
        >
          ➕ Add Curriculum Module
        </button>

        {processingLessonIds.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-xs font-semibold text-brandTeal animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-brandTeal" />
            <span>Video processing in progress... Page will auto-update.</span>
          </div>
        )}
      </div>

      {/* Modules List Accordion */}
      {modules.length === 0 ? (
        <div className="bg-canvas border border-slate/10 p-12 text-center rounded-lg text-slate text-sm">
          No curriculum modules created yet. Get started by adding a module above.
        </div>
      ) : (
        <div className="space-y-4">
          {modules.map((mod) => {
            const isExpanded = expandedModules[mod.id] ?? true;
            return (
              <div key={mod.id} className="bg-canvas border border-slate/25 rounded-xl overflow-hidden shadow-sm transition-all">
                {/* Module Header Container */}
                <div className="flex items-stretch bg-slate/10 border-b border-slate/20">
                  {/* Clickable Header Area (Toggles expansion) */}
                  <div
                    onClick={() => toggleModule(mod.id)}
                    className="flex-1 flex items-center justify-between p-5 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <h3 className="font-semibold text-ink text-sm md:text-base tracking-tight">{mod.title}</h3>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          mod.level === 'BEGINNER'
                            ? 'bg-emerald-100/75 text-emerald-800'
                            : mod.level === 'INTERMEDIATE'
                            ? 'bg-amber-100/75 text-amber-800'
                            : 'bg-red-100/75 text-red-800'
                        }`}
                      >
                        {mod.level}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-slate-400 text-xs md:text-sm pr-2">
                      <span>{mod.lessons.length} Lessons</span>
                      <span className="text-[10px] text-slate-500">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Far-Right Separated Add Lesson Action */}
                  <div className="border-l border-slate-400 px-5 flex items-center justify-center flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewLesson((prev) => ({ ...prev, moduleId: mod.id }));
                        setIsLessonModalOpen(true);
                      }}
                      className="rounded-full bg-brandGreen hover:bg-brandGreen/90 text-brandTealDeep font-semibold text-xs px-8 py-2.5 transition-colors border border-brandGreen/20 shadow-sm flex items-center gap-1.5"
                    >
                      <span className="text-sm font-bold leading-none">+</span> Add Lesson
                    </button>
                  </div>
                </div>

                {/* Module Lessons list */}
                {isExpanded && (
                  <div className="divide-y divide-slate/5 bg-canvas">
                    {mod.description && (
                      <div className="p-4 bg-slate-50/50 text-xs text-slate border-b border-slate/5 italic">
                        {mod.description}
                      </div>
                    )}
                    {mod.lessons.length === 0 ? (
                      <div className="py-8 text-center text-xs md:text-sm text-slate-400 bg-white">
                        No lessons created in this module yet.
                      </div>
                    ) : (
                      mod.lessons.map((lesson, index) => (
                        <div key={lesson.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface/40 transition-colors">
                          <div className="space-y-1 max-w-xl">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-sm text-ink">
                                <span className="text-slate-400 mr-1 font-semibold">{index + 1}.</span> {lesson.title}
                              </h4>
                              <span className="text-[10px] font-bold bg-brandGreenSoft text-brandGreenDark px-2 py-0.5 rounded uppercase">
                                {lesson.lessonType}
                              </span>
                              <span className="text-[10px] font-medium text-slate">
                                Level: {lesson.level}
                              </span>
                              {lesson.isFreePreview && (
                                <span className="text-[9px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                                  FREE PREVIEW
                                </span>
                              )}
                            </div>
                            {lesson.description && (
                              <p className="text-xs text-slate line-clamp-2">{lesson.description}</p>
                            )}
                          </div>

                          {/* Video action triggers */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {lesson.lessonType === 'VIDEO' ? (
                              <>
                                {lesson.videoStatus === 'READY' && (
                                  <button
                                    onClick={() => handlePlayVideo(lesson)}
                                    className="rounded-full bg-brandGreen/20 hover:bg-brandGreen text-brandGreenDark hover:text-brandTealDeep font-semibold text-xs px-4 py-2 transition-all"
                                  >
                                    ▶ Stream Video
                                  </button>
                                )}
                                {lesson.videoStatus === 'PROCESSING' && (
                                  <TranscodeProgressIndicator progress={transcodeProgress[lesson.id]} />
                                )}
                                {lesson.videoStatus === 'FAILED' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded" title={lesson.videoError || 'Unknown Error'}>
                                      ❌ Failed
                                    </span>
                                    <button
                                      onClick={() => handleStartUpload(lesson.id)}
                                      className="rounded-full bg-red-600 hover:bg-red-700 text-white font-medium text-xs px-3.5 py-1.5 transition-colors"
                                    >
                                      Retry Upload
                                    </button>
                                  </div>
                                )}
                                {(!lesson.videoStatus || lesson.videoStatus === 'PENDING') && (
                                  <button
                                    onClick={() => handleStartUpload(lesson.id)}
                                    title="Upload Video"
                                    className="w-8 h-8 rounded-full bg-brandTealDeep hover:bg-brandTealDeep/90 text-white flex items-center justify-center transition-colors text-sm shadow-sm"
                                  >
                                    📤
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 font-mono">Static Content</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 1. Add Module Modal */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-brandTealDeep/60 backdrop-blur-sm" onClick={() => setIsModuleModalOpen(false)} />
          <div className="bg-canvas border border-slate/10 rounded-lg shadow-xl max-w-md w-full p-6 relative z-10 font-sans">
            <h3 className="text-lg font-bold text-ink tracking-tight border-b border-slate/5 pb-3">Create Curriculum Module</h3>
            <form onSubmit={handleCreateModule} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Module Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Module 1: Introductory Vowels & Diphthongs"
                  value={newModule.title}
                  onChange={(e) => setNewModule({ ...newModule, title: e.target.value })}
                  className="w-full text-sm border border-slate/20 rounded p-2.5 focus:border-brandGreen focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Brief synopsis of core phonetics objectives..."
                  value={newModule.description}
                  onChange={(e) => setNewModule({ ...newModule, description: e.target.value })}
                  className="w-full text-sm border border-slate/20 rounded p-2.5 focus:border-brandGreen focus:outline-none h-24 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Difficulty Level</label>
                <select
                  value={newModule.level}
                  onChange={(e) => setNewModule({ ...newModule, level: e.target.value })}
                  className="w-full text-sm border border-slate/20 rounded p-2.5 focus:border-brandGreen focus:outline-none bg-canvas"
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate/5">
                <button
                  type="button"
                  onClick={() => setIsModuleModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-brandGreen text-brandTealDeep font-semibold text-xs px-5 py-2.5 transition-colors border border-brandTealDeep/10"
                >
                  Create Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Lesson Modal */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-brandTealDeep/60 backdrop-blur-sm" onClick={() => setIsLessonModalOpen(false)} />
          <div className="bg-canvas border border-slate/10 rounded-lg shadow-xl max-w-md w-full p-6 relative z-10 font-sans">
            <h3 className="text-lg font-bold text-ink tracking-tight border-b border-slate/5 pb-3">Add Lesson Content</h3>
            <form onSubmit={handleCreateLesson} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Parent Module</label>
                <select
                  required
                  value={newLesson.moduleId}
                  onChange={(e) => setNewLesson({ ...newLesson, moduleId: e.target.value })}
                  className="w-full text-sm border border-slate/20 rounded p-2.5 focus:border-brandGreen focus:outline-none bg-canvas"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.level})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Lesson Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Short Vowel /æ/ vs Long Vowel /ɑː/"
                  value={newLesson.title}
                  onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
                  className="w-full text-sm border border-slate/20 rounded p-2.5 focus:border-brandGreen focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Provide students with pronunciation tips or exercise instructions..."
                  value={newLesson.description}
                  onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })}
                  className="w-full text-sm border border-slate/20 rounded p-2.5 focus:border-brandGreen focus:outline-none h-20 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Lesson Type</label>
                  <select
                    value={newLesson.lessonType}
                    onChange={(e) => setNewLesson({ ...newLesson, lessonType: e.target.value })}
                    className="w-full text-sm border border-slate/20 rounded p-2.5 focus:border-brandGreen focus:outline-none bg-canvas"
                  >
                    <option value="VIDEO">Video Lecture</option>
                    <option value="AUDIO">Audio Exercise</option>
                    <option value="TEXT">Text Syllabus</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-1">Target Level</label>
                  <select
                    value={newLesson.level}
                    onChange={(e) => setNewLesson({ ...newLesson, level: e.target.value as any })}
                    className="w-full text-sm border border-slate/20 rounded p-2.5 focus:border-brandGreen focus:outline-none bg-canvas"
                  >
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 py-1.5">
                <input
                  type="checkbox"
                  id="isFreePreview"
                  checked={newLesson.isFreePreview}
                  onChange={(e) => setNewLesson({ ...newLesson, isFreePreview: e.target.checked })}
                  className="w-4 h-4 text-brandGreen border-slate/30 rounded focus:ring-0 focus:ring-offset-0"
                />
                <label htmlFor="isFreePreview" className="text-xs text-slate select-none cursor-pointer">
                  Allow non-registered guest preview (Secure Links)
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate/5">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-brandGreen text-brandTealDeep font-semibold text-xs px-5 py-2.5 transition-colors border border-brandTealDeep/10"
                >
                  Save Lesson
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Chunked Upload & Drive Import Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-brandTealDeep/60 backdrop-blur-sm" />
          <div className="bg-canvas border border-slate/10 rounded-lg shadow-xl max-w-md w-full p-6 relative z-10 font-sans">
            <h3 className="text-lg font-bold text-ink tracking-tight border-b border-slate/5 pb-3">
              Add Lesson Video
            </h3>
            
            {/* Tab Selection */}
            <div className="mt-4 flex border border-slate/10 bg-surface rounded-lg p-1 text-xs">
              <button
                type="button"
                disabled={isUploading || isImporting}
                onClick={() => setUploadMode('local')}
                className={`flex-1 text-center py-1.5 font-medium rounded transition-colors ${
                  uploadMode === 'local'
                    ? 'bg-brandGreen text-brandTealDeep font-semibold'
                    : 'text-slate hover:text-ink disabled:opacity-50'
                }`}
              >
                📁 Local File
              </button>
              <button
                type="button"
                disabled={isUploading || isImporting}
                onClick={() => setUploadMode('drive')}
                className={`flex-1 text-center py-1.5 font-medium rounded transition-colors ${
                  uploadMode === 'drive'
                    ? 'bg-brandGreen text-brandTealDeep font-semibold'
                    : 'text-slate hover:text-ink disabled:opacity-50'
                }`}
              >
                ▲ Google Drive Link
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {uploadMode === 'local' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                      Select Video File (MP4, WebM, MOV - Max 500MB)
                    </label>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime"
                      disabled={isUploading}
                      onChange={handleFileChange}
                      className="w-full text-xs text-slate file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brandGreenSoft file:text-brandGreenDark hover:file:bg-brandGreenSoft/80 cursor-pointer disabled:opacity-50"
                    />
                  </div>

                  {/* Progress Indicator */}
                  {(uploadProgress.percent > 0 || isUploading) && (
                    <div className="flex items-center gap-4 bg-surface border border-slate/10 p-4 rounded-xl">
                      {/* Circular Progress Ring on the Left */}
                      <div className="relative w-12 h-12 flex-shrink-0">
                        {/* Background Ring */}
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            className="stroke-slate-200"
                            strokeWidth="3.5"
                            fill="none"
                          />
                          {/* Animated Progress Ring */}
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            className="stroke-brandTealDeep transition-all duration-350 ease-out"
                            strokeWidth="3.5"
                            fill="none"
                            strokeDasharray={2 * Math.PI * 20}
                            strokeDashoffset={2 * Math.PI * 20 * (1 - uploadProgress.percent / 100)}
                            strokeLinecap="round"
                          />
                        </svg>
                        {/* Percentage inside Ring */}
                        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-brandTealDeep font-mono">
                          {uploadProgress.percent}%
                        </div>
                      </div>

                      {/* Text info on the Right */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-brandTealDeep uppercase tracking-wider">
                            {uploadProgress.percent}% Done
                          </span>
                          {uploadProgress.speed && (
                            <span className="text-[10px] font-semibold text-slate font-mono">
                              {uploadProgress.speed}
                            </span>
                          )}
                        </div>
                        
                        <p className="text-[10px] text-slate truncate font-sans">
                          {uploadProgress.status}
                        </p>
                        
                        {uploadProgress.total > 0 && (
                          <div className="text-[10px] font-medium text-slate font-mono">
                            {formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate uppercase tracking-wider mb-2">
                      Google Drive Public Link
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://drive.google.com/file/d/..."
                      value={driveUrl}
                      disabled={isImporting}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      className="w-full text-xs bg-surface border border-slate/15 rounded-lg p-2.5 outline-none focus:border-brandTealDeep text-ink disabled:opacity-50"
                    />
                  </div>

                  <div className="bg-brandGreenSoft border border-brandGreenDark/10 text-brandGreenDark text-[10px] p-3 rounded-lg leading-relaxed space-y-1">
                    <p className="font-semibold">💡 Requirements for Google Drive links:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>File sharing settings must be set to <strong>&quot;Anyone with the link can view&quot;</strong>.</li>
                      <li>Supports standard Google Drive URL sharing formats.</li>
                      <li>Import runs in the background. Transcoding progress will auto-update on the module lists.</li>
                    </ul>
                  </div>

                  {importError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg leading-normal">
                      ⚠️ {importError}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate/5">
                <button
                  type="button"
                  disabled={isUploading || isImporting}
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate hover:text-ink transition-colors disabled:opacity-30"
                >
                  Cancel
                </button>
                {uploadMode === 'local' ? (
                  <button
                    type="button"
                    disabled={isUploading || !uploadFile}
                    onClick={executeUpload}
                    className="rounded-full bg-brandTealDeep hover:bg-brandTealDeep/90 text-white font-medium text-xs px-5 py-2.5 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Start Chunked Upload'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isImporting || !driveUrl.trim()}
                    onClick={handleDriveImport}
                    className="rounded-full bg-brandTealDeep hover:bg-brandTealDeep/90 text-white font-medium text-xs px-5 py-2.5 transition-colors disabled:opacity-50"
                  >
                    {isImporting ? 'Importing...' : 'Submit Import'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Secure Video Player Modal */}
      {isPlayerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-brandTealDeep/80 backdrop-blur-sm" onClick={() => setIsPlayerOpen(false)} />
          <div className="bg-canvas border border-slate/10 rounded-lg shadow-2xl max-w-3xl w-full overflow-hidden relative z-10 font-sans">
            {/* Player Header */}
            <div className="bg-surface px-5 py-3 border-b border-slate/10 flex items-center justify-between">
              <h3 className="font-bold text-ink text-sm tracking-tight truncate max-w-md">
                Secure HLS Stream: {playerLessonTitle}
              </h3>
              <button
                onClick={() => setIsPlayerOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate/10 flex items-center justify-center text-slate hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* Video Container */}
            <div
              ref={playerContainerRef}
              className="relative aspect-video bg-black flex items-center justify-center select-none"
              onContextMenu={(e) => e.preventDefault()} // Disable right clicks
            >
              <video
                ref={videoRef}
                controls
                autoPlay
                className="w-full h-full object-contain"
                onContextMenu={(e) => e.preventDefault()}
                controlsList="nodownload" // Disable standard download button
              />

              {/* Secure Watermark Overlay */}
              <div
                className="absolute text-[10px] text-white/10 font-semibold select-none pointer-events-none transition-all duration-1000 ease-in-out uppercase tracking-widest whitespace-nowrap bg-black/10 px-2.5 py-1 rounded border border-white/5 backdrop-blur-[0.5px]"
                style={{
                  top: watermarkPos.top,
                  left: watermarkPos.left,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {userName} ({userEmail})<br />
                IP: 127.0.0.1 | Date: {dateStr}
              </div>
            </div>

            {/* Footer warning */}
            <div className="bg-brandTealDeep text-white/50 text-[10px] py-2 px-5 text-center font-sans tracking-wide">
              🔒 ROYALJED AUDIO-VISUAL ENGINE. SECURED VIA AUTHENTICATED HLS LINK ENGINE. ALL ACTIVITIES LOGGED.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
