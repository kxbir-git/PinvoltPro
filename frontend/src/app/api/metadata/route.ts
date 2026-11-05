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

// ── Resolve pin.it short links ───────────────────────────────────────
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

// ── Deep recursive search for media URLs in any object/array ─────────
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

// ── Convert HLS m3u8 URL to direct 720p MP4 URL ──────────────────────
function hlsToMp4(hlsUrl: string): string {
  if (!hlsUrl) return hlsUrl;
  if (hlsUrl.includes('/iht/hls/')) {
    return hlsUrl.replace('/iht/hls/', '/mc/720p/').replace('.m3u8', '.mp4');
  }
  return hlsUrl.replace(/\/hls(?:_v\d+)?\//, '/720p/').replace('.m3u8', '.mp4');
}

// ── Native Node.js Multi-Tier Pinterest Scraper ──────────────────────
async function scrapePinterestNative(targetUrl: string) {
  try {
    const resolved = await resolveShortUrl(targetUrl);
    const currentUrl = resolved.finalUrl;
    let html = resolved.html || '';

    const pinId = extractPinId(currentUrl) || extractPinId(targetUrl);

    let videoUrl: string | null = null;
    let thumbnail: string | null = null;
    let title = '';
    let description = '';
    let uploader = 'Pinterest';

    // ── Tier 1: Widget API (handles standard pins, story pins, idea pins)
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
            title =
              pin.description ||
              pin.rich_metadata?.title ||
              pin.rich_metadata?.article?.description ||
              '';
            description = pin.description || '';
            uploader = pin.pinner?.full_name || uploader;

            const media = extractAllMediaUrls(pin);

            // Prefer direct .mp4 first
            const mp4 = media.videos.find((v) => v.includes('.mp4'));
            if (mp4) {
              videoUrl = mp4;
            } else if (media.videos.length > 0) {
              videoUrl = hlsToMp4(media.videos[0]);
            }

            // Extract best thumbnail
            const origImg = media.images.find((img) => img.includes('/originals/'));
            const x736 = media.images.find((img) => img.includes('/736x/'));
            thumbnail = origImg || x736 || media.images[0] || null;
          }
        }
      } catch (wErr) {
        console.warn('Widget API error in Node:', wErr);
      }
    }

    // If HTML wasn't fetched yet or video is still missing, fetch the page
    if (!videoUrl && (!html || html.length < 500)) {
      try {
        const pageRes = await fetch(currentUrl, {
          headers: BROWSER_HEADERS,
          signal: AbortSignal.timeout(12000),
        });
        html = (await pageRes.text())
          .replace(/\\\//g, '/')
          .replace(/\\u002F/g, '/');
      } catch (pageErr) {
        console.warn('Page fetch error in Node:', pageErr);
      }
    }

    // ── Tier 2: HTML Page Parsing (Fallback if Widget API didn't find video)
    if (!videoUrl && html) {
      // 1. Check direct .mp4 in pinimg
      const mp4Matches = html.match(
        /https?:\/\/[^\s"'<>]+\.pinimg\.com\/videos\/[^\s"'<>]+\.mp4/g
      );
      if (mp4Matches && mp4Matches.length > 0) {
        videoUrl = mp4Matches[0];
      }

      // 2. Check m3u8 in pinimg
      if (!videoUrl) {
        const hlsMatches = html.match(
          /https?:\/\/[^\s"'<>]+\.pinimg\.com\/videos\/[^\s"'<>]+\.m3u8/g
        );
        if (hlsMatches && hlsMatches.length > 0) {
          videoUrl = hlsToMp4(hlsMatches[0]);
        }
      }

      // 3. JSON-LD VideoObject
      if (!videoUrl) {
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
                title = data.name || title;
                description = data.description || description;
                thumbnail = data.thumbnailUrl || thumbnail;
                break;
              }
            } catch {}
          }
        }
      }

      // 4. OpenGraph tags
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
    }

    // Thumbnail fallback from HTML
    if (!thumbnail && html) {
      const ogImg =
        html.match(/property="og:image"\s+content="([^"]+)"/i) ||
        html.match(/content="([^"]+)"\s+property="og:image"/i);
      if (ogImg) thumbnail = ogImg[1];
    }

    // Title fallback
    if (!title && html) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        title = titleMatch[1].replace(/\s*[-|]\s*Pinterest\s*$/i, '').trim();
      }
    }
    if (!title) title = `Pinterest Pin ${pinId || ''}`.trim();

    if (!videoUrl && !thumbnail) {
      return null;
    }

    const isImage = !videoUrl;
    const formats: {
      format_id: string;
      ext: string;
      resolution: string;
      filesize: number | null;
      download_url: string;
    }[] = [];

    if (videoUrl) {
      formats.push({
        format_id: '1080p',
        ext: 'mp4',
        resolution: 'Download HD Video (MP4)',
        filesize: null,
        download_url: videoUrl,
      });
      if (thumbnail) {
        formats.push({
          format_id: 'original_image',
          ext: 'jpg',
          resolution: 'Video Cover / Thumbnail (JPG)',
          filesize: null,
          download_url: thumbnail,
        });
      }
    } else if (thumbnail) {
      formats.push({
        format_id: 'original_image',
        ext: 'jpg',
        resolution: 'Download High-Res Image (JPG)',
        filesize: null,
        download_url: thumbnail,
      });
    }

    return {
      title,
      description: description.slice(0, 300),
      thumbnail: thumbnail || videoUrl,
      duration: 0,
      uploader,
      view_count: 0,
      platform: 'pinterest',
      formats,
      url: currentUrl,
      _video_url: videoUrl || thumbnail,
      _is_image: isImage,
    };
  } catch (err: any) {
    console.error('Pinterest native scraper error:', err);
    return null;
  }
}

// ── Route handler ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { detail: 'Pinterest link is required' },
        { status: 400 }
      );
    }

    const trimmedUrl = url.trim();

    // Pinterest-only validation
    const isPinterest =
      /^(https?:\/\/)?([\w-]+\.)?pinterest\.(com|[a-z]{2,3}(\.[a-z]{2})?)|pin\.it|pinimg\.com/i.test(
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

    // 1. Try Python service if available (optional)
    const pyUrl = process.env.PYTHON_SERVICE_URL;
    if (pyUrl) {
      try {
        const healthRes = await fetch(`${pyUrl}/health`, {
          signal: AbortSignal.timeout(2000),
        });
        if (healthRes.ok) {
          const res = await fetch(`${pyUrl}/api/metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: trimmedUrl }),
            signal: AbortSignal.timeout(10000),
          });
          const data = await res.json().catch(() => ({}));
          // Only return Python data if it actually found a video when applicable
          if (res.ok && (data?.title || data?.thumbnail) && !data?._is_image) {
            return NextResponse.json(data);
          }
        }
      } catch {
        // Fall through to native Node scraper
      }
    }

    // 2. Native scraper (ultra-fast, supports Idea Pins, video blocks, story pins)
    const nativeData = await scrapePinterestNative(trimmedUrl);
    if (nativeData) {
      return NextResponse.json(nativeData);
    }

    return NextResponse.json(
      {
        detail:
          'Could not extract Pinterest video. Please check that the Pin exists and is public.',
      },
      { status: 404 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
