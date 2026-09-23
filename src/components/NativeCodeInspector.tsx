import React, { useState } from 'react';
import { PROJECT_FILES, NativeProjectFile } from '../data/projectFiles';
import { Copy, Check, FileCode, FolderCode, Terminal, Download } from 'lucide-react';

export const NativeCodeInspector: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<NativeProjectFile>(PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = () => {
    const blob = new Blob([selectedFile.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-full min-h-[640px]">
      {/* Top Header */}
      <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <FolderCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>Android Native & React Native Bridge Files</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {PROJECT_FILES.length} Files
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Generated React Native CLI + Kotlin Android codebase with MediaProjection & MediaStore
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadFile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download File</span>
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Sidebar & Code View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0">
        {/* File Navigator Sidebar */}
        <div className="lg:col-span-4 border-r border-slate-800 bg-slate-950/40 p-3 space-y-1.5 overflow-y-auto max-h-[300px] lg:max-h-[600px]">
          <div className="px-2 py-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Project Files
          </div>
          {PROJECT_FILES.map((file) => {
            const isSelected = selectedFile.path === file.path;
            return (
              <button
                key={file.path}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all flex flex-col gap-1 border ${
                  isSelected
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 font-semibold shadow-sm'
                    : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/40 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-medium text-slate-200">
                    {file.filename}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold ${
                      file.category === 'manifest'
                        ? 'bg-purple-500/20 text-purple-300'
                        : file.category === 'kotlin'
                        ? 'bg-amber-500/20 text-amber-300'
                        : file.category === 'gradle'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-cyan-500/20 text-cyan-300'
                    }`}
                  >
                    {file.category}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono truncate">
                  {file.path}
                </span>
              </button>
            );
          })}
        </div>

        {/* Code Content Box */}
        <div className="lg:col-span-8 flex flex-col bg-slate-950 min-h-0 overflow-hidden">
          {/* File Meta Header */}
          <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 overflow-hidden text-slate-400 font-mono">
              <FileCode className="w-4 h-4 text-blue-400 shrink-0" />
              <span className="truncate">{selectedFile.path}</span>
            </div>
            <span className="text-[11px] text-slate-400 font-semibold">
              {selectedFile.description}
            </span>
          </div>

          {/* Code Window */}
          <div className="flex-1 p-4 overflow-auto font-mono text-[12px] leading-relaxed text-slate-300 bg-slate-950">
            <pre className="whitespace-pre overflow-x-auto">
              <code>{selectedFile.code}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
