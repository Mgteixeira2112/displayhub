#!/usr/bin/env bash
# Off-device compatibility reference only. Does not touch Supabase, public assets or playlists.
set -euo pipefail

source_url='https://videos.pexels.com/video-files/7199576/7199576-sd_640_360_25fps.mp4'
workdir="${RUNNER_TEMP:-/tmp}/displayhub-compatibility"
mkdir -p "$workdir"
input="$workdir/source-high.mp4"
output="$workdir/reference-h264-baseline.mp4"

curl --fail --location --silent --show-error --connect-timeout 12 --max-time 65 --max-filesize 40000000 --output "$input" "$source_url"
printf 'Original:\n'
ffprobe -v error -show_entries stream=codec_type,codec_name,profile,level,width,height,pix_fmt -show_entries format=duration,size -of json "$input"

# The public poster mutes its background video. Generate a video-only baseline sample.
ffmpeg -nostdin -hide_banner -loglevel error -y -i "$input" -map 0:v:0 \
  -c:v libx264 -preset veryfast -crf 23 -profile:v baseline -level:v 3.0 \
  -pix_fmt yuv420p -movflags +faststart -an "$output"

printf '\nCompatibility reference:\n'
ffprobe -v error -show_entries stream=codec_type,codec_name,profile,level,width,height,pix_fmt -show_entries format=duration,size -of json "$output"

python3 - "$output" <<'PY'
import json, pathlib, struct, subprocess, sys
path = pathlib.Path(sys.argv[1])
data = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(path)], text=True))
streams = data['streams']
assert len(streams) == 1, f'Expected only video stream; got {len(streams)}'
s = streams[0]
assert s['codec_name'] == 'h264', s
assert s['profile'] in ('Constrained Baseline', 'Baseline'), s
assert int(s['level']) <= 30, s
assert s['pix_fmt'] == 'yuv420p', s
atoms = []
with path.open('rb') as f:
    while f.tell() + 8 <= path.stat().st_size and len(atoms) < 20:
        size, name = struct.unpack('>I4s', f.read(8))
        header = 8
        if size == 1:
            size = struct.unpack('>Q', f.read(8))[0]
            header = 16
        if size < header: raise ValueError('Malformed MP4 atom')
        atoms.append(name.decode('ascii'))
        f.seek(size - header, 1)
assert 'moov' in atoms and 'mdat' in atoms and atoms.index('moov') < atoms.index('mdat'), atoms
print('Validated: H264 Baseline <= level 3.0, yuv420p, single video stream and moov before mdat')
PY
ffmpeg -nostdin -hide_banner -v error -xerror -i "$output" -map 0:v:0 -frames:v 3 -f null -
printf 'Reference first three frames decode: PASS\n'
# Only the small reference is uploaded to GitHub Actions; the original stays ephemeral.
mkdir -p "$PWD/video-compatibility-artifact"
cp "$output" "$PWD/video-compatibility-artifact/reference-h264-baseline.mp4"
