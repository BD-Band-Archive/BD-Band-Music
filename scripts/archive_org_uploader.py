#!/usr/bin/env python3
"""
Archive.org Batch Album Uploader for BD Band Music Archive
Automatically uploads music albums directly to Internet Archive (archive.org)
ignoring git artifacts, temp files, and non-media assets.
"""

import os
import sys
import re
import json
import argparse
import time
from typing import Dict, List, Optional

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

try:
    import internetarchive as ia
except ImportError:
    print("Error: 'internetarchive' package is not installed. Run: pip install internetarchive")
    sys.exit(1)

# Default S3 Credentials for Archive.org
DEFAULT_ACCESS_KEY = 'cO6yr0Nj4dZ9X1Nh'
DEFAULT_SECRET_KEY = 'RaZJrZXTB1UWj5eK'

# Base paths
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CATALOG_PATH = os.path.join(ROOT_DIR, 'BD Band Music', 'catalog.json')
LOG_PATH = os.path.join(ROOT_DIR, 'BD Band Music', 'archive_upload_log.json')

AUDIO_EXTS = {'.flac', '.mp3', '.wav', '.m4a', '.ogg', '.opus', '.aac'}
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp'}
TEXT_EXTS = {'.txt'}

def clean_identifier(artist: str, album: str, year: Optional[int]) -> str:
    """Generate a clean, valid Archive.org identifier slug."""
    raw = f"{artist}_{album}"
    if year:
        raw += f"_{year}"
    # Replace anything non-alphanumeric/hyphen/underscore with underscore
    slug = re.sub(r'[^a-zA-Z0-9_\-]+', '_', raw)
    slug = re.sub(r'_+', '_', slug).strip('_')
    return slug

