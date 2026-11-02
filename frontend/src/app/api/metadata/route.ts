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

// ── Native Node.js Pinterest Scraper ─────────────────────────────────
async function scrapePinterestNative(targetUrl: string) {
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
            let thumbnail: string | null = null;
            const images = p.images || {};
            for (const s of ['orig', '736x', '564x']) {
              if (images[s]?.url) {
                thumbnail = images[s].url;
                break;
              }
            }

            if (videoUrl || thumbnail) {
              const title =
                p.description ||
                p.rich_metadata?.title ||
                `Pinterest Pin ${pinId}`;
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
                    ? [
                        {
                          format_id: '1080p',
                          ext: 'mp4',
                          resolution: '1080p / 720p HD Video (MP4)',
                          filesize: null,
                        },
                      ]
                    : []),
                  ...(thumbnail
                    ? [
                        {
                          format_id: 'original_image',
                          ext: 'jpg',
                          resolution: isImage
                            ? 'Original High-Res Image'
                            : 'Thumbnail',
                          filesize: null,
                        },
                      ]
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
        console.warn('Widget API fetch failed:', wErr);
      }
    }

    // Tier 2: HTML Scraper
    const pageRes = await fetch(currentUrl, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(12000),
    });

    const html = (await pageRes.text())
      .replace(/\\\//g, '/')
      .replace(/\\u002F/g, '/');

    if (pageRes.status === 404 || html.includes('"PinNotFound"')) {
      return {
        error: 'This Pin does not exist or has been deleted on Pinterest.',
        status: 404,
      };
    }

    let videoUrl: string | null = null;
    let thumbnail: string | null = null;
    let title = '';
    let description = '';

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
            title = data.name || title;
            description = data.description || description;
            thumbnail = data.thumbnailUrl || thumbnail;
            break;
          }
        } catch {}
      }
    }

    // Direct video URLs
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
    const formats: { format_id: string; ext: string; resolution: string; filesize: null }[] = [];
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
    console.error('Pinterest scraper error:', err);
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

    // 1. Try Python service if available (optional — Render bonus)
    const pyUrl = process.env.PYTHON_SERVICE_URL;
    if (pyUrl) {
      try {
        const healthRes = await fetch(`${pyUrl}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        if (healthRes.ok) {
          const res = await fetch(`${pyUrl}/api/metadata`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: trimmedUrl }),
            signal: AbortSignal.timeout(15000),
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && (data?.title || data?.thumbnail)) {
            return NextResponse.json(data);
          }
        }
      } catch {
        // Python not available — continue to Node.js scraper
      }
    }

    // 2. Node.js native scraper (always works on Vercel)
    const nativeData = await scrapePinterestNative(trimmedUrl);
    if (nativeData) {
      if ('error' in nativeData) {
        return NextResponse.json(
          { detail: nativeData.error },
          { status: nativeData.status || 400 }
        );
      }
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
