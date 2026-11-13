import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { StageLyricsView } from './components/StageLyricsView';
import { StructureView } from './components/StructureView';
import { SyncEditorView } from './components/SyncEditorView';
import { LibraryView } from './components/LibraryView';
import { HomeImportView } from './components/HomeImportView';
import { AnalyzerTab } from './components/SongImporterPanel';
import { ShareStanzaModal } from './components/ShareStanzaModal';
import { SettingsView } from './components/SettingsView';
import { FloatingLyricsBubble } from './components/FloatingLyricsBubble';
import { PlayerDock } from './components/PlayerDock';
import { YouTubePlayerHandle, YouTubeVideoPlayer } from './components/YouTubeVideoPlayer';
import {
  ActiveView,
  AppSettings,
  LyricScale,
  SongAnalysis,
  SongTrack,
  Stanza,
  ThemeColors,
} from './types/song';
import {
  applySettingsToDocument,
  DEFAULT_APP_SETTINGS,
  loadAllSongNotes,
  loadAppSettings,
  saveAppSettings,
  saveSongNote,
} from './utils/appSettings';
import { getDemoTracks } from './utils/demoAudioGenerator';
import { getBeatsPerBar, playMetronomeClick } from './utils/metronomeAudio';
import {
  deleteSavedSong,
  loadSavedSongs,
  saveAnalyzedSong,
  saveYouTubeSong,
  updateSavedAnalysis,
} from './utils/songStorage';
import { getPlaybackLocation } from './utils/time';
import {
  clearAllHistory,
  loadPlayHistory,
  PlayHistoryEntry,
  recordTrackPlayed,
  removeHistoryItem,
  updateHistoryProgress,
} from './utils/playHistory';

interface AudioGraph {
  ctx: AudioContext;
  analyser: AnalyserNode;
  dryGain: GainNode;
  wetGain: GainNode;
}

