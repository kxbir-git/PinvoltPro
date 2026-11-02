from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import yt_dlp
import os
import re
import glob
import json
import uuid
import subprocess
import requests
import time
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import sys
import shutil

# ── Detect FFmpeg ───────────────────────────────────────
FFMPEG_PATH = None
try:
    candidates = [
        Path(sys.prefix) / ("Scripts" if os.name == "nt" else "bin") / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg"),
        Path.cwd() / "ffmpeg.exe",
        Path.cwd() / "python-service" / "ffmpeg.exe",
    ]
    for c in candidates:
        if c.exists():
            FFMPEG_PATH = str(c.resolve())
            break

    if not FFMPEG_PATH:
        try:
            import 
            
            raw_ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
            if raw_ffmpeg and os.path.exists(raw_ffmpeg):
                FFMPEG_PATH = raw_ffmpeg
        except Exception:
            pass

    if not FFMPEG_PATH:
        # Check system PATH
        system_ffmpeg = shutil.which("ffmpeg")
        if system_ffmpeg:
            FFMPEG_PATH = system_ffmpeg

    if FFMPEG_PATH:
        ffmpeg_dir = str(Path(FFMPEG_PATH).parent)
        if ffmpeg_dir not in os.environ.get("PATH", ""):
            os.environ["PATH"] = f"{ffmpeg_dir};{os.environ.get('PATH', '')}"
        print(f"[FFmpeg] Using FFmpeg at: {FFMPEG_PATH}")
    else:
        print("[FFmpeg] Notice: FFmpeg not detected, direct MP4 streaming will be prioritized.")
except Exception as e:
    print(f"[FFmpeg] Detection error: {e}")
    FFMPEG_PATH = None

app = FastAPI(
    title="PinVault Pro - Pinterest Video Service",
    description="High-reliability Pinterest Video & Reel Downloader API",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DOWNLOAD_DIR = Path("./downloads")
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

BROWSER_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

PINTEREST_API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Pinterest-PWS-Handler': 'www/[username]/[slug].js',
    'Referer': 'https://www.pinterest.com/',
}


def _is_pinterest_url(url: str) -> bool:
    """Validate if the provided URL belongs to Pinterest."""
    if not url:
        return False
    parsed = urlparse(url.strip())
    host = (parsed.hostname or '').lower()
    return any(host == d or host.endswith('.' + d) for d in ['pinterest.com', 'pin.it', 'pinimg.com', 'pinterest.co.uk', 'pinterest.ca', 'pinterest.de', 'pinterest.fr'])


def _resolve_short_url(url: str) -> str:
    """Resolve short URLs (e.g. pin.it) to canonical Pinterest URL."""
    try:
        session = requests.Session()
        session.headers.update(BROWSER_HEADERS)
        resp = session.head(url, allow_redirects=True, timeout=10)
        final_url = resp.url
        if 'pin.it' in final_url:
            resp = session.get(url, allow_redirects=True, timeout=10)
            final_url = resp.url
        return final_url
    except Exception as e:
        print(f"[Resolver] Short URL resolve failed: {e}")
        return url


def _extract_pin_id(url: str) -> Optional[str]:
    """Extract numeric Pin ID from any Pinterest URL variant."""
    # Common format: /pin/1234567890/ or /pin/slug-1234567890/
    match = re.search(r'/pin/(?:[^/]+-)?(\d{10,})', url)
    if match:
        return match.group(1)
    
    # Generic /pin/(\d+)
    match = re.search(r'/pin/(\d+)', url)
    if match:
        return match.group(1)

    # Path digits fallback
    parsed = urlparse(url)
    match = re.search(r'(\d{10,})', parsed.path)
    if match:
        return match.group(1)

    return None


