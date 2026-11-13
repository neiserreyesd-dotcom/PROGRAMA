import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume0to100: number) => void;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  cueVideoById: (videoId: string, startSeconds?: number) => void;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    element: HTMLElement | string,
    options: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YTPlayerInstance;
  PlayerState: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeIframeAPI(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube IFrame API requiere navegador.'));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT) {
        resolve(window.YT);
      } else {
        reject(new Error('No se pudo inicializar YouTube IFrame API.'));
      }
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('No se pudo cargar el reproductor de YouTube.'));
      document.head.appendChild(script);
    }
  });

  return ytApiPromise;
}

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setPlaybackRate: (rate: number) => void;
  setVolume: (vol0to1: number) => void;
}

interface YouTubeVideoPlayerProps {
  videoId: string;
  volume: number;
  playbackRate: number;
  onReady?: (durationSec: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onTimeUpdate?: (seconds: number) => void;
  onDurationChange?: (durationSec: number) => void;
  onEnded?: () => void;
}

export const YouTubeVideoPlayer = forwardRef<YouTubePlayerHandle, YouTubeVideoPlayerProps>(
  function YouTubeVideoPlayer(
    {
      videoId,
      volume,
      playbackRate,
      onReady,
      onPlayingChange,
      onTimeUpdate,
      onDurationChange,
      onEnded,
    },
    ref,
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const playerRef = useRef<YTPlayerInstance | null>(null);
    const readyRef = useRef(false);
    const activeVideoIdRef = useRef(videoId);
    const [isLoading, setIsLoading] = useState(true);
    const [playerError, setPlayerError] = useState<string | null>(null);

    const callbacksRef = useRef({
      onReady,
      onPlayingChange,
      onTimeUpdate,
      onDurationChange,
      onEnded,
    });
    callbacksRef.current = {
      onReady,
      onPlayingChange,
      onTimeUpdate,
      onDurationChange,
      onEnded,
    };

    const volumeRef = useRef(volume);
    volumeRef.current = volume;
    const rateRef = useRef(playbackRate);
    rateRef.current = playbackRate;

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          if (readyRef.current && playerRef.current) {
            playerRef.current.playVideo();
          }
        },
        pause: () => {
          if (readyRef.current && playerRef.current) {
            playerRef.current.pauseVideo();
          }
        },
        seekTo: (seconds: number) => {
          if (readyRef.current && playerRef.current) {
            playerRef.current.seekTo(Math.max(0, seconds), true);
          }
        },
        getCurrentTime: () => {
          if (readyRef.current && playerRef.current) {
            const t = playerRef.current.getCurrentTime();
            return Number.isFinite(t) ? t : 0;
          }
          return 0;
        },
        getDuration: () => {
          if (readyRef.current && playerRef.current) {
            const d = playerRef.current.getDuration();
            return Number.isFinite(d) ? d : 0;
          }
          return 0;
        },
        setPlaybackRate: (rate: number) => {
          if (readyRef.current && playerRef.current) {
            playerRef.current.setPlaybackRate(rate);
          }
        },
        setVolume: (vol0to1: number) => {
          if (readyRef.current && playerRef.current) {
            playerRef.current.setVolume(Math.round(Math.min(1, Math.max(0, vol0to1)) * 100));
          }
        },
      }),
      [],
    );

    useEffect(() => {
      let cancelled = false;
      setIsLoading(true);
      setPlayerError(null);

      void loadYouTubeIframeAPI()
        .then((YT) => {
          if (cancelled || !mountRef.current) return;

          if (playerRef.current && readyRef.current) {
            if (activeVideoIdRef.current !== videoId) {
              activeVideoIdRef.current = videoId;
              playerRef.current.cueVideoById(videoId, 0);
            }
            setIsLoading(false);
            return;
          }

          mountRef.current.innerHTML = '';
          const innerDiv = document.createElement('div');
          innerDiv.className = 'w-full h-full';
          mountRef.current.appendChild(innerDiv);

          activeVideoIdRef.current = videoId;
          playerRef.current = new YT.Player(innerDiv, {
            videoId,
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 0,
              controls: 1,
              playsinline: 1,
              rel: 0,
              modestbranding: 1,
              fs: 1,
              iv_load_policy: 3,
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (event) => {
                if (cancelled) return;
                readyRef.current = true;
                setIsLoading(false);
                event.target.setVolume(Math.round(volumeRef.current * 100));
                event.target.setPlaybackRate(rateRef.current);
                const dur = event.target.getDuration();
                if (Number.isFinite(dur) && dur > 0) {
                  callbacksRef.current.onReady?.(dur);
                  callbacksRef.current.onDurationChange?.(dur);
                } else {
                  callbacksRef.current.onReady?.(0);
                }
              },
              onStateChange: (event) => {
                if (cancelled) return;
                const state = event.data;
                const dur = event.target.getDuration();
                if (Number.isFinite(dur) && dur > 0) {
                  callbacksRef.current.onDurationChange?.(dur);
                }

                if (state === YT.PlayerState.PLAYING) {
                  callbacksRef.current.onPlayingChange?.(true);
                } else if (state === YT.PlayerState.PAUSED) {
                  callbacksRef.current.onPlayingChange?.(false);
                  const now = event.target.getCurrentTime();
                  if (Number.isFinite(now)) callbacksRef.current.onTimeUpdate?.(now);
                } else if (state === YT.PlayerState.ENDED) {
                  callbacksRef.current.onPlayingChange?.(false);
                  callbacksRef.current.onEnded?.();
                } else if (state === YT.PlayerState.CUED) {
                  setIsLoading(false);
                  callbacksRef.current.onPlayingChange?.(false);
                }
              },
              onError: (event) => {
                if (cancelled) return;
                setIsLoading(false);
                callbacksRef.current.onPlayingChange?.(false);
                if (event.data === 101 || event.data === 150) {
                  setPlayerError(
                    'El propietario de este video deshabilitó la reproducción integrada fuera de YouTube.',
                  );
                } else if (event.data === 100) {
                  setPlayerError('Este video de YouTube no está disponible o es privado.');
                } else {
                  setPlayerError('No se pudo cargar el video de YouTube.');
                }
              },
            },
          });
        })
        .catch((err) => {
          if (cancelled) return;
          setIsLoading(false);
          setPlayerError(
            err instanceof Error ? err.message : 'No se pudo cargar el reproductor de YouTube.',
          );
        });

      return () => {
        cancelled = true;
      };
    }, [videoId]);

    useEffect(() => {
      return () => {
        readyRef.current = false;
        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch {
            // Ignore cleanup errors
          }
          playerRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (readyRef.current && playerRef.current) {
        playerRef.current.setVolume(Math.round(Math.min(1, Math.max(0, volume)) * 100));
      }
    }, [volume]);

    useEffect(() => {
      if (readyRef.current && playerRef.current) {
        playerRef.current.setPlaybackRate(playbackRate);
      }
    }, [playbackRate]);

    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/[0.1] bg-black shadow-2xl">
        <div ref={mountRef} className="h-full w-full" />

        {isLoading && !playerError && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0C0E12]/80 text-xs text-zinc-300">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400" aria-hidden="true" />
            <span>Cargando video de YouTube...</span>
          </div>
        )}

        {playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#12151C]/95 p-4 text-center">
            <AlertCircle className="h-6 w-6 text-red-400" aria-hidden="true" />
            <p className="max-w-xs text-xs leading-relaxed text-red-200">{playerError}</p>
          </div>
        )}
      </div>
    );
  },
);
