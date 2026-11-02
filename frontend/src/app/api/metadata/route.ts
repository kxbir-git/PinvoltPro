import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PYTHON_URLS = Array.from(
  new Set(
    [
      process.env.PYTHON_SERVICE_URL,
      process.env.NEXT_PUBLIC_PYTHON_URL,
      'http://127.0.0.1:8001',
      'http://localhost:8001',
      'http://127.0.0.1:8000',
      'http://localhost:8000',
    ].filter(Boolean) as string[]
  )
);

let isSpawningPython = false;

async function checkHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensurePythonRunning(): Promise<string | null> {
  // 1. Check if already alive
  for (const url of PYTHON_URLS) {
    if (await checkHealth(url)) {
      return url;
    }
  }

  if (isSpawningPython) {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 400));
      for (const url of PYTHON_URLS) {
        if (await checkHealth(url)) return url;
      }
    }
    return null;
  }

  isSpawningPython = true;
  try {
    const candidateDirs = [
      path.resolve(process.cwd(), '..', 'python-service'),
      path.resolve(process.cwd(), 'python-service'),
      'C:\\Project\\PinVaultPro\\python-service',
    ];

    const serviceDir = candidateDirs.find((d) => fs.existsSync(path.join(d, 'main.py')));
    if (!serviceDir) {
      console.warn('[AutoStart] python-service folder not found in candidates:', candidateDirs);
      return null;
    }

    // Prioritize active working virtual environment first
    const pythonBinaries = [
      path.join(serviceDir, 'venv', 'Scripts', 'python.exe'),
      path.join(serviceDir, 'venv311', 'Scripts', 'python.exe'),
      'python.exe',
      'python',
    ];

    const pythonPath = pythonBinaries.find((p) => fs.existsSync(p)) || 'python';

    console.log(`[AutoStart] Starting Python service from ${serviceDir} using ${pythonPath}...`);

    const sub = spawn(
      pythonPath,
      ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8001'],
      {
        cwd: serviceDir,
        detached: true,
        stdio: 'ignore',
        shell: process.platform === 'win32',
      }
    );
    sub.unref();

    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      for (const url of ['http://127.0.0.1:8001', 'http://localhost:8001']) {
        if (await checkHealth(url)) {
          console.log(`[AutoStart] Python service successfully started at ${url}`);
          return url;
        }
      }
    }
    return null;
  } catch (err) {
    console.error('[AutoStart] Failed to spawn Python service:', err);
    return null;
  } finally {
    isSpawningPython = false;
  }
}

// ── Native Direct Pinterest Scraper (Node.js Fallback Engine) ─
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function extractPinId(url: string): string | null {
  const m1 = url.match(/\/pin\/(?:[^/]+-)?(\d{10,})/);
  if (m1) return m1[1];
  const m2 = url.match(/\/pin\/(\d+)/);
  if (m2) return m2[1];
  const m3 = url.match(/(\d{10,})/);
  if (m3) return m3[1];
  return null;
}