export default function App() {
  const baseDemoTracks = useMemo(() => getDemoTracks(), []);
  const [demoOverrides, setDemoOverrides] = useState<Record<string, SongAnalysis>>({});
  const demoTracks = useMemo(
    () =>
      baseDemoTracks.map((t) =>
        demoOverrides[t.id] ? { ...t, analysis: demoOverrides[t.id] } : t,
      ),
    [baseDemoTracks, demoOverrides],
  );
  const [userTracks, setUserTracks] = useState<SongTrack[]>([]);
  const allTracks = useMemo(() => [...userTracks, ...demoTracks], [userTracks, demoTracks]);

  const [activeTrackId, setActiveTrackId] = useState<string>(baseDemoTracks[0].id);
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [hasLoadedSong, setHasLoadedSong] = useState(false);
  const [analyzerInitialTab, setAnalyzerInitialTab] = useState<AnalyzerTab>('audio');
  const [shareStanza, setShareStanza] = useState<Stanza | null>(null);
  const [history, setHistory] = useState<PlayHistoryEntry[]>(() => loadPlayHistory());
  const sessionRecordedTrackRef = useRef<string | null>(null);
  const pendingResumeRef = useRef<{ trackId: string; seekSec: number; autoPlay: boolean } | null>(null);

  // Audio & YouTube playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<YouTubePlayerHandle | null>(null);
  const graphRef = useRef<AudioGraph | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [syncOffset, setSyncOffset] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [vocalReduction, setVocalReduction] = useState(false);
  const vocalReductionRef = useRef(vocalReduction);
  vocalReductionRef.current = vocalReduction;
  const [loopStanzaId, setLoopStanzaId] = useState<string | null>(null);
  const [lyricScale, setLyricScale] = useState<LyricScale>('stage');

  // Personalization & studio settings
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const [songNotes, setSongNotes] = useState<Record<string, string>>(() => loadAllSongNotes());
  const [floatingBubbleManual, setFloatingBubbleManual] = useState<boolean | null>(null);
  const metronomeCtxRef = useRef<AudioContext | null>(null);
  const lastMetronomeBeatRef = useRef<number>(-1);

  const activeTrack = useMemo(
    () => allTracks.find((t) => t.id === activeTrackId) ?? demoTracks[0],
    [allTracks, activeTrackId, demoTracks],
  );
  const activeTrackRef = useRef(activeTrack);
  activeTrackRef.current = activeTrack;

  const isYouTubeTrack =
    activeTrack.sourceType === 'youtube' && Boolean(activeTrack.youtubeVideoId);
  const isYouTubeRef = useRef(isYouTubeTrack);
  isYouTubeRef.current = isYouTubeTrack;

  // Apply theme CSS variables and persist settings whenever they change
  useEffect(() => {
    applySettingsToDocument(settings);
    saveAppSettings(settings);
  }, [settings]);

  // Clean up dedicated metronome audio context on unmount
  useEffect(() => {
    return () => {
      if (metronomeCtxRef.current) {
        void metronomeCtxRef.current.close().catch(() => {});
        metronomeCtxRef.current = null;
      }
    };
  }, []);

  // Load saved songs from IndexedDB on mount
  useEffect(() => {
    void loadSavedSongs().then((saved) => {
      if (saved.length > 0) {
        setUserTracks(saved);
      }
    });
  }, []);

  // Initialize Web Audio API graph on first user play interaction for local/demo audio
  const ensureAudioGraph = useCallback(() => {
    if (isYouTubeRef.current) return;
    const audioEl = audioRef.current;
    if (!audioEl) return;

    if (!graphRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(audioEl);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;

      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      dryGain.gain.value = vocalReductionRef.current ? 0 : 1;
      wetGain.gain.value = vocalReductionRef.current ? 1 : 0;

      // Normal stereo path
      source.connect(dryGain);
      dryGain.connect(analyser);

      // Karaoke path: Mid-side center vocal attenuation (L - R) + sub-bass retention (<180Hz)
      const splitter = ctx.createChannelSplitter(2);
      const leftGain = ctx.createGain();
      const rightInvertGain = ctx.createGain();
      leftGain.gain.value = 0.85;
      rightInvertGain.gain.value = -0.85;

      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowpass';
      bassFilter.frequency.value = 180;
      const bassGain = ctx.createGain();
      bassGain.gain.value = 0.65;

      const karaokeMerger = ctx.createChannelMerger(2);
      const karaokeSum = ctx.createGain();

      source.connect(splitter);
      splitter.connect(leftGain, 0);
      splitter.connect(rightInvertGain, 1);
      leftGain.connect(karaokeSum);
      rightInvertGain.connect(karaokeSum);

      source.connect(bassFilter);
      bassFilter.connect(bassGain);
      bassGain.connect(karaokeSum);

      karaokeSum.connect(karaokeMerger, 0, 0);
      karaokeSum.connect(karaokeMerger, 0, 1);
      karaokeMerger.connect(wetGain);
      wetGain.connect(analyser);

      analyser.connect(ctx.destination);

      graphRef.current = { ctx, analyser, dryGain, wetGain };
      setAnalyserNode(analyser);
    }

    if (graphRef.current.ctx.state === 'suspended') {
      void graphRef.current.ctx.resume();
    }
  }, []);

  // Toggle karaoke dry/wet gains smoothly
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const now = graph.ctx.currentTime;
    graph.dryGain.gain.setTargetAtTime(vocalReduction ? 0 : 1, now, 0.04);
    graph.wetGain.gain.setTargetAtTime(vocalReduction ? 1 : 0, now, 0.04);
  }, [vocalReduction]);

  // Sync audio element volume & speed
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl) {
      audioEl.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl) {
      audioEl.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Reset state when switching tracks (and apply pending resume if switching from history)
  useEffect(() => {
    const audioEl = audioRef.current;
    if (audioEl) {
      audioEl.pause();
      if (!isYouTubeTrack) {
        audioEl.currentTime = 0;
      }
    }

    const pending = pendingResumeRef.current;
    const isPendingForThis = pending && pending.trackId === activeTrack.id;
    const startAt = isPendingForThis ? pending.seekSec : 0;

    setIsPlaying(false);
    setCurrentTime(startAt);
    setSyncOffset(0);
    setLoopStanzaId(null);
    setDuration(activeTrack.analysis.durationSec);
    sessionRecordedTrackRef.current = null;

    if (isYouTubeTrack) {
      // YouTube player applies pendingResumeRef in onReady / cued once video loads
      return;
    }

    if (audioEl) {
      audioEl.currentTime = startAt;
      if (isPendingForThis && pending.autoPlay) {
        pendingResumeRef.current = null;
        ensureAudioGraph();
        void audioEl
          .play()
          .then(() => {
            setIsPlaying(true);
            sessionRecordedTrackRef.current = activeTrack.id;
            setHistory((prev) => recordTrackPlayed(prev, activeTrack, startAt, true));
          })
          .catch(() => {
            // Ignore autoplay rejection if triggered without direct gesture
          });
      } else if (isPendingForThis) {
        pendingResumeRef.current = null;
      }
    }
  }, [
    activeTrack.id,
    activeTrack.audioUrl,
    activeTrack.youtubeVideoId,
    activeTrack.analysis.durationSec,
    isYouTubeTrack,
    ensureAudioGraph,
  ]);

  const getActiveMediaTime = useCallback((): number => {
    if (isYouTubeRef.current) {
      return ytPlayerRef.current?.getCurrentTime() ?? 0;
    }
    return audioRef.current?.currentTime ?? 0;
  }, []);

  // Periodically save playback position in history every 3s while playing
  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      const now = getActiveMediaTime();
      setHistory((prev) => updateHistoryProgress(prev, activeTrack.id, now));
    }, 3000);
    return () => window.clearInterval(interval);
  }, [isPlaying, activeTrack.id, getActiveMediaTime]);

  // High-frequency 60fps time tracker + stanza loop guard
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    const loopStanza = loopStanzaId
      ? activeTrack.analysis.stanzas.find((s) => s.id === loopStanzaId) ?? null
      : null;

    const tick = () => {
      const now = getActiveMediaTime();
      if (loopStanza && now >= loopStanza.endTime) {
        if (isYouTubeRef.current) {
          ytPlayerRef.current?.seekTo(loopStanza.startTime);
        } else if (audioRef.current) {
          audioRef.current.currentTime = loopStanza.startTime;
        }
        setCurrentTime(loopStanza.startTime);
      } else {
        setCurrentTime(now);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, loopStanzaId, activeTrack.analysis.stanzas, getActiveMediaTime]);

  const handleStartPlay = useCallback(() => {
    if (isYouTubeRef.current) {
      ytPlayerRef.current?.play();
      setIsPlaying(true);
      const track = activeTrackRef.current;
      const shouldIncrement = sessionRecordedTrackRef.current !== track.id;
      sessionRecordedTrackRef.current = track.id;
      const now = ytPlayerRef.current?.getCurrentTime() ?? 0;
      setHistory((prev) => recordTrackPlayed(prev, track, now, shouldIncrement));
      return;
    }

    const audioEl = audioRef.current;
    if (!audioEl) return;
    ensureAudioGraph();
    void audioEl
      .play()
      .then(() => {
        setIsPlaying(true);
        const shouldIncrement = sessionRecordedTrackRef.current !== activeTrack.id;
        sessionRecordedTrackRef.current = activeTrack.id;
        setHistory((prev) =>
          recordTrackPlayed(prev, activeTrack, audioEl.currentTime, shouldIncrement),
        );
      })
      .catch((err) => {
        console.error('Playback error:', err);
      });
  }, [ensureAudioGraph, activeTrack]);

  const handleTogglePlay = useCallback(() => {
    if (isYouTubeRef.current) {
      if (!isPlayingRef.current) {
        handleStartPlay();
      } else {
        ytPlayerRef.current?.pause();
        setIsPlaying(false);
        const now = ytPlayerRef.current?.getCurrentTime() ?? 0;
        setHistory((prev) => updateHistoryProgress(prev, activeTrack.id, now));
      }
      return;
    }

    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (audioEl.paused) {
      handleStartPlay();
    } else {
      audioEl.pause();
      setIsPlaying(false);
      setHistory((prev) =>
        updateHistoryProgress(prev, activeTrack.id, audioEl.currentTime),
      );
    }
  }, [handleStartPlay, activeTrack.id]);

  const handleSeek = useCallback(
    (timeSec: number) => {
      if (isYouTubeRef.current) {
        const ytDur = ytPlayerRef.current?.getDuration() || activeTrack.analysis.durationSec;
        const clamped = Math.max(0, Math.min(ytDur, timeSec));
        ytPlayerRef.current?.seekTo(clamped);
        setCurrentTime(clamped);
        return;
      }

      const audioEl = audioRef.current;
      if (!audioEl) return;
      const clamped = Math.max(
        0,
        Math.min(audioEl.duration || activeTrack.analysis.durationSec, timeSec),
      );
      audioEl.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [activeTrack.analysis.durationSec],
  );

  // Sync native YouTube iframe play/pause interactions with Estrofa state
  const handleYouTubeReady = useCallback((ytDuration: number) => {
    if (ytDuration > 0) {
      setDuration(ytDuration);
    }
    const pending = pendingResumeRef.current;
    const track = activeTrackRef.current;
    if (pending && pending.trackId === track.id) {
      pendingResumeRef.current = null;
      ytPlayerRef.current?.seekTo(pending.seekSec);
      setCurrentTime(pending.seekSec);
      if (pending.autoPlay) {
        ytPlayerRef.current?.play();
      }
    }
  }, []);

  const handleYouTubePlayingChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    const track = activeTrackRef.current;
    const now = ytPlayerRef.current?.getCurrentTime() ?? 0;
    if (playing) {
      const shouldIncrement = sessionRecordedTrackRef.current !== track.id;
      sessionRecordedTrackRef.current = track.id;
      setHistory((prev) => recordTrackPlayed(prev, track, now, shouldIncrement));
    } else {
      setHistory((prev) => updateHistoryProgress(prev, track.id, now));
    }
  }, []);

  // Spacebar shortcut for play/pause outside inputs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !hasLoadedSong) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
        return;
      }
      e.preventDefault();
      handleTogglePlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay, hasLoadedSong]);

  const adjustedTime = Math.max(0, currentTime + syncOffset);
  const location = useMemo(
    () => getPlaybackLocation(activeTrack.analysis, adjustedTime),
    [activeTrack.analysis, adjustedTime],
  );

  // Synchronized BPM metronome state & click trigger
  const beatsPerBar = useMemo(
    () => getBeatsPerBar(activeTrack.analysis.timeSignature),
    [activeTrack.analysis.timeSignature],
  );
  const effectiveBpm = Math.max(40, Math.min(240, activeTrack.analysis.bpm || 100));
  const totalBeatIndex = isPlaying ? Math.floor((adjustedTime * effectiveBpm) / 60) : -1;
  const currentBeat =
    totalBeatIndex >= 0
      ? ((totalBeatIndex % beatsPerBar) + beatsPerBar) % beatsPerBar
      : 0;

  useEffect(() => {
    if (!isPlaying || !settings.metronomeEnabled) {
      lastMetronomeBeatRef.current = -1;
      return;
    }
    if (totalBeatIndex < 0 || totalBeatIndex === lastMetronomeBeatRef.current) return;
    lastMetronomeBeatRef.current = totalBeatIndex;

    if (settings.metronomeSound === 'visual') return;

    if (!metronomeCtxRef.current) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      metronomeCtxRef.current = new AudioCtx();
    }

    const isDownbeat = currentBeat === 0;
    playMetronomeClick(
      metronomeCtxRef.current,
      isDownbeat,
      settings.metronomeSound,
      settings.metronomeVolume,
    );
  }, [
    isPlaying,
    totalBeatIndex,
    currentBeat,
    settings.metronomeEnabled,
    settings.metronomeSound,
    settings.metronomeVolume,
  ]);

  const handleUpdateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleUpdateColors = useCallback((patch: Partial<ThemeColors>) => {
    setSettings((prev) => ({
      ...prev,
      themePreset: 'custom',
      colors: { ...prev.colors, ...patch },
    }));
  }, []);

  const handleResetSettings = useCallback(() => {
    setSettings(DEFAULT_APP_SETTINGS);
  }, []);

  const handleImportSettings = useCallback((incoming: AppSettings) => {
    setSettings({
      ...DEFAULT_APP_SETTINGS,
      ...incoming,
      colors: {
        ...DEFAULT_APP_SETTINGS.colors,
        ...(incoming.colors ?? {}),
      },
    });
  }, []);

  const handleUpdateSongNote = useCallback(
    (note: string) => {
      setSongNotes(saveSongNote(activeTrack.id, note));
    },
    [activeTrack.id],
  );

  const handleTrackEnded = useCallback(() => {
    if (settings.autoLoopTrack) {
      handleSeek(0);
      if (isYouTubeRef.current) {
        ytPlayerRef.current?.play();
        setIsPlaying(true);
      } else if (audioRef.current) {
        void audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      return;
    }

    if (settings.autoNextTrack && allTracks.length > 1) {
      const idx = allTracks.findIndex((t) => t.id === activeTrack.id);
      const nextTrack = allTracks[(idx + 1) % allTracks.length];
      if (nextTrack && nextTrack.id !== activeTrack.id) {
        pendingResumeRef.current = {
          trackId: nextTrack.id,
          seekSec: 0,
          autoPlay: true,
        };
        setActiveTrackId(nextTrack.id);
        return;
      }
    }

    setIsPlaying(false);
  }, [settings.autoLoopTrack, settings.autoNextTrack, allTracks, activeTrack.id, handleSeek]);

  const handleToggleLoopStanza = useCallback((stanzaId: string) => {
    setLoopStanzaId((prev) => (prev === stanzaId ? null : stanzaId));
  }, []);

  const handleToggleLoopCurrentStanza = useCallback(() => {
    if (loopStanzaId) {
      setLoopStanzaId(null);
      return;
    }
    if (location.stanza) {
      setLoopStanzaId(location.stanza.id);
    }
  }, [loopStanzaId, location.stanza]);

  const handleAnalyzedTrack = async (file: File, analysis: SongAnalysis) => {
    const id = `song-${Date.now()}`;
    const newTrack = await saveAnalyzedSong(id, file, analysis, file.name);
    setUserTracks((prev) => [newTrack, ...prev]);
    setActiveTrackId(newTrack.id);
    setHasLoadedSong(true);
    setActiveView('stage');
  };

  const handleAnalyzedYouTube = async (videoId: string, analysis: SongAnalysis) => {
    const id = `yt-${Date.now()}`;
    const newTrack = await saveYouTubeSong(id, videoId, analysis);
    pendingResumeRef.current = {
      trackId: newTrack.id,
      seekSec: 0,
      autoPlay: true,
    };
    setUserTracks((prev) => [newTrack, ...prev]);
    setActiveTrackId(newTrack.id);
    setHasLoadedSong(true);
    setActiveView('stage');
  };

  const handleUpdateAnalysis = (updated: SongAnalysis) => {
    if (activeTrack.isDemo) {
      setDemoOverrides((prev) => ({
        ...prev,
        [activeTrack.id]: updated,
      }));
      return;
    }

    setUserTracks((prev) =>
      prev.map((t) => (t.id === activeTrack.id ? { ...t, analysis: updated } : t)),
    );
    void updateSavedAnalysis(activeTrack.id, updated);
  };

  const handleDeleteTrack = async (trackId: string) => {
    await deleteSavedSong(trackId);
    setUserTracks((prev) => {
      const target = prev.find((t) => t.id === trackId);
      if (target?.audioUrl) {
        URL.revokeObjectURL(target.audioUrl);
      }
      return prev.filter((t) => t.id !== trackId);
    });
    setHistory((prev) => removeHistoryItem(prev, trackId));
    if (activeTrackId === trackId) {
      setActiveTrackId(demoTracks[0].id);
    }
  };

  const handleSelectFromHistory = useCallback(
    (trackId: string, resumeAtSec = 0) => {
      const target = allTracks.find((t) => t.id === trackId);
      if (!target) return;

      if (trackId === activeTrack.id) {
        handleSeek(resumeAtSec);
        setHasLoadedSong(true);
        setActiveView('stage');
        handleStartPlay();
        return;
      }

      pendingResumeRef.current = {
        trackId,
        seekSec: resumeAtSec,
        autoPlay: true,
      };
      setActiveTrackId(trackId);
      setHasLoadedSong(true);
      setActiveView('stage');
    },
    [allTracks, activeTrack.id, handleSeek, handleStartPlay],
  );

  const handleRemoveHistory = useCallback((trackId: string) => {
    setHistory((prev) => removeHistoryItem(prev, trackId));
  }, []);

  const handleClearHistory = useCallback(() => {
    setHistory(clearAllHistory());
  }, []);

  const handleOpenAnalyzer = useCallback((initialTab: AnalyzerTab = 'audio') => {
    setAnalyzerInitialTab(initialTab);
    setActiveView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectTrackAndEnterStage = useCallback((trackId: string) => {
    setActiveTrackId(trackId);
    setHasLoadedSong(true);
    setActiveView('stage');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const videoPlayerNode = isYouTubeTrack && activeTrack.youtubeVideoId ? (
    <YouTubeVideoPlayer
      ref={ytPlayerRef}
      videoId={activeTrack.youtubeVideoId}
      volume={volume}
      playbackRate={playbackRate}
      onReady={handleYouTubeReady}
      onPlayingChange={handleYouTubePlayingChange}
      onTimeUpdate={(sec) => setCurrentTime(sec)}
      onDurationChange={(dur) => {
        if (dur > 0) setDuration(dur);
      }}
      onEnded={handleTrackEnded}
    />
  ) : undefined;

  const isBackgroundBubbleAutoActive =
    settings.backgroundBubbleAuto && activeView !== 'stage' && isPlaying;
  const showFloatingBubble =
    floatingBubbleManual !== null ? floatingBubbleManual : isBackgroundBubbleAutoActive;

  return (
    <div className="relative min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Subtle studio stage ambient glow */}
      <div
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse 80% 340px at 50% 0%, var(--app-accent-glow), transparent 72%)',
        }}
        className="pointer-events-none fixed inset-x-0 top-0 h-[360px] z-0"
      />
      <audio
        ref={audioRef}
        src={isYouTubeTrack ? undefined : activeTrack.audioUrl}
        preload="auto"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onTimeUpdate={(e) => {
          if (!isPlaying && !isYouTubeRef.current) setCurrentTime(e.currentTarget.currentTime);
        }}
        onEnded={() => {
          if (!isYouTubeRef.current) handleTrackEnded();
        }}
      />

      <TopBar
        activeView={activeView}
        hasLoadedSong={hasLoadedSong}
        onChangeView={(view) => {
          setActiveView(view);
          if (view === 'stage' && floatingBubbleManual === false) {
            setFloatingBubbleManual(null);
          }
        }}
        onOpenAnalyzer={() => handleOpenAnalyzer('audio')}
      />

      <main>
        {activeView === 'home' && (
          <HomeImportView
            initialTab={analyzerInitialTab}
            hasLoadedSong={hasLoadedSong}
            activeTrack={activeTrack}
            tracks={allTracks}
            history={history}
            onAnalyzed={handleAnalyzedTrack}
            onAnalyzedYouTube={handleAnalyzedYouTube}
            onSelectTrack={handleSelectTrackAndEnterStage}
            onSelectFromHistory={handleSelectFromHistory}
            onRemoveHistory={handleRemoveHistory}
            onClearHistory={handleClearHistory}
            onResumeActiveStage={() => setActiveView('stage')}
          />
        )}

        {/* StageLyricsView stays mounted once a song is loaded so YouTube/audio continues smoothly when switching tabs */}
        {hasLoadedSong && (
          <StageLyricsView
            track={activeTrack}
            availableTracks={allTracks}
            history={history}
            location={location}
            isPlaying={isPlaying}
            loopStanzaId={loopStanzaId}
            lyricScale={lyricScale}
            settings={settings}
            currentBeat={currentBeat}
            beatsPerBar={beatsPerBar}
            songNote={songNotes[activeTrack.id] ?? ''}
            isBubbleOpen={showFloatingBubble}
            isVisible={activeView === 'stage'}
            videoPlayerNode={videoPlayerNode}
            onSeek={handleSeek}
            onToggleLoopStanza={handleToggleLoopStanza}
            onShareStanza={setShareStanza}
            onStartPlay={handleStartPlay}
            onSelectFromHistory={handleSelectFromHistory}
            onRemoveHistory={handleRemoveHistory}
            onClearHistory={handleClearHistory}
            onUpdateSettings={handleUpdateSettings}
            onUpdateSongNote={handleUpdateSongNote}
            onOpenSettings={() => setActiveView('settings')}
            onToggleBubble={() =>
              setFloatingBubbleManual((prev) => !(prev !== null ? prev : showFloatingBubble))
            }
            onOpenAnalyzer={handleOpenAnalyzer}
          />
        )}

        {hasLoadedSong && activeView === 'structure' && (
          <StructureView
            track={activeTrack}
            activeStanzaId={location.stanza?.id ?? null}
            loopStanzaId={loopStanzaId}
            transposeSemitones={settings.transposeSemitones}
            onJumpToStanza={(startTime) => {
              handleSeek(startTime);
              setActiveView('stage');
              if (!isPlaying) handleStartPlay();
            }}
            onToggleLoopStanza={handleToggleLoopStanza}
            onShareStanza={setShareStanza}
          />
        )}

        {hasLoadedSong && activeView === 'editor' && (
          <SyncEditorView
            track={activeTrack}
            currentTime={currentTime}
            onUpdateAnalysis={handleUpdateAnalysis}
            onSeek={(t) => {
              handleSeek(t);
              if (!isPlaying) handleStartPlay();
            }}
          />
        )}

        {activeView === 'library' && (
          <LibraryView
            tracks={allTracks}
            activeTrackId={hasLoadedSong ? activeTrack.id : ''}
            history={history}
            onSelectTrack={handleSelectTrackAndEnterStage}
            onSelectFromHistory={handleSelectFromHistory}
            onRemoveHistory={handleRemoveHistory}
            onClearHistory={handleClearHistory}
            onDeleteTrack={(id) => void handleDeleteTrack(id)}
            onOpenAnalyzer={handleOpenAnalyzer}
          />
        )}

        {activeView === 'settings' && (
          <SettingsView
            settings={settings}
            activeTrack={activeTrack}
            songNote={songNotes[activeTrack.id] ?? ''}
            onUpdateSettings={handleUpdateSettings}
            onUpdateColors={handleUpdateColors}
            onResetSettings={handleResetSettings}
            onImportSettings={handleImportSettings}
            onUpdateSongNote={handleUpdateSongNote}
            onOpenStage={() => setActiveView(hasLoadedSong ? 'stage' : 'home')}
          />
        )}
      </main>

      {hasLoadedSong && (
        <FloatingLyricsBubble
          isOpen={showFloatingBubble}
          track={activeTrack}
          location={location}
          isPlaying={isPlaying}
          settings={settings}
          onTogglePlay={handleTogglePlay}
          onOpenStage={() => {
            setActiveView('stage');
            setFloatingBubbleManual(null);
          }}
          onClose={() => setFloatingBubbleManual(false)}
        />
      )}

      {hasLoadedSong && (activeView !== 'home' || isPlaying) && (
        <PlayerDock
          track={activeTrack}
          currentTime={currentTime}
          duration={duration}
          isPlaying={isPlaying}
          playbackRate={playbackRate}
          syncOffset={syncOffset}
          volume={volume}
          vocalReduction={vocalReduction}
          loopStanzaId={loopStanzaId}
          activeStanza={location.stanza}
          lyricScale={lyricScale}
          analyserNode={analyserNode}
          isYouTube={isYouTubeTrack}
          youtubeLyricsOnly={settings.youtubeLyricsOnly}
          isBubbleOpen={showFloatingBubble}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
          onChangeRate={setPlaybackRate}
          onChangeOffset={(delta) =>
            setSyncOffset((prev) => Number((prev + delta).toFixed(1)))
          }
          onChangeVolume={setVolume}
          onToggleVocalReduction={() => setVocalReduction((v) => !v)}
          onToggleLoopCurrentStanza={handleToggleLoopCurrentStanza}
          onToggleLyricScale={() =>
            setLyricScale((prev) => (prev === 'stage' ? 'normal' : 'stage'))
          }
          onToggleYouTubeLyricsOnly={() =>
            handleUpdateSettings({ youtubeLyricsOnly: !settings.youtubeLyricsOnly })
          }
          onToggleBubble={() =>
            setFloatingBubbleManual((prev) => !(prev !== null ? prev : showFloatingBubble))
          }
          onOpenAnalyzer={handleOpenAnalyzer}
        />
      )}

      <ShareStanzaModal
        isOpen={shareStanza !== null}
        analysis={activeTrack.analysis}
        stanza={shareStanza}
        activeLineId={
          shareStanza && location.stanza?.id === shareStanza.id
            ? location.line?.id ?? null
            : null
        }
        onClose={() => setShareStanza(null)}
      />
    </div>
  );
}