def load_catalog_meta() -> Dict[tuple, dict]:
    """Load metadata from catalog.json for year/artist lookup."""
    meta = {}
    if os.path.exists(CATALOG_PATH):
        try:
            with open(CATALOG_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for track in data:
                repo = track.get('repo')
                album = track.get('album')
                key = (repo, album)
                if key not in meta:
                    meta[key] = {
                        'year': track.get('year'),
                        'artist': track.get('artist'),
                        'album': album
                    }
        except Exception as e:
            print(f"Warning: Failed to load catalog.json: {e}")
    return meta

def scan_all_albums(music_dir: str) -> List[dict]:
    """Scan all artist folders in music_dir for albums, ignoring .git and junk."""
    catalog_meta = load_catalog_meta()
    repos = [
        d for d in os.listdir(music_dir)
        if os.path.isdir(os.path.join(music_dir, d))
        and not d.startswith('.')
        and d not in ('BD Band Music', '__pycache__', 'node_modules')
    ]
    
    albums = []

    for repo in sorted(repos):
        repo_path = os.path.join(music_dir, repo)
        for entry in os.listdir(repo_path):
            entry_path = os.path.join(repo_path, entry)
            if not os.path.isdir(entry_path) or entry.startswith('.') or entry in ('assets', 'scripts'):
                continue

            album_dir_name = entry
            audio_files = []
            cover_files = []
            text_files = []
            total_bytes = 0

            for root, dirs, files in os.walk(entry_path):
                # Never descend into .git or hidden dirs
                dirs[:] = [d for d in dirs if not d.startswith('.')]
                for f in files:
                    if f.startswith('.'):
                        continue
                    ext = os.path.splitext(f)[1].lower()
                    full_path = os.path.join(root, f)
                    # Archive remote relative path: e.g. "Harano Podochchap (2006)/01. Song.flac"
                    rel_path = os.path.relpath(full_path, repo_path).replace('\\', '/')
                    
                    try:
                        f_size = os.path.getsize(full_path)
                    except Exception:
                        f_size = 0

                    if ext in AUDIO_EXTS:
                        audio_files.append((rel_path, full_path, f_size))
                        total_bytes += f_size
                    elif ext in IMAGE_EXTS:
                        cover_files.append((rel_path, full_path, f_size))
                        total_bytes += f_size
                    elif ext in TEXT_EXTS:
                        text_files.append((rel_path, full_path, f_size))
                        total_bytes += f_size

            if not audio_files:
                continue

            # Parse year from folder name e.g. "(2006)"
            year_match = re.search(r'\((\d{4})\)', album_dir_name)
            year = int(year_match.group(1)) if year_match else None
            
            clean_album = re.sub(r'\s*\(\d{4}\)', '', album_dir_name).strip()
            artist = repo if repo != 'Mixed Albums' else 'Various Artists'

            # Try to enrich year from catalog if missing
            if not year:
                meta = catalog_meta.get((repo, album_dir_name)) or catalog_meta.get((repo, clean_album))
                if meta and meta.get('year'):
                    year = meta['year']

            # Specific override for known Disciples album matching user screenshot
            if repo == 'Disciples' and 'Harano Podochchap' in clean_album:
                identifier = 'Disciples_Harano_Podochchap_2006'
            else:
                identifier = clean_identifier(artist, clean_album, year)

            title_year = f" ({year})" if year else ""
            title = f"{artist} - {clean_album}{title_year}"

            all_files = audio_files + cover_files + text_files

            albums.append({
                'repo': repo,
                'artist': artist,
                'album_dir': album_dir_name,
                'clean_album': clean_album,
                'year': year,
                'identifier': identifier,
                'title': title,
                'audio_count': len(audio_files),
                'cover_count': len(cover_files),
                'text_count': len(text_files),
                'total_bytes': total_bytes,
                'files': all_files
            })

    return albums

def load_upload_log() -> Dict[str, dict]:
    """Load previously uploaded albums log."""
    if os.path.exists(LOG_PATH):
        try:
            with open(LOG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_upload_log(log_data: dict):
    """Save upload log."""
    try:
        with open(LOG_PATH, 'w', encoding='utf-8') as f:
            json.dump(log_data, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save upload log: {e}")

def upload_album(album_info: dict, session: ia.ArchiveSession, retries: int = 5) -> bool:
    """Upload a single album to Archive.org."""
    ident = album_info['identifier']
    title = album_info['title']
    artist = album_info['artist']
    year = album_info['year']
    
    # Map local files into Archive.org dictionary: { 'remote_path': 'local_full_path' }
    files_dict = {
        rel: full for rel, full, _ in album_info['files']
    }

    # Prepare metadata matching Archive.org Open Audio schema
    metadata = {
        'title': title,
        'creator': artist,
        'mediatype': 'audio',
        'collection': 'opensource_audio',  # Archive.org "Community audio" collection identifier
        'language': 'ben',
        'subject': 'Rock; Hiphop; Music; Bangla; Bengali; Band; Metal',
        'description': f"Classic Bengali musical album by {artist}. Released in {year or 'Unknown'}. Preserved for non-commercial archival listening.",
        'licenseurl': ''  # Leave blank: All copyrights remain with respective artists
    }
    if year:
        metadata['date'] = str(year)

    print(f"\n=======================================================")
    print(f"Uploading Album: {title}")
    print(f"Identifier:      https://archive.org/details/{ident}")
    print(f"Files:           {len(files_dict)} total ({album_info['audio_count']} tracks, {album_info['cover_count']} covers)")
    print(f"Total Size:      {album_info['total_bytes'] / (1024*1024):.2f} MB")
    print(f"=======================================================")

    for attempt in range(1, retries + 1):
        try:
            item = session.get_item(ident)
            
            # If item already exists, only upload files not yet present on Archive.org
            if item.exists and item.files:
                existing_names = {f['name'] for f in item.files}
                files_to_upload = {
                    rel: full for rel, full in files_dict.items()
                    if rel not in existing_names
                }
            else:
                files_to_upload = files_dict

            if not files_to_upload:
                print(f"[✓] All {len(files_dict)} files already exist on Archive.org: https://archive.org/details/{ident}")
                return True

            if len(files_to_upload) < len(files_dict):
                print(f"[*] Uploading {len(files_to_upload)} missing file(s) ({len(files_dict) - len(files_to_upload)} already archived)...")

            # When item exists, do not send metadata containing 'collection'
            # to avoid S3 403 "You lack sufficient privileges to write to those collections"
            upload_meta = metadata if not item.exists else None

            responses = item.upload(
                files=files_to_upload,
                metadata=upload_meta,
                verbose=True,
                queue_derive=False,
                retries=10,
                retries_sleep=20,
                checksum=True,
                request_kwargs={'timeout': 300}
            )
            print(f"Successfully uploaded: https://archive.org/details/{ident}")
            return True
        except Exception as e:
            print(f"[!] Error on attempt {attempt}/{retries}: {e}")
            if attempt < retries:
                time.sleep(10 * attempt)
            else:
                print(f"[X] Failed to upload {ident} after {retries} attempts.")
                return False
    return False

def main():
    parser = argparse.ArgumentParser(description="Archive.org Batch Album Uploader for BD Band Music Archive")
    parser.add_argument('--dry-run', action='store_true', help="Preview all albums and metadata without uploading")
    parser.add_argument('--artist', type=str, help="Upload only albums by this artist (case-insensitive)")
    parser.add_argument('--album', type=str, help="Upload only this specific album name")
    parser.add_argument('--limit', type=int, default=0, help="Limit number of albums to upload")
    parser.add_argument('--skip-existing', action='store_true', default=True, help="Skip albums already uploaded or present in log")
    parser.add_argument('--force', action='store_true', help="Re-upload even if already logged")
    args = parser.parse_args()

    music_dir = ROOT_DIR
    print(f"[*] Scanning albums in {music_dir}...")
    albums = scan_all_albums(music_dir)
    print(f"[*] Total albums found: {len(albums)}")

    # Filtering
    if args.artist:
        albums = [a for a in albums if args.artist.lower() in a['artist'].lower() or args.artist.lower() in a['repo'].lower()]
        print(f"[*] Filtered by artist '{args.artist}': {len(albums)} albums")

    if args.album:
        albums = [a for a in albums if args.album.lower() in a['clean_album'].lower() or args.album.lower() in a['album_dir'].lower()]
        print(f"[*] Filtered by album '{args.album}': {len(albums)} albums")

    if args.limit > 0:
        albums = albums[:args.limit]
        print(f"[*] Limited to {args.limit} album(s)")

    if not albums:
        print("No albums matched the specified criteria.")
        return

    # Total stats
    total_size = sum(a['total_bytes'] for a in albums)
    total_tracks = sum(a['audio_count'] for a in albums)
    print(f"[*] Target: {len(albums)} albums, {total_tracks} tracks, {total_size / (1024**3):.2f} GB total")

    if args.dry_run:
        print("\n--- DRY RUN PREVIEW ---")
        for i, a in enumerate(albums, 1):
            print(f"{i:3d}. {a['title']}")
            print(f"     Identifier: https://archive.org/details/{a['identifier']}")
            print(f"     Tracks: {a['audio_count']}, Covers: {a['cover_count']}, Size: {a['total_bytes']/(1024*1024):.1f} MB")
            print(f"     Sample file: {a['files'][0][0]}")
        print("\n[✓] Dry run complete. Run without --dry-run to start upload.")
        return

    # Initialize Archive.org session
    session = ia.get_session(config={
        's3': {
            'access': DEFAULT_ACCESS_KEY,
            'secret': DEFAULT_SECRET_KEY
        }
    })

    upload_log = load_upload_log()
    success_count = 0
    fail_count = 0
    skipped_count = 0

    for idx, album in enumerate(albums, 1):
        ident = album['identifier']
        
        # Check local log or Archive.org existence
        if not args.force and args.skip_existing:
            if ident in upload_log and upload_log[ident].get('status') == 'success':
                print(f"[{idx}/{len(albums)}] Skipping already logged album: {album['title']}")
                skipped_count += 1
                continue
            
            # Check online item
            try:
                remote_item = session.get_item(ident)
                if remote_item.exists and len(remote_item.files) >= album['audio_count']:
                    print(f"[{idx}/{len(albums)}] Already exists on Archive.org ({len(remote_item.files)} files): {ident}")
                    upload_log[ident] = {
                        'status': 'success',
                        'title': album['title'],
                        'url': f"https://archive.org/details/{ident}",
                        'uploaded_at': time.strftime('%Y-%m-%d %H:%M:%S')
                    }
                    save_upload_log(upload_log)
                    skipped_count += 1
                    continue
            except Exception:
                pass

        print(f"\n[{idx}/{len(albums)}] Starting upload for: {album['title']}")
        success = upload_album(album, session)
        if success:
            success_count += 1
            upload_log[ident] = {
                'status': 'success',
                'title': album['title'],
                'url': f"https://archive.org/details/{ident}",
                'uploaded_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            save_upload_log(upload_log)
        else:
            fail_count += 1
            upload_log[ident] = {
                'status': 'failed',
                'title': album['title'],
                'attempted_at': time.strftime('%Y-%m-%d %H:%M:%S')
            }
            save_upload_log(upload_log)

    print("\n=======================================================")
    print("BATCH UPLOAD SUMMARY")
    print(f"Total Albums: {len(albums)}")
    print(f"Uploaded:     {success_count}")
    print(f"Skipped:      {skipped_count}")
    print(f"Failed:       {fail_count}")
    print(f"Log File:     {LOG_PATH}")
    print("=======================================================")

if __name__ == '__main__':
    main()
