import { NextRequest, NextResponse } from 'next/server';

// ── Browser-like headers ─────────────────────────────────────────────
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ── Pin-ID extractor ─────────────────────────────────────────────────
function extractPinId(url: string): string | null {
  const m1 = url.match(/\/pin\/(?:[^/]+-)(\d{10,})/);
  if (m1) return m1[1];
  const m2 = url.match(/\/pin\/(\d+)/);
  if (m2) return m2[1];
  const m3 = url.match(/(\d{10,})/);
  if (m3) return m3[1];
  return null;
}

// ── Resolve pin.it short links ───────────────────────────────────────
async function resolveShortUrl(url: string): Promise<string> {
  if (!url.includes('pin.it')) return url;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    return res.url;
  } catch {
    return url;
  }
}

// ── Get direct video/image URL via Node.js (no Python needed) ────────
async function getDirectMediaUrl(
  targetUrl: string
): Promise<{ mediaUrl: string; isImage: boolean; title: string } | null> {
  try {
    const currentUrl = await resolveShortUrl(targetUrl);
    const pinId = extractPinId(currentUrl);

    // Tier 1: Widget API
    if (pinId) {
      try {
        const widgetRes = await fetch(
          `https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`,
          { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) }
        );
        if (widgetRes.ok) {
          const wJson = await widgetRes.json();
          const pins =
            wJson?.data?.pins ||
            (Array.isArray(wJson?.data) ? wJson.data : []);
          if (pins?.[0] && !pins[0].error) {
            const p = pins[0];

            // Video URL
            let videoUrl: string | null = null;
            const vList = p.videos?.video_list || {};
            for (const q of ['V_720P', 'V_EXP7', 'V_480P', 'V_360P']) {
              if (vList[q]?.url) {
                videoUrl = vList[q].url;
                break;
              }
            }
            if (!videoUrl && vList.V_HLSV4?.url) {
              videoUrl = vList.V_HLSV4.url
                .replace(/\/hls(?:_v\d+)?\//, '/720p/')
                .replace('.m3u8', '.mp4');
            }

            // Image URL
            let imageUrl: string | null = null;
            const images = p.images || {};
            for (const s of ['orig', '736x', '564x']) {
              if (images[s]?.url) {
                imageUrl = images[s].url;
                break;
              }
            }

            const title =
              p.description || p.rich_metadata?.title || `Pinterest Pin ${pinId}`;

            if (videoUrl) {
              return { mediaUrl: videoUrl, isImage: false, title };
            }
            if (imageUrl) {
              return { mediaUrl: imageUrl, isImage: true, title };
            }
          }
        }
      } catch (e) {
        console.warn('Widget API error:', e);
      }
    }

    // Tier 2: HTML scraper
    const pageRes = await fetch(currentUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(12000),
    });
    const html = (await pageRes.text())
      .replace(/\\\//g, '/')
      .replace(/\\u002F/g, '/');

    let videoUrl: string | null = null;
    let imageUrl: string | null = null;
    let title = '';

    // JSON-LD VideoObject
    const ldMatches = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi
    );
    if (ldMatches) {
      for (const block of ldMatches) {
        try {
          const raw = block.replace(/<\/?script[^>]*>/gi, '');
          const data = JSON.parse(raw);
          if (data['@type'] === 'VideoObject' && data.contentUrl) {
            videoUrl = data.contentUrl;
            title = data.name || '';
            break;
          }
        } catch {}
      }
    }

    // Direct video URLs in HTML
    if (!videoUrl) {
      const vMatches = html.match(
        /https?:\/\/(?:v|v1)\.pinimg\.com\/videos\/[^\s"'<>]+?\.(?:mp4|m3u8)/g
      );
      if (vMatches?.length) {
        const mp4 = vMatches.find((m) => m.includes('.mp4'));
        videoUrl = mp4
          ? mp4
          : vMatches[0]
              .replace(/\/hls(?:_v\d+)?\//, '/720p/')
              .replace('.m3u8', '.mp4');
      }
    }

    // og:video
    if (!videoUrl) {
      const ogVid =
        html.match(
          /property="og:video(?::secure_url)?"\s+content="([^"]+)"/i
        ) ||
        html.match(
          /content="([^"]+)"\s+property="og:video(?::secure_url)?"/i
        );
      if (ogVid) videoUrl = ogVid[1];
    }

    // og:image
    const ogImg =
      html.match(/property="og:image"\s+content="([^"]+)"/i) ||
      html.match(/content="([^"]+)"\s+property="og:image"/i);
    if (ogImg) imageUrl = ogImg[1];

    if (!title) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s*[-|]\s*Pinterest\s*$/i, '').trim();
      }
    }
    if (!title) title = `Pinterest Pin ${pinId || ''}`.trim();

    if (videoUrl) return { mediaUrl: videoUrl, isImage: false, title };
    if (imageUrl) return { mediaUrl: imageUrl, isImage: true, title };

    return null;
  } catch (err) {
    console.error('getDirectMediaUrl error:', err);
    return null;
  }
}

