import React, { useState } from 'react';
import { Copy, Check, Terminal, Play, Smartphone, Package, ShieldAlert, Cpu } from 'lucide-react';

export const BuildCommandsModal: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCommand = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const COMMANDS = [
    {
      id: 'deps',
      title: '1. Install Dependencies',
      desc: 'Install React Native core and CLI dependencies',
      cmd: 'npm install',
      icon: Package,
    },
    {
      id: 'run-android',
      title: '2. Run on Connected Physical Device / Emulator',
      desc: 'Launches Metro bundler, compiles debug APK, and runs on your Android phone via adb',
      cmd: 'npx react-native run-android',
      icon: Smartphone,
    },
    {
      id: 'metro-reset',
      title: '3. Start Metro Bundler (Clean Cache)',
      desc: 'Run in a separate terminal tab if bundling needs refresh',
      cmd: 'npx react-native start --reset-cache',
      icon: Terminal,
    },
    {
      id: 'apk',
      title: '4. Build Release APK (For Direct Device Sideloading)',
      desc: 'Builds standalone release APK located at android/app/build/outputs/apk/release/app-release.apk',
      cmd: 'cd android && ./gradlew assembleRelease',
      icon: Play,
    },
    {
      id: 'aab',
      title: '5. Build Release AAB (For Google Play Store Distribution)',
      desc: 'Builds Android App Bundle located at android/app/build/outputs/bundle/release/app-release.aab',
      cmd: 'cd android && ./gradlew bundleRelease',
      icon: Cpu,
    },
  ];

  return (
    <div className="space-y-6">
      {/* CLI Commands Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-400" />
          <span>Production Build & Run CLI Commands</span>
        </h4>
        <div className="grid gap-3">
          {COMMANDS.map((item) => {
            const Icon = item.icon;
            const isCopied = copiedId === item.id;
            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">{item.title}</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                    <code className="inline-block mt-2 font-mono text-xs px-2.5 py-1 rounded bg-black/60 text-blue-300 border border-slate-800 select-all">
                      {item.cmd}
                    </code>
                  </div>
                </div>

                <button
                  onClick={() => copyCommand(item.id, item.cmd)}
                  className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition-colors border border-slate-700 shrink-0"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Android Studio Configuration Guide */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-400" />
          <span>Android Studio & Physical Device Setup</span>
        </h4>
        <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <span>
              <strong>Open in Android Studio:</strong> Open the <code className="text-blue-300">/android</code> folder in Android Studio (Hedgehog, Iguana, or Koala+). Let Gradle sync complete.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <span>
              <strong>SDK Platforms & Tools:</strong> In SDK Manager, install <strong>Android 14.0 (API 34)</strong> or <strong>Android 15 (API 35)</strong>, Android SDK Build-Tools 34.0.0, and NDK 26.1+.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <span>
              <strong>Physical Phone USB Debugging:</strong> Go to Phone Settings &gt; About Phone &gt; tap Build Number 7 times to enable Developer Options. Turn on <strong>USB Debugging</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <span>
              <strong>Verify Connected Phone:</strong> Run <code className="text-blue-300 font-mono">adb devices</code> in terminal. You should see your physical phone listed as <code className="text-emerald-400 font-mono">device</code>.
            </span>
          </li>
        </ul>
      </div>

      {/* MediaProjection Explanation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>How MediaProjection Works in Android 14+ (API 34/35)</span>
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed">
          Starting in Android 14, Google enforces strict security controls for screen capture:
        </p>
        <div className="grid sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs">
            <strong className="text-blue-300 block mb-1">1. User Consent</strong>
            <p className="text-slate-400">
              <code className="text-[11px] text-slate-300 font-mono">createScreenCaptureIntent()</code> prompts the system dialog where the user grants permission to capture entire screen or app.
            </p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs">
            <strong className="text-amber-300 block mb-1">2. Foreground Service</strong>
            <p className="text-slate-400">
              Must start service with <code className="text-[11px] text-slate-300 font-mono">FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION</code> before creating <code className="text-[11px] text-slate-300 font-mono">MediaProjection</code>.
            </p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-xs">
            <strong className="text-emerald-300 block mb-1">3. Gallery Export</strong>
            <p className="text-slate-400">
              Uses <code className="text-[11px] text-slate-300 font-mono">MediaStore.Video.Media</code> Scoped Storage so the video instantly appears in Google Photos & Gallery without permissions errors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
