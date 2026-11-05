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
  const m1 = url.match(/\/pin\/(?:[^/]+-)?(\d{10,})/);
  if (m1) return m1[1];
  const m2 = url.match(/\/pin\/(\d+)/);
  if (m2) return m2[1];
  const m3 = url.match(/(\d{10,})/);
  if (m3) return m3[1];
  return null;
}

// ── Resolve short links ──────────────────────────────────────────────
async function resolveShortUrl(url: string): Promise<{ finalUrl: string; html?: string }> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    return { finalUrl: res.url, html };
  } catch {
    return { finalUrl: url };
  }
}

// ── Deep recursive search for media URLs ─────────────────────────────
function extractAllMediaUrls(obj: any): { videos: string[]; images: string[] } {
  const videos: string[] = [];
  const images: string[] = [];

  function walk(node: any) {
    if (!node) return;
    if (typeof node === 'string') {
      if (node.startsWith('http')) {
        if (
          node.includes('.mp4') ||
          (node.includes('pinimg.com/videos/') && node.includes('.m3u8'))
        ) {
          videos.push(node);
        } else if (
          node.match(/\.(jpg|jpeg|png|webp)(\?|$)/i) &&
          node.includes('pinimg.com')
        ) {
          images.push(node);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === 'object') {
      for (const key of Object.keys(node)) {
        walk(node[key]);
      }
    }
  }

  walk(obj);
  return {
    videos: Array.from(new Set(videos)),
    images: Array.from(new Set(images)),
  };
}

// ── Convert HLS to MP4 ───────────────────────────────────────────────
function hlsToMp4(hlsUrl: string): string {
  if (!hlsUrl) return hlsUrl;
  if (hlsUrl.includes('/iht/hls/')) {
    return hlsUrl.replace('/iht/hls/', '/mc/720p/').replace('.m3u8', '.mp4');
  }
  return hlsUrl.replace(/\/hls(?:_v\d+)?\//, '/720p/').replace('.m3u8', '.mp4');
}

// ── Get direct media URL for download ────────────────────────────────
async function getDirectMediaUrl(
  targetUrl: string,
  quality: string
): Promise<{ mediaUrl: string; isImage: boolean; title: string } | null> {
  try {
    const resolved = await resolveShortUrl(targetUrl);
    const currentUrl = resolved.finalUrl;
    let html = resolved.html || '';

    const pinId = extractPinId(currentUrl) || extractPinId(targetUrl);

    let videoUrl: string | null = null;
    let thumbnail: string | null = null;
    let title = '';

    // 1. Try Widget API
    if (pinId) {
      try {
        const widgetRes = await fetch(
          `https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`,
          { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8000) }
        );
        if (widgetRes.ok) {
          const wJson = await widgetRes.json();
          const pin =
            wJson?.data?.pins?.[0] ||
            (Array.isArray(wJson?.data) ? wJson.data[0] : null);

          if (pin && !pin.error) {
            title = pin.description || pin.rich_metadata?.title || '';
            const media = extractAllMediaUrls(pin);

            const mp4 = media.videos.find((v) => v.includes('.mp4'));
            if (mp4) {
              videoUrl = mp4;
            } else if (media.videos.length > 0) {
              videoUrl = hlsToMp4(media.videos[0]);
            }

            const origImg = media.images.find((img) => img.includes('/originals/'));
            const x736 = media.images.find((img) => img.includes('/736x/'));
            thumbnail = origImg || x736 || media.images[0] || null;
          }
        }
      } catch (e) {
        console.warn('Widget API error in download route:', e);
      }
    }

    // 2. Fallback to HTML scraper if video is needed but not found
    if (!videoUrl && (!html || html.length < 500)) {
      try {
        const pageRes = await fetch(currentUrl, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(12000),
        });
        html = (await pageRes.text())
          .replace(/\\\//g, '/')
          .replace(/\\u002F/g, '/');
      } catch {}
    }

    if (!videoUrl && html) {
      const mp4Matches = html.match(
        /https?:\/\/[^\s"'<>]+\.pinimg\.com\/videos\/[^\s"'<>]+\.mp4/g
      );
      if (mp4Matches && mp4Matches.length > 0) {
        videoUrl = mp4Matches[0];
      }

      if (!videoUrl) {
        const hlsMatches = html.match(
          /https?:\/\/[^\s"'<>]+\.pinimg\.com\/videos\/[^\s"'<>]+\.m3u8/g
        );
        if (hlsMatches && hlsMatches.length > 0) {
          videoUrl = hlsToMp4(hlsMatches[0]);
        }
      }

      if (!videoUrl) {
        const ogVid =
          html.match(/property="og:video(?::secure_url)?"\s+content="([^"]+)"/i) ||
          html.match(/content="([^"]+)"\s+property="og:video(?::secure_url)?"/i);
        if (ogVid) videoUrl = ogVid[1];
      }
    }

    if (!thumbnail && html) {
      const ogImg =
        html.match(/property="og:image"\s+content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"\s+property="og:image"/i);
      if (ogImg) thumbnail = ogImg[1];
    }

    if (!title && html) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s*[-|]\s*Pinterest\s*$/i, '').trim();
      }
    }
    if (!title) title = `pinterest_${pinId || 'media'}`;

    // Quality decision:
    // If quality requested is image:
    if (quality === 'original_image' && thumbnail) {
      return { mediaUrl: thumbnail, isImage: true, title };
    }

    // Default to video if available
    if (videoUrl) {
      return { mediaUrl: videoUrl, isImage: false, title };
    }

    // If only image available
    if (thumbnail) {
      return { mediaUrl: thumbnail, isImage: true, title };
    }

    return null;
  } catch (err) {
    console.error('getDirectMediaUrl error in download route:', err);
    return null;
  }
}