def _check_url_reachable(url: str) -> bool:
    """Quickly check if a direct MP4 URL returns 200 OK."""
    try:
        r = requests.head(url, headers=BROWSER_HEADERS, timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def _hls_to_mp4_url(hls_url: str) -> Optional[str]:
    """
    Pinterest's CDN stores direct 720p MP4 mirrors of HLS streams.
    Transforms HLS master playlist URL into the direct 720p MP4 URL.
    """
    if not hls_url:
        return None
    # Pattern 1: /hls/.../master.m3u8 -> /720p/.../<id>.mp4
    candidate = re.sub(r'/hls(?:_v\d+)?/', '/720p/', hls_url)
    candidate = re.sub(r'/master\.m3u8.*', '.mp4', candidate)
    candidate = re.sub(r'\.m3u8.*', '.mp4', candidate)
    
    if candidate != hls_url:
        if _check_url_reachable(candidate):
            return candidate

    # Pattern 2: /exp/.../hls/ -> /exp/.../720p/
    if '/hls/' in hls_url:
        candidate2 = hls_url.replace('/hls/', '/720p/').replace('.m3u8', '.mp4')
        if _check_url_reachable(candidate2):
            return candidate2

    return None


# ── Tier 1: Pinterest Widget API (Most reliable, zero block) ──
def _fetch_from_widget_api(pin_id: str, original_url: str) -> Optional[dict]:
    """
    Fetch pin metadata using the public Pinterest Widget API.
    Endpoint: https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids={pin_id}
    """
    try:
        api_url = f"https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids={pin_id}"
        resp = requests.get(api_url, headers=BROWSER_HEADERS, timeout=10)
        if resp.status_code != 200:
            return None

        payload = resp.json()
        pins = payload.get('data', {}).get('pins', [])
        if not pins and isinstance(payload.get('data'), list):
            pins = payload.get('data')

        if not pins or 'error' in pins[0]:
            return None

        pin_data = pins[0]
        title = pin_data.get('description', '') or pin_data.get('rich_metadata', {}).get('title', '')
        title = title[:120].strip() or f"Pinterest Pin {pin_id}"
        description = pin_data.get('description', '') or ''
        uploader = pin_data.get('pinner', {}).get('full_name', 'Pinterest User')

        # Video list
        video_url = None
        all_videos = {}
        v_obj = pin_data.get('videos', {})
        if v_obj and v_obj.get('video_list'):
            v_list = v_obj['video_list']
            # Look for direct MP4 first
            for q in ['V_720P', 'V_EXP7', 'V_480P', 'V_360P']:
                if q in v_list and v_list[q].get('url'):
                    u = v_list[q]['url']
                    if '.mp4' in u:
                        video_url = u
                        all_videos[q] = u
                        break
            
            # If only HLS, try to find direct mp4 mirror
            if not video_url and 'V_HLSV4' in v_list:
                hls_u = v_list['V_HLSV4'].get('url')
                mp4_direct = _hls_to_mp4_url(hls_u)
                if mp4_direct:
                    video_url = mp4_direct
                else:
                    video_url = hls_u

        # Images
        thumbnail = None
        images = pin_data.get('images', {})
        if images:
            for s in ['orig', '736x', '564x', '474x', '236x']:
                if s in images and images[s].get('url'):
                    thumbnail = images[s]['url']
                    break

        if not video_url and not thumbnail:
            return None

        is_image = video_url is None
        formats = []
        if video_url:
            formats.append({
                'format_id': '1080p',
                'ext': 'mp4',
                'resolution': '1080p / 720p HD Video (MP4)',
                'filesize': None,
            })
        if thumbnail:
            formats.append({
                'format_id': 'original_image',
                'ext': 'jpg',
                'resolution': 'Original High-Res Image' if is_image else 'Video Thumbnail',
                'filesize': None,
            })

        return {
            'title': title,
            'description': description[:300],
            'thumbnail': thumbnail or video_url,
            'duration': 0,
            'uploader': uploader,
            'view_count': pin_data.get('repin_count', 0),
            'platform': 'pinterest',
            'formats': formats,
            'url': original_url,
            '_video_url': video_url or thumbnail,
            '_is_image': is_image,
        }
    except Exception as e:
        print(f"[Widget API] Error for pin {pin_id}: {e}")
        return None


# ── Tier 2: Pinterest PinResource API (Detailed pin data & Idea Pins) ─
def _fetch_from_resource_api(pin_id: str, original_url: str) -> Optional[dict]:
    """
    Fetch pin using Pinterest's official client API (PinResource).
    Supports standard videos, Idea Pins / story pins, and carousels.
    """
    try:
        data_param = json.dumps({
            "options": {
                "id": pin_id,
                "field_set_key": "detailed"
            },
            "context": {}
        })
        api_url = f"https://www.pinterest.com/resource/PinResource/get/?data={requests.utils.quote(data_param)}"
        resp = requests.get(api_url, headers=PINTEREST_API_HEADERS, timeout=12)
        if resp.status_code != 200:
            return None

        resp_json = resp.json()
        pin_data = resp_json.get('resource_response', {}).get('data', {})
        if not pin_data or pin_data.get('type') == 'error':
            return None

        title = pin_data.get('title') or pin_data.get('grid_title') or pin_data.get('closeup_unified_description', '')
        title = title[:120].strip() or f"Pinterest Pin {pin_id}"
        description = pin_data.get('description', '') or ''
        uploader = pin_data.get('pinner', {}).get('full_name', 'Pinterest')

        video_url = None
        # Check standard videos
        v_obj = pin_data.get('videos', {})
        if v_obj and v_obj.get('video_list'):
            v_list = v_obj['video_list']
            for q in ['V_720P', 'V_EXP7', 'V_480P', 'V_360P']:
                if q in v_list and v_list[q].get('url'):
                    video_url = v_list[q]['url']
                    break
            if not video_url and 'V_HLSV4' in v_list:
                hls_u = v_list['V_HLSV4'].get('url')
                video_url = _hls_to_mp4_url(hls_u) or hls_u

        # Check story pins (Idea Pins)
        if not video_url and pin_data.get('story_pin_data'):
            story = pin_data['story_pin_data']
            pages = story.get('pages', [])
            for page in pages:
                blocks = page.get('blocks', [])
                for b in blocks:
                    b_video = b.get('video', {})
                    if b_video and b_video.get('video_list'):
                        bv_list = b_video['video_list']
                        for q in ['V_720P', 'V_EXP7', 'V_480P']:
                            if q in bv_list and bv_list[q].get('url'):
                                video_url = bv_list[q]['url']
                                break
                    if video_url:
                        break
                if video_url:
                    break

        # Images
        thumbnail = None
        images = pin_data.get('images', {})
        if images:
            for s in ['orig', '736x', '564x', '474x']:
                if s in images and images[s].get('url'):
                    thumbnail = images[s]['url']
                    break

        if not video_url and not thumbnail:
            return None

        is_image = video_url is None
        formats = []
        if video_url:
            formats.append({
                'format_id': '1080p',
                'ext': 'mp4',
                'resolution': '1080p / 720p HD Video (MP4)',
                'filesize': None,
            })
        if thumbnail:
            formats.append({
                'format_id': 'original_image',
                'ext': 'jpg',
                'resolution': 'Original High-Res Image' if is_image else 'Video Thumbnail',
                'filesize': None,
            })

        return {
            'title': title,
            'description': description[:300],
            'thumbnail': thumbnail or video_url,
            'duration': pin_data.get('duration', 0),
            'uploader': uploader,
            'view_count': pin_data.get('repin_count', 0),
            'platform': 'pinterest',
            'formats': formats,
            'url': original_url,
            '_video_url': video_url or thumbnail,
            '_is_image': is_image,
        }
    except Exception as e:
        print(f"[PinResource API] Error: {e}")
        return None


# ── Tier 3: Direct Web Scraper (HTML, Relay, LD+JSON) ──
def _fetch_from_html_scrape(url: str, pin_id: Optional[str]) -> Optional[dict]:
    """
    Scrape Pinterest page directly to parse embedded JSON-LD and Relay cache.
    """
    try:
        resp = requests.get(url, headers=BROWSER_HEADERS, timeout=12)
        if resp.status_code != 200 or len(resp.text) < 500:
            return None

        html = resp.text.replace(r'\/', '/').replace(r'\u002F', '/')

        if '"PinNotFound"' in html or 'Page not found' in html:
            raise HTTPException(status_code=404, detail="This Pin does not exist or has been deleted on Pinterest.")

        video_url = None
        thumbnail = None
        title = ""
        description = ""

        # 1. Parse JSON-LD Schema
        ld_matches = re.findall(r'<script type="application/ld\+json">([^<]+)</script>', html)
        for ld in ld_matches:
            try:
                data = json.loads(ld)
                if isinstance(data, dict):
                    if data.get('@type') == 'VideoObject' and data.get('contentUrl'):
                        video_url = data.get('contentUrl')
                        title = data.get('name') or title
                        description = data.get('description') or description
                        thumbnail = data.get('thumbnailUrl') or thumbnail
                        break
            except Exception:
                continue

        # 2. Check Relay Register Completed Request
        if not video_url:
            relay_matches = re.findall(r'window\.__PWS_RELAY_REGISTER_COMPLETED_REQUEST__\([^\,]+\,\s*(\{.*?\})\);', html)
            for rm in relay_matches:
                try:
                    r_json = json.loads(rm)
                    p_data = r_json.get('data', {}).get('v3GetPinQueryv2', {}) or r_json.get('data', {}).get('v3GetPinQuery', {})
                    if not p_data:
                        continue

                    title = p_data.get('title') or p_data.get('gridTitle') or title
                    description = p_data.get('description') or description

                    v_obj = p_data.get('videos', {})
                    if v_obj:
                        v_list = v_obj.get('videoList') or v_obj.get('video_list') or {}
                        for q in ['V_720P', 'V_EXP7', 'V_480P', 'V_360P']:
                            if q in v_list and v_list[q].get('url'):
                                video_url = v_list[q]['url']
                                break
                        if not video_url and 'V_HLSV4' in v_list:
                            hls_u = v_list['V_HLSV4'].get('url')
                            video_url = _hls_to_mp4_url(hls_u) or hls_u

                    img_obj = p_data.get('images', {})
                    if img_obj:
                        for s in ['orig', '736x', '564x']:
                            if s in img_obj and img_obj[s].get('url'):
                                thumbnail = img_obj[s]['url']
                                break

                    if video_url:
                        break
                except Exception:
                    continue

        # 3. Fallback regex for direct pinimg video MP4/HLS
        if not video_url:
            v_matches = re.findall(r'https?://(?:v|v1)\.pinimg\.com/videos/[^\s"\'<>]+?\.(?:mp4|m3u8)', html)
            for vm in v_matches:
                if '.mp4' in vm:
                    video_url = vm
                    break
            if not video_url and v_matches:
                video_url = _hls_to_mp4_url(v_matches[0]) or v_matches[0]

        # 4. OpenGraph video tag
        if not video_url:
            og_vid = re.search(r'property="og:video(?::secure_url)?"\s+content="([^"]+)"', html, re.I) or \
                     re.search(r'content="([^"]+)"\s+property="og:video(?::secure_url)?"', html, re.I)
            if og_vid:
                video_url = og_vid.group(1)

        # 5. Thumbnail and Title fallback
        if not thumbnail:
            og_img = re.search(r'property="og:image"\s+content="([^"]+)"', html)
            if og_img:
                thumbnail = og_img.group(1)

        if not title:
            title_m = re.search(r'<title>([^<]+)</title>', html)
            if title_m:
                title = re.sub(r'\s*[-|]\s*Pinterest\s*$', '', title_m.group(1)).strip()
            if not title:
                title = f"Pinterest Pin {pin_id or ''}".strip()

        media_url = video_url or thumbnail
        if not media_url:
            return None

        is_image = video_url is None
        formats = []
        if video_url:
            formats.append({
                'format_id': '1080p',
                'ext': 'mp4',
                'resolution': '1080p / 720p HD Video (MP4)',
                'filesize': None,
            })
        if thumbnail:
            formats.append({
                'format_id': 'original_image',
                'ext': 'jpg',
                'resolution': 'Original High-Res Image' if is_image else 'Video Thumbnail',
                'filesize': None,
            })

        return {
            'title': title,
            'description': description[:300],
            'thumbnail': thumbnail or video_url,
            'duration': 0,
            'uploader': 'Pinterest',
            'view_count': 0,
            'platform': 'pinterest',
            'formats': formats,
            'url': url,
            '_video_url': media_url,
            '_is_image': is_image,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[HTML Scraper] Error: {e}")
        return None


# ── Tier 4: yt-dlp Pinterest Fallback ──────────────────
def _fetch_from_ytdlp(url: str) -> Optional[dict]:
    """Fallback extractor using yt-dlp's native Pinterest handler."""
    ydl_opts: Dict[str, Any] = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'noplaylist': True,
    }
    if FFMPEG_PATH:
        ydl_opts['ffmpeg_location'] = FFMPEG_PATH

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if not info:
                return None

            formats = [{
                'format_id': '1080p',
                'ext': 'mp4',
                'resolution': 'HD Video (MP4)',
                'filesize': None,
            }]

            thumbnail = info.get('thumbnail')
            if thumbnail:
                formats.append({
                    'format_id': 'original_image',
                    'ext': 'jpg',
                    'resolution': 'Thumbnail / Cover',
                    'filesize': None,
                })

            return {
                'title': info.get('title', 'Pinterest Video'),
                'description': (info.get('description') or '')[:300],
                'thumbnail': thumbnail,
                'duration': info.get('duration', 0),
                'uploader': info.get('uploader') or 'Pinterest',
                'view_count': info.get('view_count', 0),
                'platform': 'pinterest',
                'formats': formats,
                'url': url,
                '_video_url': info.get('url') or thumbnail,
                '_is_image': False,
            }
    except Exception as e:
        print(f"[yt-dlp] Fallback failed: {e}")
        return None


def get_pinterest_metadata(raw_url: str) -> dict:
    """
    Main resilient multi-tier metadata resolver for Pinterest.
    Executes Tier 1 (Widget API) -> Tier 2 (PinResource) -> Tier 3 (HTML Scraper) -> Tier 4 (yt-dlp).
    Guarantees reliable output at all times.
    """
    cleaned_url = raw_url.strip()
    if 'pin.it' in cleaned_url:
        cleaned_url = _resolve_short_url(cleaned_url)

    pin_id = _extract_pin_id(cleaned_url)
    print(f"[Pinterest] Processing: URL={cleaned_url}, Pin ID={pin_id}")

    # 1. Widget API (Fastest and zero block risk)
    if pin_id:
        data = _fetch_from_widget_api(pin_id, cleaned_url)
        if data:
            print("[Pinterest] Successfully extracted via Widget API")
            return data

    # 2. PinResource API
    if pin_id:
        data = _fetch_from_resource_api(pin_id, cleaned_url)
        if data:
            print("[Pinterest] Successfully extracted via PinResource API")
            return data

    # 3. Direct HTML Scraper
    data = _fetch_from_html_scrape(cleaned_url, pin_id)
    if data:
        print("[Pinterest] Successfully extracted via HTML Scraper")
        return data

    # 4. yt-dlp fallback
    data = _fetch_from_ytdlp(cleaned_url)
    if data:
        print("[Pinterest] Successfully extracted via yt-dlp")
        return data

    raise HTTPException(
        status_code=404,
        detail="Could not find or extract media from this Pinterest link. Please make sure the Pin is public and the URL is correct."
    )


class MetadataRequest(BaseModel):
    url: str


class DownloadRequest(BaseModel):
    url: str
    quality: str = "best"


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "pinvault-pinterest-service",
        "ffmpeg_available": FFMPEG_PATH is not None,
    }


