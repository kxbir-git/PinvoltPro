'use client';
import { useState } from 'react';
import Link from 'next/link';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  category: 'Guides' | 'Tips & Tricks' | 'Troubleshooting' | 'HD Quality';
  readTime: string;
  date: string;
  author: string;
  content: {
    heading: string;
    body: string[];
    steps?: { title: string; desc: string }[];
    proTip?: string;
  }[];
}

const BLOG_POSTS: BlogPost[] = [
  {
    id: 'how-to-download-pinterest-videos-1080p',
    title: 'How to Download Pinterest Videos in 1080p Full HD with Audio (2026 Guide)',
    excerpt:
      'Learn how to save high-definition Pinterest videos with original crystal-clear audio to your iPhone, Android, PC, or Mac without any watermarks.',
    category: 'Guides',
    readTime: '4 min read',
    date: 'Nov 5, 2026',
    author: 'PinVault Tech Team',
    content: [
      {
        heading: 'Why Most Tools Fail to Download Pinterest Videos with Audio',
        body: [
          'Pinterest serves videos using an advanced adaptive streaming protocol known as HLS (HTTP Live Streaming) alongside split audio-video tracks. Many ordinary online downloaders only capture the silent video stream or compress it down to low-resolution 360p.',
          'PinVault Pro solves this by dynamically resolving Pinterest’s direct high-bitrate MP4 CDN mirrors (v1.pinimg.com), ensuring your saved videos retain their original 1080p or 720p resolution and complete stereo soundtrack.',
        ],
      },
      {
        heading: 'Step-by-Step: Downloading a Pinterest Video in Seconds',
        body: ['Follow these quick steps to save any public video from Pinterest:'],
        steps: [
          {
            title: '1. Copy the Pinterest Video Link',
            desc: 'Open the Pinterest app or website. Navigate to the video you want, tap the "Share" or "..." icon, and select "Copy Link" (e.g. https://pin.it/... or https://www.pinterest.com/pin/...).',
          },
          {
            title: '2. Paste into PinVault Pro',
            desc: 'Visit PinVault Pro and paste the copied URL into the search box at the top of the homepage.',
          },
          {
            title: '3. Click "Get Video" and Download',
            desc: 'Our engine will inspect the pin and reveal the "Download HD Video (MP4)" button. Click it to immediately stream and save the full MP4 to your device.',
          },
        ],
        proTip:
          'Pro Tip: PinVault Pro supports short pin.it links directly without needing manual browser expansion.',
      },
    ],
  },
  {
    id: 'download-pinterest-idea-pins-reels',
    title: 'How to Save Pinterest Idea Pins & Story Video Reels',
    excerpt:
      'Idea Pins and video stories have a unique multi-page structure. Here is how to extract and download them in full resolution.',
    category: 'Guides',
    readTime: '3 min read',
    date: 'Nov 4, 2026',
    author: 'Creative Studio',
    content: [
      {
        heading: 'Understanding Pinterest Idea Pins (Story Pins)',
        body: [
          'Idea Pins (formerly called Story Pins) are Pinterest’s short-form vertical video format, similar to Instagram Reels or TikToks. Instead of standard video assets, Idea Pins contain page-based story blocks that traditional downloaders often mistake for static photos.',
          'If you have ever pasted an Idea Pin into an online downloader and only got a thumbnail photo in return, this architectural difference was the culprit.',
        ],
      },
      {
        heading: 'How PinVault Pro Extracts Idea Pin Video Blocks',
        body: [
          'PinVault Pro includes a deep story pin parser that traverses the internal pages and video blocks of the pin. It extracts the raw 720p vertical MP4 stream embedded in the story structure.',
          'Simply copy the link of the Idea Pin or Reel from your Pinterest mobile app, paste it into PinVault Pro, and click the blue "Download HD Video" button.',
        ],
        proTip:
          'You can also download the high-resolution cover image separately if you only need the artwork or thumbnail.',
      },
    ],
  },
  {
    id: 'fix-pinterest-downloaded-video-no-sound',
    title: 'Troubleshooting: Why Does My Downloaded Pinterest Video Have No Sound?',
    excerpt:
      'Downloaded a video but can’t hear any audio? Learn why some Pinterest videos are silent and how to ensure you always get full sound.',
    category: 'Troubleshooting',
    readTime: '3 min read',
    date: 'Nov 3, 2026',
    author: 'Audio Engineering',
    content: [
      {
        heading: 'Two Reasons a Pinterest Video Might Be Silent',
        body: [
          '1. The creator uploaded the pin without audio, or Pinterest muted it due to copyright/music licensing restrictions in specific regions.',
          '2. The downloader you used only downloaded the visual track of an HLS stream while dropping the audio container.',
        ],
      },
      {
        heading: 'How to Test Before Downloading',
        body: [
          'Always unmute the video in the official Pinterest app or web player to confirm that sound is playing on the platform itself. If you hear audio in Pinterest, PinVault Pro is guaranteed to package and download that exact audio stream into your MP4 file.',
        ],
        proTip:
          'If audio is missing in your default phone player, try opening the downloaded file in VLC Player to verify the audio codec.',
      },
    ],
  },
  {
    id: 'save-pinterest-gifs-and-images',
    title: 'How to Download High-Res Pinterest GIFs and Original Images',
    excerpt:
      'Get uncompressed, original resolution JPGs, PNGs, and animated GIFs directly from Pinterest’s original media repository.',
    category: 'Tips & Tricks',
    readTime: '2 min read',
    date: 'Nov 1, 2026',
    author: 'Design & Graphics',
    content: [
      {
        heading: 'Grabbing Full-Resolution Assets',
        body: [
          'Pinterest serves compressed 736x or 564x preview images on its web pages to save bandwidth. However, Pinterest almost always stores the uncompressed "originals" file on its CDN.',
          'When you paste an image or GIF pin into PinVault Pro, our parser automatically fetches the raw original image link (/originals/) rather than the resized thumbnail, giving you the sharpest possible download for design work, wallpapers, and archiving.',
        ],
      },
    ],
  },
];

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeArticle, setActiveArticle] = useState<BlogPost | null>(null);

  const categories = ['All', 'Guides', 'Tips & Tricks', 'Troubleshooting'];

  const filteredPosts =
    selectedCategory === 'All'
      ? BLOG_POSTS
      : BLOG_POSTS.filter((post) => post.category === selectedCategory);

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col">
      {/* Navigation */}
      <nav className="w-full bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="PinVault Pro" className="w-8 h-8 rounded-lg shadow-sm" />
            <span className="text-xl font-bold tracking-tight text-slate-800">
              PinVault<span className="text-blue-500">Pro</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-full border border-blue-100 transition-colors"
            >
              ← Back to Downloader
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <header className="bg-gradient-to-b from-slate-50 to-white py-12 sm:py-16 border-b border-slate-100 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-semibold rounded-full border border-blue-100 mb-4 shadow-sm">
            📚 Tutorials, Tips & Technical Guides
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            PinVault Pro Blog
          </h1>
          <p className="text-slate-500 text-sm sm:text-lg max-w-xl mx-auto">
            Everything you need to know about downloading Pinterest videos, reels, stories, audio, and high-res imagery.
          </p>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Blog Post Grid */}
      <main className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 py-12 w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group hover:border-blue-200"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-semibold border border-blue-100">
                    {post.category}
                  </span>
                  <span>{post.readTime}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-3 leading-snug">
                  {post.title}
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-6">
                  {post.excerpt}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">{post.date}</span>
                <button
                  onClick={() => setActiveArticle(post)}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Read Article
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Call to Action Banner */}
        <div className="mt-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h3 className="text-2xl sm:text-3xl font-extrabold mb-3">Ready to save Pinterest videos?</h3>
            <p className="text-blue-100 text-sm sm:text-base mb-6">
              Experience lightning-fast 1080p MP4 downloads with audio preserved. No registration required.
            </p>
            <Link
              href="/"
              className="inline-block px-8 py-3.5 bg-white text-blue-600 font-bold rounded-full text-sm sm:text-base shadow-lg hover:bg-blue-50 transition-all active:scale-95"
            >
              Start Downloading Now
            </Link>
          </div>
        </div>
      </main>

      {/* Article Detail Reading Modal */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-10 shadow-2xl relative border border-slate-100 text-left">
            {/* Close Button */}
            <button
              onClick={() => setActiveArticle(null)}
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors"
              aria-label="Close article"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Article Header */}
            <div className="mb-6 pr-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold border border-blue-100">
                  {activeArticle.category}
                </span>
                <span className="text-xs text-slate-400">• {activeArticle.readTime}</span>
                <span className="text-xs text-slate-400">• {activeArticle.date}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
                {activeArticle.title}
              </h2>
            </div>

            {/* Article Content */}
            <div className="space-y-6 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100 pt-6">
              {activeArticle.content.map((sec, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800">{sec.heading}</h3>
                  {sec.body.map((p, pIdx) => (
                    <p key={pIdx}>{p}</p>
                  ))}

                  {sec.steps && (
                    <div className="space-y-3 my-4">
                      {sec.steps.map((st, sIdx) => (
                        <div key={sIdx} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                          <h4 className="font-bold text-slate-800 text-sm">{st.title}</h4>
                          <p className="text-xs sm:text-sm text-slate-600 mt-1">{st.desc}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {sec.proTip && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs sm:text-sm">
                      💡 <strong>{sec.proTip}</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Modal Bottom Actions */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs sm:text-sm font-semibold transition-all text-center shadow-md"
              >
                Go to Downloader
              </Link>
              <button
                onClick={() => setActiveArticle(null)}
                className="text-xs sm:text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                Close Article
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800 text-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PinVault Pro. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/blog" className="text-white hover:underline">Blog</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/dmca" className="hover:text-white">DMCA</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