// Native Node.js Multi-Tier Scraper
async function scrapePinterestNative(targetUrl: string) {
  try {
    let currentUrl = targetUrl;

    // Follow redirects for pin.it
    if (currentUrl.includes('pin.it')) {
      try {
        const headRes = await fetch(currentUrl, {
          method: 'GET',
          headers: BROWSER_HEADERS,
          redirect: 'follow',
          signal: AbortSignal.timeout(10000),
        });
        currentUrl = headRes.url;
      } catch (e) {
        console.warn('pin.it redirect resolution error:', e);
      }
    }

    const pinId = extractPinId(currentUrl);

    // Tier 1: Widget API
    if (pinId) {
      try {
        const widgetRes = await fetch(`https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(8000),
        });
        if (widgetRes.ok) {
          const wJson = await widgetRes.json();
          let pins = wJson?.data?.pins || (Array.isArray(wJson?.data) ? wJson.data : []);
          if (pins && pins[0] && !pins[0].error) {
            const p = pins[0];
            let videoUrl: string | null = null;
            const vList = p.videos?.video_list || {};
            for (const q of ['V_720P', 'V_EXP7', 'V_480P', 'V_360P']) {
              if (vList[q]?.url) {
                videoUrl = vList[q].url;
                break;
              }
            }
            if (!videoUrl && vList.V_HLSV4?.url) {
              const hls = vList.V_HLSV4.url;
              videoUrl = hls.replace(/\/hls(?:_v\d+)?\//, '/720p/').replace('.m3u8', '.mp4');
            }

            let thumbnail: string | null = null;
            const images = p.images || {};
            for (const s of ['orig', '736x', '564x']) {
              if (images[s]?.url) {
                thumbnail = images[s].url;
                break;
              }
            }

            if (videoUrl || thumbnail) {
              const title = p.description || p.rich_metadata?.title || `Pinterest Pin ${pinId}`;
              const isImage = !videoUrl;
              return {
                title: title.slice(0, 120),
                description: (p.description || '').slice(0, 300),
                thumbnail: thumbnail || videoUrl,
                duration: 0,
                uploader: p.pinner?.full_name || 'Pinterest',
                view_count: p.repin_count || 0,
                platform: 'pinterest',
                formats: [
                  ...(videoUrl
                    ? [{ format_id: '1080p', ext: 'mp4', resolution: '1080p / 720p HD Video (MP4)', filesize: null }]
                    : []),
                  ...(thumbnail
                    ? [{ format_id: 'original_image', ext: 'jpg', resolution: isImage ? 'Original High-Res Image' : 'Thumbnail', filesize: null }]
                    : []),
                ],
                url: currentUrl,
                _video_url: videoUrl || thumbnail,
                _is_image: isImage,
              };
            }
          }
        }
      } catch (wErr) {
        console.warn('Widget API fetch failed in Node:', wErr);
      }
    }

    // Tier 2: HTML Scraper Fallback
    const pageRes = await fetch(currentUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(12000),
    });

    const html = (await pageRes.text()).replace(/\\\//g, '/').replace(/\\u002F/g, '/');

    if (pageRes.status === 404 || html.includes('"PinNotFound"')) {
      return { error: 'This Pin does not exist or has been deleted on Pinterest.', status: 404 };
    }

    let videoUrl: string | null = null;
    let thumbnail: string | null = null;
    let title = '';
    let description = '';

    // Search for JSON-LD VideoObject
    const ldMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (ldMatches) {
      for (const block of ldMatches) {
        try {
          const raw = block.replace(/<\/?script[^>]*>/gi, '');
          const data = JSON.parse(raw);
          if (data['@type'] === 'VideoObject' && data.contentUrl) {
            videoUrl = data.contentUrl;
            title = data.name || title;
            description = data.description || description;
            thumbnail = data.thumbnailUrl || thumbnail;
            break;
          }
        } catch {}
      }
    }

    // Search for direct video URLs
    if (!videoUrl) {
      const vMatches = html.match(/https?:\/\/(?:v|v1)\.pinimg\.com\/videos\/[^\s"'<>]+?\.(?:mp4|m3u8)/g);
      if (vMatches && vMatches.length > 0) {
        const mp4 = vMatches.find((m) => m.includes('.mp4'));
        if (mp4) {
          videoUrl = mp4;
        } else {
          videoUrl = vMatches[0].replace(/\/hls(?:_v\d+)?\//, '/720p/').replace('.m3u8', '.mp4');
        }
      }
    }

    if (!videoUrl) {
      const ogVid =
        html.match(/property="og:video(?::secure_url)?"\s+content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"\s+property="og:video(?::secure_url)?"/i);
      if (ogVid) videoUrl = ogVid[1];
    }

    const ogImg =
      html.match(/property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/content="([^"]+)"\s+property="og:image"/i);
    if (ogImg) thumbnail = ogImg[1];

    if (!title) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s*[-|]\s*Pinterest\s*$/i, '').trim();
      }
    }
    if (!title) title = `Pinterest Pin ${pinId || ''}`.trim();

    const mediaUrl = videoUrl || thumbnail;
    if (!mediaUrl) return null;

    const isImage = !videoUrl;
    const formats: any[] = [];
    if (videoUrl) {
      formats.push({
        format_id: '1080p',
        ext: 'mp4',
        resolution: '1080p / 720p HD Video (MP4)',
        filesize: null,
      });
    }
    if (thumbnail) {
      formats.push({
        format_id: 'original_image',
        ext: 'jpg',
        resolution: isImage ? 'Original High-Res Image' : 'Thumbnail',
        filesize: null,
      });
    }

    return {
      title,
      description: description.slice(0, 300),
      thumbnail: thumbnail || videoUrl,
      duration: 0,
      uploader: 'Pinterest',
      view_count: 0,
      platform: 'pinterest',
      formats,
      url: currentUrl,
      _video_url: mediaUrl,
      _is_image: isImage,
    };
  } catch (err: any) {
    console.error('Direct Pinterest scraper error:', err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json({ detail: 'Pinterest link is required' }, { status: 400 });
    }

    const trimmedUrl = url.trim();

    // Check if the URL is from Pinterest
    const isPinterest = /^(https?:\/\/)?(([\w-]+\.)?pinterest\.(com|[a-z]{2,3}(\.[a-z]{2})?)|pin\.it|pinimg\.com)/i.test(
      trimmedUrl
    );

    if (!isPinterest) {
      return NextResponse.json(
        {
          detail:
            'PinVault Pro is exclusively dedicated to Pinterest. Please enter a valid Pinterest link (e.g., https://pin.it/... or https://www.pinterest.com/pin/...).',
        },
        { status: 400 }
      );
    }

    // 1. Try Python service if available
    const activePyUrl = await ensurePythonRunning();
    if (activePyUrl) {
      try {
        const res = await fetch(`${activePyUrl}/api/metadata`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmedUrl }),
          signal: AbortSignal.timeout(20000),
        });

        const data = await res.json().catch(() => ({ detail: 'Invalid JSON response from service' }));
        if (res.ok) {
          return NextResponse.json(data);
        }

        // If Python returned an error, run native Node fallback
        const nativeData = await scrapePinterestNative(trimmedUrl);
        if (nativeData && !('error' in nativeData)) {
          return NextResponse.json(nativeData);
        }

        return NextResponse.json(data, { status: res.status });
      } catch (pyErr: any) {
        console.warn('Call to Python service failed, falling back to Node native scraper:', pyErr?.message);
      }
    }

    // 2. Native scraper fallback if Python is offline
    const nativeData = await scrapePinterestNative(trimmedUrl);
    if (nativeData) {
      if ('error' in nativeData) {
        return NextResponse.json({ detail: nativeData.error }, { status: nativeData.status || 400 });
      }
      return NextResponse.json(nativeData);
    }

    return NextResponse.json(
      {
        detail: 'Could not extract Pinterest video. Please check that the Pin exists and is public.',
      },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json({ detail: err?.message || 'Internal server error' }, { status: 500 });
  }
}