# ── Metadata Endpoint ──────────────────────────────────
@app.post("/api/metadata")
def fetch_metadata(req: MetadataRequest):
    """
    Extract Pinterest video and media metadata.
    Strictly verifies that only Pinterest links are processed.
    """
    target_url = req.url.strip()
    if not _is_pinterest_url(target_url):
        raise HTTPException(
            status_code=400,
            detail="PinVault Pro is exclusively dedicated to Pinterest. Please enter a valid Pinterest URL (e.g., https://pin.it/... or https://www.pinterest.com/pin/...)."
        )

    return get_pinterest_metadata(target_url)


def _sanitize_filename(name: str) -> str:
    """Sanitize filename to be safe for all filesystems and HTTP headers."""
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    name = re.sub(r'[^\x20-\x7E]', '_', name)
    name = re.sub(r'\s+', ' ', name)
    return name[:120].strip() or 'pinterest_video'


def _cleanup_old_downloads():
    """Remove download cache older than 1 hour."""
    cutoff = time.time() - 3600
    for f in DOWNLOAD_DIR.iterdir():
        if f.is_file() and f.stat().st_mtime < cutoff:
            try:
                f.unlink()
            except OSError:
                pass


# ── Download & Stream Endpoint ─────────────────────────
@app.post("/api/download")
def download_media(req: DownloadRequest):
    """
    Download Pinterest video or image and stream it directly to user's browser.
    Ensures highest quality MP4 video with full sound and proper filename.
    """
    _cleanup_old_downloads()
    task_id = str(uuid.uuid4())
    target_url = req.url.strip()

    # Reject non-Pinterest links
    if not _is_pinterest_url(target_url):
        raise HTTPException(
            status_code=400,
            detail="PinVault Pro only downloads Pinterest videos. Please provide a valid Pinterest link."
        )

    # 1. Fetch metadata and media URL
    meta = get_pinterest_metadata(target_url)
    media_url = meta.get('_video_url') or meta.get('thumbnail')
    is_image = meta.get('_is_image', False)

    if not media_url:
        raise HTTPException(status_code=404, detail="No downloadable media found for this Pin.")

    title_safe = _sanitize_filename(meta.get('title', 'pinterest_video'))

    # If user selected original image
    if req.quality == 'original_image' or is_image:
        filepath = DOWNLOAD_DIR / f"{task_id}.jpg"
        img_url = meta.get('thumbnail') or media_url
        try:
            r = requests.get(img_url, headers=BROWSER_HEADERS, stream=True, timeout=30)
            r.raise_for_status()
            with open(filepath, 'wb') as f:
                for chunk in r.iter_content(chunk_size=16384):
                    f.write(chunk)

            download_name = f"{title_safe}.jpg"
            return FileResponse(
                path=str(filepath),
                filename=download_name,
                media_type="image/jpeg",
                headers={'Content-Disposition': f'attachment; filename="{download_name}"'},
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Image download failed: {str(e)}")

    # If it is an HLS stream (.m3u8), try direct mp4 translation first
    if '.m3u8' in media_url:
        direct_mp4 = _hls_to_mp4_url(media_url)
        if direct_mp4:
            media_url = direct_mp4

    # If it is STILL .m3u8 and we have FFmpeg, transcode HLS to MP4
    if '.m3u8' in media_url:
        if not FFMPEG_PATH:
            raise HTTPException(
                status_code=500,
                detail="This Pinterest video requires FFmpeg stream packaging, which is not available on the server."
            )

        filepath = DOWNLOAD_DIR / f"{task_id}.mp4"
        print(f"[{task_id}] Packaging HLS stream via FFmpeg into MP4...")
        try:
            cmd = [
                FFMPEG_PATH,
                "-y",
                "-headers", f"User-Agent: {BROWSER_HEADERS['User-Agent']}\r\n",
                "-i", media_url,
                "-c", "copy",
                "-bsf:a", "aac_adtstoasc",
                str(filepath)
            ]
            subprocess.run(cmd, check=True, timeout=90, capture_output=True)
            if filepath.exists() and filepath.stat().st_size > 1000:
                download_name = f"{title_safe}.mp4"
                return FileResponse(
                    path=str(filepath),
                    filename=download_name,
                    media_type="video/mp4",
                    headers={'Content-Disposition': f'attachment; filename="{download_name}"'},
                )
        except Exception as ff_err:
            print(f"FFmpeg error: {ff_err}")
            filepath.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="Failed to package video stream into MP4.")

    # Direct high-speed download for MP4 video
    filepath = DOWNLOAD_DIR / f"{task_id}.mp4"
    try:
        print(f"[{task_id}] Direct streaming video from: {media_url}")
        r = requests.get(media_url, headers=BROWSER_HEADERS, stream=True, timeout=45)
        r.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in r.iter_content(chunk_size=16384):
                f.write(chunk)

        download_name = f"{title_safe}.mp4"
        return FileResponse(
            path=str(filepath),
            filename=download_name,
            media_type="video/mp4",
            headers={'Content-Disposition': f'attachment; filename="{download_name}"'},
        )
    except Exception as e:
        filepath.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to stream video: {str(e)}")


@app.get("/api/download")
def download_media_get(url: str, quality: str = "best"):
    """GET endpoint to trigger direct browser file save."""
    return download_media(DownloadRequest(url=url, quality=quality))
