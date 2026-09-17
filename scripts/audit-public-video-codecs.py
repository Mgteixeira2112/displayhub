#!/usr/bin/env python3
"""Read-only audit of the five distinct PUBLIC Pexels video URLs found in active posters.

No device, Supabase credential, playlist mutation, transcoding or deployment is involved.
Update the URL fixture after a fresh read-only DB inventory if active posters change.
"""
import json
import os
import struct
import subprocess
import tempfile
from pathlib import Path

VIDEOS = {
    "pexels-10573435": "https://videos.pexels.com/video-files/10573435/10573435-sd_640_338_25fps.mp4",
    "pexels-30748929": "https://videos.pexels.com/video-files/30748929/13153800_640_360_30fps.mp4",
    "pexels-6222569": "https://videos.pexels.com/video-files/6222569/6222569-sd_640_360_24fps.mp4",
    "pexels-7199576": "https://videos.pexels.com/video-files/7199576/7199576-sd_640_360_25fps.mp4",
    "pexels-8530347": "https://videos.pexels.com/video-files/8530347/8530347-sd_640_360_25fps.mp4",
}


def execute(args, timeout=65):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)


def mp4_boxes(filename):
    """Read top-level atom headers only; never read media payload into memory."""
    size = os.stat(filename).st_size
    names = []
    with open(filename, "rb") as stream:
        while stream.tell() + 8 <= size and len(names) < 24:
            header = stream.read(8)
            atom_size, atom_type = struct.unpack(">I4s", header)
            header_size = 8
            if atom_size == 1:
                atom_size = struct.unpack(">Q", stream.read(8))[0]
                header_size = 16
            elif atom_size == 0:
                atom_size = size - (stream.tell() - 8)
            if atom_size < header_size:
                break
            names.append(atom_type.decode("ascii", errors="replace"))
            stream.seek(atom_size - header_size, os.SEEK_CUR)
    return names


def audit(name, url, temp_dir):
    filename = str(Path(temp_dir) / f"{name}.mp4")
    print(f"\n=== {name} ===", flush=True)
    response = execute([
        "curl", "--fail", "--location", "--silent", "--show-error",
        "--connect-timeout", "12", "--max-time", "65", "--max-filesize", "40000000",
        "--retry", "1", "--output", filename,
        "--write-out", "%{http_code} %{content_type} %{size_download}", url,
    ], timeout=150)
    if response.returncode != 0:
        print(f"DOWNLOAD FAILED: {response.stderr.strip()[-400:]} HTTP={response.stdout.strip()}", flush=True)
        return False
    print(f"Download HTTP/type/bytes: {response.stdout.strip()}", flush=True)
    atoms = mp4_boxes(filename)
    print(f"MP4 atoms: {','.join(atoms)}; faststart={'moov' in atoms and 'mdat' in atoms and atoms.index('moov') < atoms.index('mdat')}", flush=True)
    probe = execute([
        "ffprobe", "-v", "error", "-show_entries",
        "format=format_name,duration,size:stream=index,codec_type,codec_name,profile,width,height,pix_fmt,level,avg_frame_rate",
        "-of", "json", filename,
    ], timeout=30)
    if probe.returncode != 0:
        print(f"FFPROBE FAILED: {probe.stderr.strip()[-400:]}", flush=True)
        return False
    metadata = json.loads(probe.stdout)
    print("FFprobe: " + json.dumps(metadata, sort_keys=True, ensure_ascii=False), flush=True)
    video = next((s for s in metadata.get("streams", []) if s.get("codec_type") == "video"), None)
    if not video:
        print("NO VIDEO STREAM", flush=True)
        return False
    decoded = execute([
        "ffmpeg", "-nostdin", "-hide_banner", "-v", "error", "-xerror", "-i", filename,
        "-map", "0:v:0", "-frames:v", "3", "-f", "null", "-",
    ], timeout=40)
    print("Software decode of first three frames: " + ("PASS" if decoded.returncode == 0 else "FAIL " + decoded.stderr.strip()[-400:]), flush=True)
    print("Compatibility note: FFmpeg software decoding never proves Android hardware/WebView decoding.", flush=True)
    return decoded.returncode == 0


def main():
    print("Read-only off-device media inventory: 5 Pexels URLs; no APK, TV, database writes or deploy.", flush=True)
    failures = []
    with tempfile.TemporaryDirectory(prefix="displayhub-media-audit-") as temp_dir:
        for name, url in VIDEOS.items():
            try:
                if not audit(name, url, temp_dir):
                    failures.append(name)
            except (OSError, ValueError, subprocess.TimeoutExpired) as error:
                print(f"AUDIT FAILED for {name}: {type(error).__name__}: {str(error)[-240:]}", flush=True)
                failures.append(name)
    print(f"\nSUMMARY inspected={len(VIDEOS)} failed={len(failures)} IDs={','.join(failures) or 'none'}", flush=True)
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