// ── Stream media from Pinterest CDN ──────────────────────────────────
async function streamMedia(mediaUrl: string, filename: string) {
  try {
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
      res.headers.get('content-type') ||
        (filename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg')
    );
    const cl = res.headers.get('content-length');
    if (cl) headers.set('Content-Length', cl);

    return new NextResponse(res.body, { status: 200, headers });
  } catch (err) {
    console.error('streamMedia error:', err);
    return null;
  }
}

// ── Pinterest URL validation ─────────────────────────────────────────
function isPinterestUrl(url: string): boolean {
  return /^(https?:\/\/)?([\w-]+\.)?pinterest\.(com|[a-z]{2,3}(\.[a-z]{2})?)|pin\.it|pinimg\.com/i.test(
    url.trim()
  );
}

// ── Core download handler ────────────────────────────────────────────
async function handleDownload(url: string, quality: string, customTitle?: string) {
  const cleanUrl = url.trim();

  if (!isPinterestUrl(cleanUrl)) {
    return NextResponse.json(
      {
        detail:
          'PinVault Pro is exclusively dedicated to Pinterest. Please provide a valid Pinterest URL.',
      },
      { status: 400 }
    );
  }

  // 1. Direct CDN media stream (instant download when direct pinimg link is passed)
  if (
    cleanUrl.startsWith('http') &&
    (cleanUrl.includes('pinimg.com/videos/') ||
      cleanUrl.match(/\.(mp4|jpg|jpeg|png|webp)(\?|$)/i))
  ) {
    const extMatch = cleanUrl.match(/\.(mp4|jpg|jpeg|png|webp)(\?|$)/i);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '.mp4';
    const safeTitle = (customTitle || 'pinterest_video')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .slice(0, 50)
      .replace(/\s+/g, '_');
    const filename = `${safeTitle || 'pinterest_video'}_${Date.now()}${ext}`;

    const directStream = await streamMedia(cleanUrl, filename);
    if (directStream) return directStream;
  }

  // 2. Scrape pin and extract media URL
  const media = await getDirectMediaUrl(cleanUrl, quality);
  if (media) {
    const ext = media.isImage ? '.jpg' : '.mp4';
    const titleToUse = customTitle || media.title || 'pinterest_download';
    const safeTitle = titleToUse
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .slice(0, 50)
      .replace(/\s+/g, '_');
    const filename = `${safeTitle || 'pinterest_download'}_${Date.now()}${ext}`;

    const result = await streamMedia(media.mediaUrl, filename);
    if (result) return result;
  }

  return NextResponse.json(
    {
      detail:
        'Could not download this Pinterest content. The Pin may be private or deleted. Please try another link.',
    },
    { status: 404 }
  );
}

// ── Route handlers ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, quality = 'best', title } = body;
    if (!url) {
      return NextResponse.json(
        { detail: 'Pinterest link is required' },
        { status: 400 }
      );
    }
    return await handleDownload(url, quality, title);
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
    const title = searchParams.get('title') || undefined;

    if (!url) {
      return NextResponse.json(
        { detail: 'Pinterest link is required' },
        { status: 400 }
      );
    }
    return await handleDownload(url, quality, title);
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
