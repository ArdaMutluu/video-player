import React, { useEffect, useRef, useState } from 'react';
import { useGesture } from '@use-gesture/react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  AlertTriangle,
  FastForward,
  Rewind,
  Maximize,
  Minimize,
} from 'lucide-react';
import './CustomVideoPlayer.css';

const CustomVideoPlayer = ({ streamUrl }) => {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const videoWrapperRef = useRef(null);
  const lastTapRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const transform = useRef({ scale: 1, x: 0, y: 0 });

  // --- 1. FULLSCREEN ---
  const toggleFullscreen = () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (container.requestFullscreen) {
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch((err) => console.log(err));
      } else {
        document.exitFullscreen();
      }
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    } else if (container.webkitRequestFullscreen) {
      if (!document.webkitFullscreenElement) {
        container.webkitRequestFullscreen();
      } else {
        document.webkitExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // --- 2. LAZY-LOADED VIDEO SOURCE SETUP ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    setError(null);
    const isHls = streamUrl.includes('.m3u8');
    let hls;

    const initPlayer = async () => {
      if (isHls) {
        try {
          const HlsModule = await import('hls.js');
          const Hls = HlsModule.default;
          if (Hls.isSupported()) {
            hls = new Hls({ debug: false });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl; // Native iOS HLS support
          }
        } catch (err) {
          setError('Failed to load HLS player.');
        }
      } else {
        video.src = streamUrl;
        video.load();
      }
    };

    initPlayer();

    const handleNativeError = () => setError('Video format not supported or network error.');
    video.addEventListener('error', handleNativeError);

    return () => {
      video.removeEventListener('error', handleNativeError);
      if (hls) hls.destroy();
    };
  }, [streamUrl]);

  // --- 3. GESTURES (Zoom and Drag) ---
  const applyTransform = () => {
    if (videoWrapperRef.current) {
      const { scale, x, y } = transform.current;
      videoWrapperRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
  };

  useGesture(
    {
      onPinch: ({ origin: [ox, oy], offset: [d], event }) => {
        if (event.target.closest('.controls-overlay')) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((ox - rect.left) / rect.width) * 100;
        const y = ((oy - rect.top) / rect.height) * 100;
        videoWrapperRef.current.style.transformOrigin = `${x}% ${y}%`;
        transform.current.scale = Math.max(1, Math.min(d / 50, 5));
        applyTransform();
      },
      onWheel: ({ event, offset: [, dy] }) => {
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        videoWrapperRef.current.style.transformOrigin = `${x}% ${y}%`;

        const zoomSpeed = 0.1;
        const newScale = transform.current.scale + (dy < 0 ? zoomSpeed : -zoomSpeed);
        transform.current.scale = Math.max(1, Math.min(newScale, 5));

        applyTransform();
      },
      onDrag: ({ movement: [mx, my], memo = { x: transform.current.x, y: transform.current.y } }) => {
        if (transform.current.scale > 1) {
          transform.current.x = memo.x + mx;
          transform.current.y = memo.y + my;
          applyTransform();
        }
        return memo;
      },
    },
    {
      target: containerRef,
      pinch: { from: () => [transform.current.scale * 50, 0] },
      eventOptions: { passive: false },
    }
  );

  // --- 4. PLAYBACK CONTROLS ---
  const triggerFeedback = (type, side) => {
    setFeedback({ type, side });
    setTimeout(() => setFeedback(null), 600);
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    try {
      if (videoRef.current.paused) {
        await videoRef.current.play();
        setIsPlaying(true);
        triggerFeedback('play', 'center');
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        triggerFeedback('pause', 'center');
      }
    } catch (err) {
      setError('Playback failed.');
    }
  };

  const seekRelative = (seconds) => {
    if (!videoRef.current) return;
    let newTime = videoRef.current.currentTime + seconds;
    newTime = Math.max(0, Math.min(newTime, videoRef.current.duration || 0));
    videoRef.current.currentTime = newTime;
    triggerFeedback(seconds > 0 ? 'forward' : 'rewind', seconds > 0 ? 'right' : 'left');
  };

  const handleContainerClick = (e) => {
    if (e.target.closest('.controls-overlay')) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      seekRelative(clickX < rect.width / 2 ? -10 : 10);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;
      switch (e.key) {
        case 'ArrowRight':
          seekRelative(10);
          break;
        case 'ArrowLeft':
          seekRelative(-10);
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          toggleFullscreen();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen]);

  return (
    <div
      className={`video-container soccer-theme ${isFullscreen ? 'is-fullscreen' : ''}`}
      ref={containerRef}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      onClick={handleContainerClick}
    >
      {error && (
        <div className="error-overlay">
          <AlertTriangle size={48} color="#ccff00" />
          <p>{error}</p>
        </div>
      )}

      {feedback && (
        <div className={`feedback-indicator ${feedback.side}`}>
          <div className="feedback-icon-wrapper">
            {feedback.type === 'forward' && (
              <>
                <FastForward size={32} /> <span>+10s</span>
              </>
            )}
            {feedback.type === 'rewind' && (
              <>
                <Rewind size={32} /> <span>-10s</span>
              </>
            )}
            {feedback.type === 'play' && <Play size={40} />}
            {feedback.type === 'pause' && <Pause size={40} />}
          </div>
        </div>
      )}

      <div className="video-wrapper" ref={videoWrapperRef}>
        <video
          ref={videoRef}
          onTimeUpdate={() => setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100)}
          onEnded={() => setIsPlaying(false)}
          muted={isMuted}
          playsInline
          className="video-element"
        />
      </div>

      <div className={`controls-overlay ${showControls ? 'visible' : 'hidden'}`}>
        <input
          type="range"
          min="0"
          max="100"
          value={progress || 0}
          onChange={(e) => (videoRef.current.currentTime = (e.target.value / 100) * videoRef.current.duration)}
          className="seek-bar volt-accent"
        />

        <div className="controls-row">
          <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="control-btn">
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          <div className="volume-control">
            <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="control-btn">
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                videoRef.current.volume = v;
                setIsMuted(v === 0);
              }}
              className="volume-slider volt-accent"
            />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              const rates = [0.5, 1, 1.5, 2];
              const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
              videoRef.current.playbackRate = next;
              setPlaybackRate(next);
            }}
            className="control-btn speed-btn"
          >
            {playbackRate}x
          </button>

          <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="control-btn fs-btn">
            {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomVideoPlayer;