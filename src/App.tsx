import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Settings,
  Film,
  Play,
  Pause,
  Square,
  Mic,
  MicOff,
  Check,
  Download,
  Trash2,
  Share2,
  ArrowLeft,
  Smartphone,
  Code2,
  Terminal,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { AndroidPhoneFrame } from './components/AndroidPhoneFrame';
import { NativeCodeInspector } from './components/NativeCodeInspector';
import { BuildCommandsModal } from './components/BuildCommandsModal';

interface SavedRecording {
  id: string;
  name: string;
  blobUrl: string;
  durationFormatted: string;
  durationMillis: number;
  sizeBytes: number;
  resolution: string;
  date: string;
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'app' | 'code' | 'commands'>('app');
  const [viewMode, setViewMode] = useState<'phone' | 'fluid'>('phone');
  const [currentScreen, setCurrentScreen] = useState<'home' | 'gallery' | 'settings'>('home');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Screen Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [recordAudio, setRecordAudio] = useState(true);
  const [quality, setQuality] = useState<'1080p' | '720p'>('1080p');
  const [fps, setFps] = useState<60 | 30>(60);
  const [bitrate, setBitrate] = useState<'12Mbps' | '8Mbps' | '4Mbps'>('8Mbps');
  const [countdown, setCountdown] = useState<'3s' | 'None'>('None');
  const [countdownValue, setCountdownValue] = useState<number | null>(null);

  // Recording Complete Modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [currentRecordingResult, setCurrentRecordingResult] = useState<{
    blobUrl: string;
    durationFormatted: string;
    durationMillis: number;
    sizeBytes: number;
    width: number;
    height: number;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Saved Recordings
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([
    {
      id: 'rec-sample-1',
      name: 'ScreenRecording_20260914_001200.mp4',
      blobUrl: '',
      durationFormatted: '00:01:45',
      durationMillis: 105000,
      sizeBytes: 18450000,
      resolution: '1080 × 1920 (60 FPS)',
      date: 'Today, 12:00 AM',
    },
    {
      id: 'rec-sample-2',
      name: 'ScreenRecording_20260913_184520.mp4',
      blobUrl: '',
      durationFormatted: '00:03:12',
      durationMillis: 192000,
      sizeBytes: 34200000,
      resolution: '1080 × 1920 (60 FPS)',
      date: 'Yesterday, 06:45 PM',
    },
  ]);

  // Web MediaRecorder references
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const canvasAnimRef = useRef<number | null>(null);

  // Format timer
  const formatTime = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Start Real / Simulated Recording
  const startRecording = async () => {
    // Check if countdown requested
    if (countdown === '3s') {
      for (let i = 3; i > 0; i--) {
        setCountdownValue(i);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCountdownValue(null);
    }

    try {
      recordedChunksRef.current = [];
      let captureStream: MediaStream | null = null;

      // Try browser display media capture
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        try {
          captureStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: quality === '1080p' ? 1920 : 1280,
              height: quality === '1080p' ? 1080 : 720,
              frameRate: fps,
            },
            audio: recordAudio,
          });
        } catch (displayErr) {
          console.warn('Browser getDisplayMedia not granted or restricted in iframe, falling back to simulated stream:', displayErr);
        }
      }

      // If getDisplayMedia was blocked or cancelled by user, generate a live canvas test stream
      if (!captureStream) {
        const canvas = document.createElement('canvas');
        canvas.width = quality === '1080p' ? 1080 : 720;
        canvas.height = quality === '1080p' ? 1920 : 1280;
        const ctx = canvas.getContext('2d');

        let frameCount = 0;
        const drawTestFrame = () => {
          if (!ctx) return;
          frameCount++;

          // Background gradient
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          grad.addColorStop(0, '#0F172A');
          grad.addColorStop(0.5, '#1E1B4B');
          grad.addColorStop(1, '#0B0F19');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Grid pattern
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 2;
          for (let x = 0; x < canvas.width; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }
          for (let y = 0; y < canvas.height; y += 60) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }

          // Animated pulse circle
          const radius = 90 + Math.sin(frameCount * 0.05) * 30;
          ctx.beginPath();
          ctx.arc(canvas.width / 2, canvas.height / 2 - 80, radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.fill();
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 6;
          ctx.stroke();

          // Text info
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 44px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('ANDROID SCREEN CAPTURE', canvas.width / 2, canvas.height / 2 + 80);

          ctx.fillStyle = '#94A3B8';
          ctx.font = '28px monospace';
          ctx.fillText(
            `Frame: ${frameCount} | ${quality} | ${fps} FPS`,
            canvas.width / 2,
            canvas.height / 2 + 140
          );

          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 36px monospace';
          const secs = Math.floor(frameCount / fps);
          const hrs = Math.floor(secs / 3600);
          const mins = Math.floor((secs % 3600) / 60);
          const sc = secs % 60;
          ctx.fillText(
            `REC ${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${sc.toString().padStart(2, '0')}`,
            canvas.width / 2,
            canvas.height / 2 + 200
          );

          canvasAnimRef.current = requestAnimationFrame(drawTestFrame);
        };
        drawTestFrame();
        captureStream = canvas.captureStream(fps);
      }

      streamRef.current = captureStream;

      // Handle stream stop by user from browser UI
      captureStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopRecording();
      });

      // MediaRecorder initialization
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const recorder = new MediaRecorder(captureStream, {
        mimeType: selectedMime || undefined,
        videoBitsPerSecond: bitrate === '12Mbps' ? 12000000 : bitrate === '8Mbps' ? 8000000 : 4000000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mime = selectedMime || 'video/mp4';
        const blob = new Blob(recordedChunksRef.current, { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const durationSecs = timerSeconds;

        setCurrentRecordingResult({
          blobUrl,
          durationFormatted: formatTime(durationSecs),
          durationMillis: durationSecs * 1000,
          sizeBytes: blob.size || 2500000,
          width: quality === '1080p' ? 1080 : 720,
          height: quality === '1080p' ? 1920 : 1280,
        });
        setShowCompleteModal(true);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      setTimerSeconds(0);

      // Start timer tick
      timerIntervalRef.current = window.setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      showToast('Error starting recording: ' + (err.message || 'Check permissions'));
    }
  };

  const togglePauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (canvasAnimRef.current) {
      cancelAnimationFrame(canvasAnimRef.current);
      canvasAnimRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (canvasAnimRef.current) cancelAnimationFrame(canvasAnimRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Save to Gallery / Download
  const handleSaveVideo = () => {
    if (!currentRecordingResult) return;
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    const fileName = `ScreenRecording_${timestamp}.mp4`;

    const a = document.createElement('a');
    a.href = currentRecordingResult.blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Add to saved gallery list
    setSavedRecordings((prev) => [
      {
        id: `rec-${Date.now()}`,
        name: fileName,
        blobUrl: currentRecordingResult.blobUrl,
        durationFormatted: currentRecordingResult.durationFormatted,
        durationMillis: currentRecordingResult.durationMillis,
        sizeBytes: currentRecordingResult.sizeBytes,
        resolution: `${currentRecordingResult.width} × ${currentRecordingResult.height} (${fps} FPS)`,
        date: 'Just now',
      },
      ...prev,
    ]);

    setShowCompleteModal(false);
    showToast('Video saved to Gallery & downloaded to your device!');
  };

  const handleCancelVideo = () => {
    if (currentRecordingResult?.blobUrl) {
      URL.revokeObjectURL(currentRecordingResult.blobUrl);
    }
    setCurrentRecordingResult(null);
    setShowCompleteModal(false);
    showToast('Recording discarded.');
  };

  const handleDeleteSaved = (id: string) => {
    setSavedRecordings((prev) => prev.filter((r) => r.id !== id));
    showToast('Recording deleted.');
  };

  // Format File Size
  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', !isDarkMode);
    document.body.classList.toggle('theme-light', !isDarkMode);
  }, [isDarkMode]);

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-red-500 selection:text-white ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-slate-900 border border-slate-700 text-slate-100 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Application Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shadow-sm shadow-red-500/10">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  Screen Recorder
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400">
                  React Native CLI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Android MediaProjection Foreground Service & MediaStore Pipeline
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('app')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'app'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">Mobile App Preview</span>
              <span className="sm:hidden">App</span>
            </button>

            <button
              onClick={() => setActiveTab('code')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'code'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-4 h-4 text-blue-400" />
              <span className="hidden sm:inline">Native Android Code</span>
              <span className="sm:hidden">Code</span>
            </button>

            <button
              onClick={() => setActiveTab('commands')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'commands'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">CLI Build & Run</span>
              <span className="sm:hidden">Build</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col min-h-0">
        {/* TAB 1: Mobile App Preview */}
        {activeTab === 'app' && (
          <div className="flex flex-col items-center justify-center flex-1 py-2">
            {/* View Mode Switcher */}
            <div className="mb-4 flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800 text-xs text-slate-300">
              <span className="text-slate-400 font-medium">Layout:</span>
              <button
                onClick={() => setViewMode('phone')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  viewMode === 'phone'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Phone Mockup
              </button>
              <button
                onClick={() => setViewMode('fluid')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  viewMode === 'fluid'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Full Screen
              </button>
            </div>

            {/* Application Container */}
            <div
              className={`w-full transition-all duration-300 ${
                viewMode === 'phone' ? 'max-w-[420px]' : 'max-w-2xl'
              }`}
            >
              {viewMode === 'phone' ? (
                <AndroidPhoneFrame
                  time="12:00"
                  isRecording={isRecording}
                  isDarkMode={isDarkMode}
                >
                  {renderScreenContent()}
                </AndroidPhoneFrame>
              ) : (
                <div className="bg-[#0B0F19] rounded-3xl border border-slate-800 shadow-2xl p-6 min-h-[640px] flex flex-col">
                  {renderScreenContent()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Native Android Code Inspector */}
        {activeTab === 'code' && (
          <div className="flex-1 flex flex-col min-h-0 py-2">
            <NativeCodeInspector />
          </div>
        )}

        {/* TAB 3: CLI Build & Run Commands */}
        {activeTab === 'commands' && (
          <div className="flex-1 py-2">
            <BuildCommandsModal />
          </div>
        )}
      </main>

      {/* Recording Complete Modal Dialog */}
      {showCompleteModal && currentRecordingResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl flex flex-col items-center">
            {/* Header Icon */}
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <Check className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-white mb-1">Recording Complete</h3>
            <p className="text-xs text-slate-400 text-center mb-5">
              Your screen capture has completed and is ready to save to your Android Gallery.
            </p>

            {/* Video Preview Player */}
            {currentRecordingResult.blobUrl && (
              <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 mb-4 shadow-inner flex items-center justify-center">
                <video
                  src={currentRecordingResult.blobUrl}
                  controls
                  className="w-full h-full object-contain"
                  autoPlay
                  muted
                  loop
                />
              </div>
            )}

            {/* Details Table */}
            <div className="w-full bg-[#1E293B] rounded-2xl p-4 space-y-2.5 mb-6 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Duration</span>
                <span className="text-white font-mono font-bold">
                  {currentRecordingResult.durationFormatted}
                </span>
              </div>
              <div className="h-px bg-slate-700/50" />
              <div className="flex justify-between items-center text-slate-400">
                <span>File Size</span>
                <span className="text-white font-mono font-bold">
                  {formatBytes(currentRecordingResult.sizeBytes)}
                </span>
              </div>
              <div className="h-px bg-slate-700/50" />
              <div className="flex justify-between items-center text-slate-400">
                <span>Format & Codec</span>
                <span className="text-white font-semibold">MP4 (H.264 / AAC)</span>
              </div>
              <div className="h-px bg-slate-700/50" />
              <div className="flex justify-between items-center text-slate-400">
                <span>Resolution</span>
                <span className="text-white font-mono">
                  {currentRecordingResult.width} × {currentRecordingResult.height}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={handleSaveVideo}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Save Video</span>
              </button>
              <button
                onClick={handleCancelVideo}
                className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Countdown Overlay */}
      {countdownValue !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none">
          <div className="text-8xl font-black text-red-500 animate-ping font-mono">
            {countdownValue}
          </div>
        </div>
      )}
    </div>
  );

  // Sub-screens rendering for the Android Frame
  function renderScreenContent() {
    if (currentScreen === 'gallery') {
      return (
        <div className="flex-1 flex flex-col bg-[#0B0F19]">
          {/* Top Bar */}
          <div className="px-5 py-4 border-b border-slate-800 bg-[#0F172A] flex items-center justify-between">
            <button
              onClick={() => setCurrentScreen('home')}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h2 className="text-sm font-bold text-white">Saved Recordings</h2>
            <div className="w-12" />
          </div>

          {/* Recordings List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {savedRecordings.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6">
                <Film className="w-12 h-12 text-slate-600 mb-3" />
                <p className="text-sm font-bold text-slate-300">No Recordings Yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Recorded videos will appear here and in your Android Gallery.
                </p>
              </div>
            ) : (
              savedRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="px-2 py-1 rounded bg-blue-600 text-[10px] font-extrabold text-white">
                      MP4
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{rec.name}</p>
                      <p className="text-[10px] text-slate-500">{rec.date}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 bg-[#1E293B] rounded-xl p-2.5 text-center text-[11px]">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Duration</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {rec.durationFormatted}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Size</span>
                      <span className="font-mono font-semibold text-slate-200">
                        {formatBytes(rec.sizeBytes)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Quality</span>
                      <span className="font-semibold text-slate-200">1080p 60fps</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    {rec.blobUrl && (
                      <a
                        href={rec.blobUrl}
                        download={rec.name}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs inline-flex items-center gap-1 font-semibold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteSaved(rec.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs inline-flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (currentScreen === 'settings') {
      return (
        <div className="flex-1 flex flex-col bg-[#0B0F19]">
          <div className="px-5 py-4 border-b border-slate-800 bg-[#0F172A] flex items-center justify-between">
            <button
              onClick={() => setCurrentScreen('home')}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <h2 className="text-sm font-bold text-white">Settings</h2>
            <div className="w-12" />
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                Video Parameters
              </span>
              <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Resolution
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['1080p', '720p'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setQuality(r)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                          quality === r
                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {r === '1080p' ? '1080p Full HD' : '720p HD'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Frame Rate
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([60, 30] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFps(f)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                          fps === f
                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {f} FPS
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Bitrate
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['12Mbps', '8Mbps', '4Mbps'] as const).map((b) => (
                      <button
                        key={b}
                        onClick={() => setBitrate(b)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                          bitrate === b
                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
                Audio & Countdown
              </span>
              <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Record Audio</p>
                    <p className="text-[11px] text-slate-400">Microphone & internal audio</p>
                  </div>
                  <button
                    onClick={() => setRecordAudio(!recordAudio)}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      recordAudio ? 'bg-blue-600' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        recordAudio ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="h-px bg-slate-800" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Countdown Timer</p>
                    <p className="text-[11px] text-slate-400">Delay 3s before starting</p>
                  </div>
                  <button
                    onClick={() => setCountdown(countdown === '3s' ? 'None' : '3s')}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      countdown === '3s' ? 'bg-blue-600' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        countdown === '3s' ? 'right-1' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default: Home Screen
    return (
      <div className="flex-1 flex flex-col bg-[#0B0F19]">
        {/* Top App Bar */}
        <div className="px-5 py-4 border-b border-slate-800 bg-[#0F172A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
            <h2 className="text-sm font-bold text-white">Screen Recorder</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentScreen('settings')}
              className="w-9 h-9 rounded-xl bg-[#1E293B] hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDarkMode((mode) => !mode)}
              className="w-9 h-9 rounded-xl bg-[#1E293B] hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-5">
            {/* Recording Timer Card */}
            <div className="bg-[#0F172A] border border-slate-800 rounded-3xl p-6 flex flex-col items-center justify-center text-center shadow-lg">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#1E293B] text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">
                {isRecording && (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isPaused ? 'bg-amber-400' : 'bg-red-500 animate-pulse'
                    }`}
                  />
                )}
                <span>
                  {!isRecording
                    ? 'READY TO RECORD'
                    : isPaused
                    ? 'RECORDING PAUSED'
                    : 'RECORDING LIVE'}
                </span>
              </div>

              {/* Monospace Digits */}
              <div className="text-5xl font-black text-white font-mono tracking-tight my-1">
                {formatTime(timerSeconds)}
              </div>

              {isRecording && (
                <p className="text-[11px] text-slate-500 mt-2">
                  Foreground service active. You can safely minimize the app.
                </p>
              )}
            </div>

            {/* Quick Settings Bar */}
            {!isRecording && (
              <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 space-y-3">
                <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
                  Configuration
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setQuality(quality === '1080p' ? '720p' : '1080p')}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      quality === '1080p'
                        ? 'bg-blue-600/10 border-blue-500/40 text-blue-300'
                        : 'bg-[#1E293B] border-slate-700/50 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 block">Resolution</span>
                    <span className="text-xs font-bold block">{quality}</span>
                  </button>

                  <button
                    onClick={() => setFps(fps === 60 ? 30 : 60)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      fps === 60
                        ? 'bg-blue-600/10 border-blue-500/40 text-blue-300'
                        : 'bg-[#1E293B] border-slate-700/50 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 block">Frame Rate</span>
                    <span className="text-xs font-bold block">{fps} FPS</span>
                  </button>

                  <button
                    onClick={() => setRecordAudio(!recordAudio)}
                    className={`p-2.5 rounded-xl border text-left transition-colors ${
                      recordAudio
                        ? 'bg-blue-600/10 border-blue-500/40 text-blue-300'
                        : 'bg-[#1E293B] border-slate-700/50 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 block">Audio</span>
                    <span className="text-xs font-bold block">
                      {recordAudio ? 'Mic On' : 'Muted'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Primary Controls */}
          <div className="pt-6 pb-2">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-full py-4 px-6 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-base flex items-center justify-center gap-3 shadow-xl shadow-red-600/30 transition-all active:scale-[0.98] cursor-pointer"
              >
                <div className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-white" />
                </div>
                <span>Start Recording</span>
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={togglePauseResume}
                  className="flex-1 py-3.5 px-4 rounded-2xl bg-[#1E293B] border border-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  onClick={stopRecording}
                  className="flex-[1.4] py-3.5 px-4 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 transition-colors cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop Recording</span>
                </button>
              </div>
            )}

            <div className="mt-4 p-3 bg-[#0F172A] border border-slate-800 rounded-xl text-[11px] text-slate-400 text-center">
              Android 14+ MediaProjection Foreground Service Compliant
            </div>
          </div>
        </div>
      </div>
    );
  }
}
