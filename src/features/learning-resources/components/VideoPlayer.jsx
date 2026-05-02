// VideoPlayer.jsx — Plyr-based version
import React, { useMemo, useEffect, useRef } from 'react';
import Plyr from 'plyr-react';
import 'plyr-react/plyr.css';

const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com'];
const VIMEO_HOSTS = ['vimeo.com', 'player.vimeo.com'];

const isYouTube = (url) => {
  try {
    const u = new URL(url);
    return YOUTUBE_HOSTS.some(h => u.hostname.includes(h.replace('www.', '')));
  } catch { return false; }
};

const isVimeo = (url) => {
  try {
    const u = new URL(url);
    return VIMEO_HOSTS.some(h => u.hostname.includes(h.replace('www.', '')));
  } catch { return false; }
};

const isDirectVideo = (url) => /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|$)/i.test(url || '');

const guessMimeType = (url) => {
  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'ogg':
    case 'ogv': return 'video/ogg';
    case 'mov': return 'video/quicktime';
    case 'm4v': return 'video/x-m4v';
    default: return 'video/mp4';
  }
};

const defaultControls = [
  'play-large','play','progress','current-time','mute','volume','settings','pip','airplay','fullscreen'
];

export default function VideoPlayer({ url, title, onReady, onProgress, onStateChange, className, style }) {
  const plyrRef = useRef(null);

  const options = useMemo(() => ({
    controls: defaultControls,
    settings: ['speed'],
    youtube: { noCookie: true, rel: 0, modestbranding: 1, iv_load_policy: 3, playsinline: 1 },
    vimeo: { byline: false, portrait: false, title: false },
  }), []);

  // Attach Plyr events via ref — only when callers actually provide callbacks.
  useEffect(() => {
    if (!onReady && !onProgress && !onStateChange) return;
    const p = plyrRef.current?.plyr;
    if (!p || typeof p.on !== 'function') return;
    if (onReady) onReady(p);
    const onTime = () => { onProgress && onProgress(p.currentTime || 0, p.duration || 0); };
    const onPlay = () => onStateChange && onStateChange('PLAYING');
    const onPause = () => onStateChange && onStateChange('PAUSED');
    const onEnd = () => onStateChange && onStateChange('ENDED');
    p.on('timeupdate', onTime);
    p.on('playing', onPlay);
    p.on('pause', onPause);
    p.on('ended', onEnd);
    return () => {
      p.off('timeupdate', onTime);
      p.off('playing', onPlay);
      p.off('pause', onPause);
      p.off('ended', onEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // YouTube
  if (isYouTube(url)) {
    const source = {
      type: 'video',
      sources: [{ src: url, provider: 'youtube' }]
    };
    return (
      <div style={{ position: 'relative', width: '100%', ...style }} className={className}>
        <Plyr ref={plyrRef} source={source} options={options} />
      </div>
    );
  }

  // Vimeo
  if (isVimeo(url)) {
    const id = (() => {
      try { return new URL(url).pathname.split('/').filter(Boolean).pop(); } catch { return url; }
    })();
    const source = { type: 'video', sources: [{ src: id, provider: 'vimeo' }] };
    return (
      <div style={{ position: 'relative', width: '100%', ...style }} className={className}>
        <Plyr ref={plyrRef} source={source} options={options} />
      </div>
    );
  }

  // Direct upload
  if (isDirectVideo(url)) {
    const source = { type: 'video', sources: [{ src: url, type: guessMimeType(url) }] };
    return (
      <div style={{ position: 'relative', width: '100%', ...style }} className={className}>
        <Plyr ref={plyrRef} source={source} options={options} />
      </div>
    );
  }

  // Fallback: plain iframe
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }} className={className}>
      <iframe
        src={url}
        title={title || 'Video'}
        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        style={{ border: 'none', width: '100%', height: '100%' }}
      />
    </div>
  );
}