// ── Stream media from CDN ────────────────────────────────────────────
async function streamMedia(mediaUrl: string, filename: string) {
  const res = await fetch(mediaUrl, {
    headers: {
      'User-Agent': BROWSER_HEADERS['User-Agent'],
      Referer: 'https://www.pinterest.com/',
    },
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok || !res.body) return null;

  const headers = new Headers();
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set(
    'Content-Type',
    res.headers.get('content-type') || 'application/octet-stream'
  );
  const cl = res.headers.get('content-length');
  if (cl) headers.set('Content-Length', cl);

  return new NextResponse(res.body, { status: 200, headers });
}

// ── Pinterest URL validation ─────────────────────────────────────────
function isPinterestUrl(url: string): boolean {
  return /^(https?:\/\/)?([\w-]+\.)?pinterest\.(com|[a-z]{2,3}(\.[a-z]{2})?)|pin\.it|pinimg\.com/i.test(
    url.trim()
  );
}

// ── Optional: try Python service if available ────────────────────────
async function tryPythonService(
  url: string,
  quality: string
): Promise<NextResponse | null> {
  const pyUrl = process.env.PYTHON_SERVICE_URL;
  if (!pyUrl) return null;

  try {
    const healthRes = await fetch(`${pyUrl}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!healthRes.ok) return null;
  } catch {
    return null;
  }

  try {
    const res = await fetch(`${pyUrl}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, quality }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok || !res.body) return null;

    const headers = new Headers();
    const rawDisp = res.headers.get('content-disposition');
    if (rawDisp) {
      headers.set(
        'content-disposition',
        rawDisp.replace(/[^\x20-\x7E]/g, '_')
      );
    }
    headers.set(
      'content-type',
      res.headers.get('content-type') || 'application/octet-stream'
    );
    const cl = res.headers.get('content-length');
    if (cl) headers.set('content-length', cl);

    return new NextResponse(res.body, { status: 200, headers });
  } catch (err: any) {
    console.warn('Python service download failed:', err?.message);
    return null;
  }
}

// ── Core download handler ────────────────────────────────────────────
async function handleDownload(url: string, quality: string) {
  if (!isPinterestUrl(url)) {
    return NextResponse.json(
      {
        detail:
          'PinVault Pro is exclusively dedicated to Pinterest. Please provide a valid Pinterest URL.',
      },
      { status: 400 }
    );
  }

  // 1. If URL is already a direct CDN media file → stream it
  if (
    url.startsWith('http') &&
    (url.includes('.pinimg.com/videos/') ||
      url.match(/\.(mp4|jpg|jpeg|png|webp)(\?|$)/i))
  ) {
    const extMatch = url.match(/\.(mp4|jpg|jpeg|png|webp)(\?|$)/i);
    const ext = extMatch ? `.${extMatch[1]}` : '.mp4';
    const result = await streamMedia(
      url,
      `pinterest_download_${Date.now()}${ext}`
    );
    if (result) return result;
  }

  // 2. Try Python service (Render) if available — optional bonus
  const pyResult = await tryPythonService(url, quality);
  if (pyResult) return pyResult;

  // 3. Node.js native scraper → find direct media URL → stream it
  const media = await getDirectMediaUrl(url);
  if (media) {
    const ext = media.isImage ? '.jpg' : '.mp4';
    const safeTitle = media.title
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .slice(0, 60)
      .replace(/\s+/g, '_');
    const filename = `${safeTitle || 'pinterest_download'}_${Date.now()}${ext}`;

    const result = await streamMedia(media.mediaUrl, filename);
    if (result) return result;
  }

  // 4. Nothing worked
  return NextResponse.json(
    {
      detail:
        'Could not download this Pinterest content. The Pin may be private, deleted, or region-restricted. Please try a different Pinterest link.',
    },
    { status: 404 }
  );
}

// ── Route handlers ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, quality = 'best' } = body;
    if (!url) {
      return NextResponse.json(
        { detail: 'Pinterest link is required' },
        { status: 400 }
      );
    }
    return await handleDownload(url, quality);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get('url');
    const quality = searchParams.get('quality') || 'best';
    if (!url) {
      return NextResponse.json(
        { detail: 'Pinterest link is required' },
        { status: 400 }
      );
    }
    return await handleDownload(url, quality);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
