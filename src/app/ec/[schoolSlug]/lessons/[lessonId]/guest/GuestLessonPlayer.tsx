'use client';

import { useEffect, useRef, useState } from 'react';

interface GuestLessonPlayerProps {
  streamUrl: string;
  title: string;
  description: string | null;
}

export default function GuestLessonPlayer({ streamUrl, title, description }: GuestLessonPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState('Preparing secure playback...');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hlsInstance: any = null;
    setStatus('Loading secure stream...');

    const playWithHls = async () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.load();
        setStatus('Secure stream ready');
        return;
      }

      try {
        const { default: Hls } = await import('hls.js');
        if (Hls.isSupported()) {
          hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          });
          hlsInstance.loadSource(streamUrl);
          hlsInstance.attachMedia(video);
          setStatus('Secure stream ready');
        } else {
          video.src = streamUrl;
          video.load();
          setStatus('This browser does not support adaptive streaming');
        }
      } catch (error) {
        console.error('HLS playback init failed', error);
        video.src = streamUrl;
        video.load();
        setStatus('Fallback playback enabled');
      }
    };

    playWithHls();

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [streamUrl]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Your secure access link is valid. The lesson player will load below.
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-3 shadow-sm">
        <video ref={videoRef} controls className="w-full rounded-xl bg-black" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="mt-1 text-sm text-slate-600">{description || 'This lesson has been shared with you through a secure access link.'}</div>
        <div className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">Playback status: {status}</div>
      </div>
    </div>
  );
}
