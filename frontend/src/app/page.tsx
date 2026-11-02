'use client';
import { useState } from 'react';

// Pinterest Supported Formats
const PINTEREST_FORMATS = [
  { name: 'Pinterest Videos', badge: '1080p / 720p MP4', color: 'bg-blue-50 border-blue-100 text-blue-600', iconColor: '#2563EB', desc: 'Full HD MP4 videos with complete audio' },
  { name: 'Pinterest Reels', badge: 'Vertical HD', color: 'bg-purple-50 border-purple-100 text-purple-600', iconColor: '#9333EA', desc: 'Short-form videos in original quality' },
  { name: 'Idea Pins & Stories', badge: 'Multi-page', color: 'bg-emerald-50 border-emerald-100 text-emerald-600', iconColor: '#059669', desc: 'Modern carousel & story video pins' },
  { name: 'Pins & GIFs', badge: 'Original Res', color: 'bg-amber-50 border-amber-100 text-amber-600', iconColor: '#D97706', desc: 'High-definition images and animated GIFs' },
];

interface VideoMeta {
  title: string;
  description: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  platform: string;
  formats: { format_id: string; ext: string; resolution: string; filesize: number | null }[];
  url: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadingFormatId, setDownloadingFormatId] = useState<string | null>(null);

  const isPinterestUrl = (inputUrl: string): boolean => {
    return /^(https?:\/\/)?(([\w-]+\.)?pinterest\.(com|[a-z]{2,3}(\.[a-z]{2})?)|pin\.it|pinimg\.com)/i.test(
      inputUrl.trim()
    );
  };

  const handleFetchMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) return;

    if (!isPinterestUrl(cleanUrl)) {
      setStatus(
        '⚠️ PinVault Pro only downloads Pinterest videos. Please enter a valid Pinterest link (e.g., https://pin.it/... or https://www.pinterest.com/pin/...).'
      );
      setStatusType('error');
      setVideoMeta(null);
      return;
    }

    setIsLoading(true);
    setStatus('Fetching video info...');
    setStatusType('info');
    setVideoMeta(null);

    try {
      const res = await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data?.title || data?.thumbnail)) {
        setVideoMeta(data);
        setStatus(null);
      } else {
        const errorMsg = data?.detail || data?.error || `Error fetching video info (Status ${res.status})`;
        setStatus(errorMsg);
        setStatusType('error');
      }
    } catch (err: any) {
      console.error('Metadata fetch error:', err);
      setStatus(err?.message || 'Network error while connecting to server.');
      setStatusType('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (formatId?: string) => {
    const selectedFormat = formatId || 'best';
    setIsDownloading(true);
    setDownloadingFormatId(selectedFormat);
    setDownloadProgress(null);
    setStatus('Processing & packaging video on server... Please wait.');
    setStatusType('info');

    try {
      const downloadUrl = `/api/download?url=${encodeURIComponent(url.trim())}&quality=${encodeURIComponent(
        selectedFormat
      )}`;

      const response = await fetch(downloadUrl);

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.detail || `Download failed with HTTP ${response.status}`);
      }

      const contentLengthHeader = response.headers.get('content-length');
      const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;

      const disposition = response.headers.get('content-disposition') || '';
      let filename = 'pinterest_video.mp4';
      const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }

      if (!response.body) {
        throw new Error('No readable data stream received.');
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;

          if (totalBytes > 0) {
            const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
            setDownloadProgress(percent);
            const receivedMb = (receivedBytes / (1024 * 1024)).toFixed(1);
            const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
            setStatus(`Downloading: ${percent}% (${receivedMb} MB / ${totalMb} MB)`);
          } else {
            const receivedMb = (receivedBytes / (1024 * 1024)).toFixed(1);
            setStatus(`Downloading: ${receivedMb} MB received...`);
          }
        }
      }

      const blob = new Blob(chunks as BlobPart[], {
        type: response.headers.get('content-type') || 'video/mp4',
      });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        try {
          window.URL.revokeObjectURL(blobUrl);
        } catch {}
      }, 60000);

      setStatus(`✓ Successfully downloaded "${filename}"! Saved to your downloads.`);
      setStatusType('success');
    } catch (err: any) {
      console.error('Download error:', err);
      setStatus(err?.message || 'Download failed. Please try another quality.');
      setStatusType('error');
    } finally {
      setIsDownloading(false);
      setDownloadingFormatId(null);
      setDownloadProgress(null);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <main className="min-h-screen bg-white text-slate-800 font-sans relative flex flex-col">
      {/* Navbar */}
      <nav className="w-full bg-white border-b border-slate-100 z-50 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="PinVault Pro" className="w-8 h-8 rounded-lg shadow-sm" />
            <span className="text-xl font-bold tracking-tight text-slate-800">
              PinVault<span className="text-blue-500">Pro</span>
            </span>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden sm:flex items-center gap-2 text-sm font-medium">
            <a href="#how-it-works" className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors rounded-full">How it works</a>
            <a href="#formats" className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors rounded-full">Formats</a>
            <a href="#features" className="px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors rounded-full">Features</a>
          </div>

          {/* Mobile Menu Button */}
          <div className="sm:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-slate-500 hover:text-slate-700 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav Dropdown */}
        {isMobileMenuOpen && (
          <div className="sm:hidden absolute top-16 left-0 w-full bg-white border-b border-slate-100 shadow-lg px-4 py-4 flex flex-col gap-2 z-50">
            <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium">How it works</a>
            <a href="#formats" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium">Formats</a>
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="px-4 py-2.5 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium">Features</a>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <div className="flex-grow bg-gradient-to-b from-slate-50 to-white relative">
        {/* Ad Placeholder (Top) */}
        <section className="px-4 pt-6 pb-2 w-full flex justify-center">
          <div
            id="top-ad-slot"
            className="w-full max-w-3xl min-h-[60px] sm:min-h-[90px] border-2 border-dashed border-slate-300 bg-slate-50/80 flex items-center justify-center rounded-xl text-slate-400 font-medium tracking-widest text-xs sm:text-sm uppercase transition-all"
          >
            {/* PASTE YOUR TOP AD SCRIPT OR BANNER HERE */}
            <span>Advertisement</span>
          </div>
        </section>

        {/* Hero Section */}
        <section className="relative z-10 flex flex-col items-center justify-center px-4 pt-6 pb-14 max-w-4xl mx-auto text-center">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-blue-50 text-blue-600 text-xs sm:text-sm font-semibold mb-6 border border-blue-100 shadow-sm">
            🚀 Fast & High-Quality Pinterest Video Downloader
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-800 mb-4 sm:mb-6 leading-tight">
            Download Pinterest Videos <br className="hidden sm:block" />
            in Full HD.
          </h1>

          <p className="text-slate-500 text-sm sm:text-lg md:text-xl mb-6 max-w-2xl px-2">
            The simplest way to save videos, Reels, Idea Pins, and GIFs from Pinterest with audio. Completely free, no watermarks.
          </p>

          {/* Supported Format Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 mb-8 sm:mb-10 max-w-2xl">
            {PINTEREST_FORMATS.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200/80 shadow-xs text-xs sm:text-sm font-medium text-slate-700"
              >
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span>{item.name}</span>
                <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  {item.badge}
                </span>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <form onSubmit={handleFetchMetadata} className="w-full max-w-2xl relative z-20 px-1 sm:px-0">
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-white border border-slate-200 rounded-2xl sm:rounded-full p-1.5 sm:p-2 shadow-lg shadow-slate-200/50 hover:shadow-xl hover:shadow-slate-200/80 transition-shadow duration-300 gap-2 sm:gap-0">
              <input
                type="url"
                required
                placeholder="Paste Pinterest video URL (e.g. https://pin.it/... or pinterest.com/pin/...)"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setVideoMeta(null);
                  setStatus(null);
                }}
                className="w-full bg-transparent text-slate-800 px-4 sm:px-6 py-3.5 sm:py-4 outline-none placeholder:text-slate-400 placeholder:truncate text-sm sm:text-base md:text-lg rounded-xl sm:rounded-full"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-full font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-md text-sm sm:text-base md:text-lg flex-shrink-0"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Fetching...</span>
                  </>
                ) : (
                  'Get Video'
                )}
              </button>
            </div>
            {status && (
              <p
                className={`mt-4 text-xs sm:text-sm font-medium text-center animate-pulse px-2 break-words ${
                  statusType === 'error' ? 'text-red-500' : statusType === 'success' ? 'text-green-600' : 'text-blue-600'
                }`}
              >
                {status}
              </p>
            )}
          </form>

          {/* Video Preview Card */}
          {videoMeta && (
            <div className="w-full max-w-2xl mt-8 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
              <div className="flex flex-col sm:flex-row">
                {/* Thumbnail */}
                {videoMeta.thumbnail && (
                  <div className="w-full sm:w-52 h-44 sm:h-auto flex-shrink-0 bg-slate-100 relative overflow-hidden">
                    <img src={videoMeta.thumbnail} alt={videoMeta.title} className="w-full h-full object-cover" />
                    {videoMeta.duration ? (
                      <span className="absolute bottom-2 right-2 bg-black/75 text-white text-[11px] px-2 py-0.5 rounded font-mono">
                        {formatDuration(videoMeta.duration)}
                      </span>
                    ) : null}
                  </div>
                )}
                {/* Info */}
                <div className="p-4 sm:p-5 flex-grow flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full capitalize border border-blue-100">
                        {videoMeta.platform}
                      </span>
                      {videoMeta.uploader && (
                        <span className="text-xs text-slate-400 truncate max-w-[200px]">by {videoMeta.uploader}</span>
                      )}
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-800 line-clamp-2 mb-3 leading-snug">
                      {videoMeta.title}
                    </h3>
                  </div>

                  {/* Live Progress Bar */}
                  {isDownloading && (
                    <div className="my-2.5">
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${downloadProgress !== null ? downloadProgress : 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Quality options */}
                  {videoMeta.formats.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {videoMeta.formats.map((f) => {
                        const isThisBtnDownloading = isDownloading && downloadingFormatId === f.format_id;
                        return (
                          <button
                            key={f.format_id}
                            onClick={() => handleDownload(f.format_id)}
                            disabled={isDownloading}
                            className={`px-3.5 py-2 active:scale-95 disabled:opacity-60 text-white text-xs font-semibold rounded-xl sm:rounded-full transition-all flex items-center gap-1.5 shadow-sm ${
                              isThisBtnDownloading ? 'bg-blue-600 animate-pulse' : 'bg-slate-900 hover:bg-slate-700'
                            }`}
                          >
                            {isThisBtnDownloading ? (
                              <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            )}
                            <span>
                              {isThisBtnDownloading && downloadProgress !== null
                                ? `${downloadProgress}%`
                                : f.resolution}
                            </span>
                            {f.filesize && !isThisBtnDownloading ? (
                              <span className="opacity-70 text-[11px]">{formatSize(f.filesize)}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDownload()}
                      disabled={isDownloading}
                      className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold rounded-xl sm:rounded-full transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                      {isDownloading ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                          <span>{downloadProgress !== null ? `Downloading ${downloadProgress}%...` : 'Processing...'}</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          <span>Download Best Quality</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* How it Works Section */}
        <section id="how-it-works" className="py-16 bg-white border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-800 mb-12">How to Download Pinterest Videos</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4 shadow-sm border border-blue-100">1</div>
                <h3 className="text-xl font-bold mb-2">Copy the Pinterest Link</h3>
                <p className="text-slate-500">Open Pinterest, find the video, Reel, or Idea Pin you want, tap Share and copy the link.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4 shadow-sm border border-blue-100">2</div>
                <h3 className="text-xl font-bold mb-2">Paste the Link</h3>
                <p className="text-slate-500">Paste the copied Pinterest link into the search box above and click &quot;Get Video&quot;.</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4 shadow-sm border border-blue-100">3</div>
                <h3 className="text-xl font-bold mb-2">Choose & Download</h3>
                <p className="text-slate-500">Pick your preferred quality (1080p, 720p MP4) and download the video instantly with sound.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Formats Section */}
        <section id="formats" className="py-16 bg-gradient-to-b from-white to-slate-50 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-800 mb-4">Supported Pinterest Formats</h2>
            <p className="text-center text-slate-500 mb-12 max-w-xl mx-auto">Download all types of media from Pinterest with maximum speed and reliability.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PINTEREST_FORMATS.map((platform) => (
                <div key={platform.name} className={`${platform.color} border rounded-2xl p-5 flex flex-col items-center text-center hover:shadow-md transition-shadow`}>
                  <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
                    <span className="text-lg font-bold" style={{ color: platform.iconColor }}>{platform.name[0]}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">{platform.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{platform.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-16 bg-slate-50 border-t border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">Why use PinVault Pro?</h2>
              <p className="text-slate-500 text-sm sm:text-base">Fast, high-quality, and reliable Pinterest video downloads with no restrictions.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 mb-4 shadow-sm border border-blue-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">Lightning Fast Speeds</h4>
                <p className="text-slate-500 text-sm">Direct CDN extraction ensures instantaneous download packaging and streaming.</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500 mb-4 shadow-sm border border-purple-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">1080p & 720p HD with Sound</h4>
                <p className="text-slate-500 text-sm">Download original MP4 files in crystal-clear HD with audio fully preserved.</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-green-500 mb-4 shadow-sm border border-green-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
                </div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">Idea Pins & Reels Support</h4>
                <p className="text-slate-500 text-sm">Full support for Pinterest Reels, multi-page Idea Pins, and animated GIFs.</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-start hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 mb-4 shadow-sm border border-rose-100">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h4 className="text-lg font-bold text-slate-800 mb-2">100% Free & Secure</h4>
                <p className="text-slate-500 text-sm">We don&apos;t log your downloads or store your data. No registration or subscription required.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Ad Placeholder (Bottom) */}
        <section className="px-4 py-10 w-full flex justify-center bg-white">
          <div
            id="bottom-ad-slot"
            className="w-full max-w-4xl min-h-[60px] sm:min-h-[90px] border-2 border-dashed border-slate-300 bg-slate-50/80 flex items-center justify-center rounded-xl text-slate-400 font-medium tracking-widest text-xs sm:text-sm uppercase transition-all"
          >
            {/* PASTE YOUR BOTTOM AD SCRIPT OR BANNER HERE */}
            <span>Advertisement</span>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.svg" alt="PinVault Pro" className="w-8 h-8 rounded-lg" />
              <span className="text-xl font-bold tracking-tight text-white">PinVault<span className="text-blue-500">Pro</span></span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm">
              The #1 Pinterest video downloader. Save videos, Reels, Idea Pins, and GIFs from Pinterest. We respect copyright and encourage users to only download content for personal use.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Links</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Home</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
              <li><a href="#formats" className="hover:text-white transition-colors">Formats</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">DMCA / Copyright</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact Us</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-sm text-slate-500 text-center flex flex-col md:flex-row justify-between items-center">
          <p>© 2026 PinVault Pro. All rights reserved.</p>
          <div className="mt-4 md:mt-0 flex gap-4">
          </div>
        </div>
      </footer>
    </main>
  );
}
