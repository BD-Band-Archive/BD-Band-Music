#!/usr/bin/env python3
"""
BD Band Music - Catalog Builder
================================
Crawls all Bangladeshi Band Music repositories, parses verified README.md
metadata, extracts tracklists, covers, release years, audio formats,
and direct Git LFS streaming URLs, and exports a unified catalog.json.
"""

import os
import re
import sys
import json
import urllib.parse
from pathlib import Path
from collections import Counter

sys.stdout.reconfigure(encoding='utf-8')

MUSIC_DIR = Path("D:/Music")
OUTPUT_DIR = MUSIC_DIR / "BD Band Music"

EXCLUDE_DIRS = {
    "BD Band Music",
    "Yani Neko",
    "Mindhunter.S01-S02.1080p.NF.WEBRip.AAC.5.1.x265-ALiEN",
    "Music",
    "__pycache__",
    ".git",
    "assets"
}

FOLDER_MAP = {
    'Mixed-Albums': 'Mixed Albums',
    'BD-Band-Music': 'BD Band Music',
    'Stoic-Bliss': 'Stoic Bliss',
    'The-Watson-Brothers': 'The Watson Brothers',
    'Bassbaba-Sumon': 'Bassbaba Sumon'
}

def discover_repos():
    r"""Dynamically discovers all music and band repositories in D:\Music."""
    priority_bands = [
        "Arbovirus", "Artcell", "Aurthohin", "Bassbaba Sumon", "Black",
        "Cryptic Fate", "Icons", "Indalo", "Minerva", "Stoic Bliss", "The Watson Brothers", "Vibe"
    ]
    repos = []
    
    # 1. First add priority bands if they exist
    for band in priority_bands:
        p = MUSIC_DIR / band
        if p.is_dir() and (p / "README.md").exists():
            slug = band.replace(" ", "-")
            repos.append((band, slug))
            FOLDER_MAP[slug] = band
            FOLDER_MAP[band] = band

    # 2. Automatically discover any other band/artist repositories
    for p in sorted(MUSIC_DIR.iterdir()):
        if not p.is_dir() or p.name in EXCLUDE_DIRS or p.name in priority_bands or p.name == "Mixed Albums" or p.name.startswith("."):
            continue
        readme = p / "README.md"
        if readme.exists():
            slug = p.name.replace(" ", "-")
            repos.append((p.name, slug))
            FOLDER_MAP[slug] = p.name
            FOLDER_MAP[p.name] = p.name

    # 3. Always append Mixed Albums at the end
    mixed_dir = MUSIC_DIR / "Mixed Albums"
    if mixed_dir.is_dir() and (mixed_dir / "README.md").exists():
        repos.append(("Mixed Albums", "Mixed-Albums"))
        FOLDER_MAP["Mixed-Albums"] = "Mixed Albums"
        FOLDER_MAP["Mixed Albums"] = "Mixed Albums"

    return repos

CANONICAL_ARTIST_MAP = {
    "král": "Kral",
    "kral": "Kral",
    "metal maze": "Metal Maze",
    "the icons": "Icons",
    "icons": "Icons",
    "power surge": "Powersurge",
    "powersurge": "Powersurge",
    "x-factor": "X Factor",
    "x factor": "X Factor",
    "fake plastic super heroes": "Fake Plastic Superheroes",
    "fake plastic superheroes": "Fake Plastic Superheroes",
    "high-way": "Highway",
    "high way": "Highway",
    "highway": "Highway",
    "purbo-poshchim": "Purbo Poshchim",
    "purbo poshchim": "Purbo Poshchim",
    "sucide season": "Suicide Season",
    "suicide season": "Suicide Season",
    "koprofillia": "Coprophilia",
    "coprophilia": "Coprophilia",
    "aronnya": "Aronno",
    "aronno": "Aronno",
    "darks": "Dark",
    "dark": "Dark",
    "bishop fuad": "Fuad",
    "artcell": "Artcell",
    "stentorian feat. bassbaba sumon": "Stentorian",
    "bassbaba sumon & anila naz chowdhury": "Bassbaba Sumon",
}

MULTI_ARTIST_MAP = {
    "artcell, black & cryptic fate": ["Artcell", "Black", "Cryptic Fate"],
    "lamia, shaheen, johan shihab": ["Lamia", "Shaheen", "Johan", "Shihab"],
    "johan, fuad shanto": ["Johan", "Fuad", "Shanto"],
    "bassbaba sumon feat. arbovirus": ["Bassbaba Sumon", "Arbovirus"],
    "stentorian feat. bassbaba sumon": ["Stentorian", "Bassbaba Sumon"],
}

def clean_track(raw_title, default_artist, is_mixed=False):
    raw = raw_title.strip()
    
    # Match leading track numbers like "01 - ", "01. ", "01 "
    m_num = re.match(r'^(\d+)[\.\s\-]+(.*)$', raw)
    if m_num:
        num_str = m_num.group(1)
        rest = m_num.group(2).strip()
        if is_mixed:
            if " - " in rest:
                p1, p2 = rest.split(" - ", 1)
                artist = p1.strip()
                title = p2.strip()
            else:
                artist = default_artist
                title = rest
        else:
            artist = default_artist
            title = rest
    else:
        if is_mixed and " - " in raw:
            p1, p2 = raw.split(" - ", 1)
            artist = p1.strip()
            title = p2.strip()
        else:
            artist = default_artist
            title = raw

    # Exception for band named "666" in Agontuk 3
    if artist != "666" and artist.isdigit():
        artist = default_artist
        
    # Remove redundant artist prefixes/suffixes in track title
    if title.startswith(f"{artist} - "):
        title = title[len(artist)+3:].strip()
    if title.endswith(f" - {artist}"):
        title = title[:-len(artist)-3].strip()

    # Canonical artist normalization to prevent duplicate artist cards
    art_lower = artist.lower().strip()
    feat_from_artist = None
    if art_lower == "stentorian feat. bassbaba sumon":
        artist = "Stentorian"
        feat_from_artist = "Bassbaba Sumon"
    elif art_lower == "bishop fuad":
        artist = "Fuad"
        feat_from_artist = "Bishop"
    elif art_lower == "bassbaba sumon & anila naz chowdhury":
        artist = "Bassbaba Sumon"
        feat_from_artist = "Anila Naz Chowdhury"
    elif art_lower in CANONICAL_ARTIST_MAP:
        artist = CANONICAL_ARTIST_MAP[art_lower]

    # Special track title cleaning and multi-artist resolution
    if title.lower().startswith("bassbaba sumon feat. arbovirus - "):
        artist = "Bassbaba Sumon"
        feat_from_artist = "Arbovirus"
        title = "Shohor"
        artists_list = ["Bassbaba Sumon", "Arbovirus"]
    elif "neel paharer gaaye (feat. zahed &" in title.lower():
        title = "Neel Paharer Gaaye (feat. Zahed & Rafa)"
        feat_from_artist = "Zahed & Rafa"
        artists_list = [artist]
    elif art_lower in MULTI_ARTIST_MAP:
        artists_list = list(MULTI_ARTIST_MAP[art_lower])
    else:
        artists_list = [artist]
        
    return artist, title, feat_from_artist, artists_list

def get_local_repo_dir(repo):
    if repo in FOLDER_MAP:
        return MUSIC_DIR / FOLDER_MAP[repo]
    if (MUSIC_DIR / repo).exists():
        return MUSIC_DIR / repo
    rep_space = repo.replace('-', ' ')
    if (MUSIC_DIR / rep_space).exists():
        return MUSIC_DIR / rep_space
    return MUSIC_DIR / repo

def get_exact_album_cover(stream_url):
    """Directly inspect filesystem for the album's cover based on the stream URL."""
    m = re.match(r'https://media\.githubusercontent\.com/media/GhostDog45/([^/]+)/master/([^/]+)/', stream_url)
    repo = None
    target_dir = None
    album_folder = None
    
    if m:
        repo = m.group(1)
        album_folder = urllib.parse.unquote(m.group(2))
        repo_dir = get_local_repo_dir(repo)
        target_dir = repo_dir / album_folder
    else:
        m_root = re.match(r'https://media\.githubusercontent\.com/media/GhostDog45/([^/]+)/master/([^/]+)$', stream_url)
        if m_root:
            repo = m_root.group(1)
            repo_dir = get_local_repo_dir(repo)
            target_dir = repo_dir
            album_folder = ""
        else:
            return ''

    if not target_dir or not target_dir.exists():
        return ''
        
    for cov_name in ['Album Cover', 'Album Covers']:
        cov_dir = target_dir / cov_name
        if cov_dir.exists():
            files = [f for f in cov_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
            if files:
                front = next((f for f in files if 'front' in f.name.lower() or 'artwork' in f.name.lower()), files[0])
                enc_cov = urllib.parse.quote(cov_name)
                enc_file = urllib.parse.quote(front.name)
                if album_folder:
                    enc_alb = urllib.parse.quote(album_folder)
                    return f'https://raw.githubusercontent.com/GhostDog45/{repo}/master/{enc_alb}/{enc_cov}/{enc_file}'
                else:
                    return f'https://raw.githubusercontent.com/GhostDog45/{repo}/master/{enc_cov}/{enc_file}'
                
    return ''

def get_all_album_covers(stream_url):
    """Directly inspect filesystem for all album covers and booklet scans based on stream URL."""
    m = re.match(r'https://media\.githubusercontent\.com/media/GhostDog45/([^/]+)/master/([^/]+)/', stream_url)
    repo = None
    target_dir = None
    album_folder = None
    
    if m:
        repo = m.group(1)
        album_folder = urllib.parse.unquote(m.group(2))
        repo_dir = get_local_repo_dir(repo)
        target_dir = repo_dir / album_folder
    else:
        m_root = re.match(r'https://media\.githubusercontent\.com/media/GhostDog45/([^/]+)/master/([^/]+)$', stream_url)
        if m_root:
            repo = m_root.group(1)
            repo_dir = get_local_repo_dir(repo)
            target_dir = repo_dir
            album_folder = ""
        else:
            return []

    if not target_dir or not target_dir.exists():
        return []
        
    covers = []
    for cov_name in ['Album Cover', 'Album Covers']:
        cov_dir = target_dir / cov_name
        if cov_dir.exists():
            files = [f for f in cov_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
            def sort_key(f):
                n = f.name.lower()
                if 'front' in n or 'artwork' in n:
                    return (1, n)
                elif 'booklet' in n or 'lyrics' in n:
                    return (2, n)
                elif 'inlay' in n or 'inset' in n or 'inlet' in n:
                    return (3, n)
                elif 'cd' in n or 'disc' in n:
                    return (4, n)
                elif 'back' in n:
                    return (5, n)
                elif 'poster' in n:
                    return (6, n)
                return (7, n)

            files.sort(key=sort_key)
            for f in files:
                enc_cov = urllib.parse.quote(cov_name)
                enc_file = urllib.parse.quote(f.name)
                if album_folder:
                    enc_alb = urllib.parse.quote(album_folder)
                    raw_url = f'https://raw.githubusercontent.com/GhostDog45/{repo}/master/{enc_alb}/{enc_cov}/{enc_file}'
                else:
                    raw_url = f'https://raw.githubusercontent.com/GhostDog45/{repo}/master/{enc_cov}/{enc_file}'
                
                clean_name = f.stem
                m_tag = re.search(r'\[([^\]]+)\]', clean_name)
                tag_name = m_tag.group(1).strip() if m_tag else clean_name.strip()
                
                covers.append({
                    "title": tag_name,
                    "filename": f.name,
                    "url": raw_url
                })
    return covers

def build_catalog():
    catalog = []
    seen_urls = set()
    album_covers_map = {}
    repos = discover_repos()
    print(f"[*] Discovered {len(repos)} repositories to process.")
    
    for folder_name, repo_name in repos:
        readme_path = MUSIC_DIR / folder_name / "README.md"
        repo_dir = MUSIC_DIR / folder_name
        if not readme_path.exists():
            print(f"Skipping {folder_name}: README.md not found")
            continue
            
        print(f"Parsing {folder_name}...")
        with open(readme_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        current_album = "Unknown Album"
        current_year = None
        current_cover = ""
        is_mixed_section = (folder_name == "Mixed Albums")
        current_artist = folder_name if folder_name != "Mixed Albums" else "Various Artists"
        lossy_note = False
        album_track_counter = 0
        
        for line in lines:
            line_str = line.strip()
            
            # Check H2 album headers:
            m_head = re.match(r'^##\s+(?:\[?\d+[\.\)]?\s*)?([^#\n]+)', line_str)
            if m_head:
                header_text = m_head.group(1).strip()
                
                # Filter out standard non-album section headers
                lower_head = header_text.lower()
                if any(skip_term in lower_head for skip_term in [
                    "about the band", "about the artist", "discography index",
                    "discography", "studio albums", "compilation", "git lfs",
                    "special thanks", "acknowledgements"
                ]):
                    continue

                album_track_counter = 0
                
                # Is this header pointing to Mixed Albums?
                if "Mixed-Albums" in line_str or folder_name == "Mixed Albums":
                    is_mixed_section = True
                else:
                    is_mixed_section = False
                    
                m_link = re.match(r'\[([^\]]+)\]', header_text)
                if m_link:
                    header_text = m_link.group(1)
                
                m_year = re.search(r'\((\d{4})\)', header_text)
                if m_year:
                    current_year = int(m_year.group(1))
                    clean_album = re.sub(r'\s*\(\d{4}\)', '', header_text).strip()
                else:
                    clean_album = header_text
                
                current_album = clean_album
                current_cover = ""
                lossy_note = "16 cut - Lossy version" in header_text or "Lossy" in header_text
                
                if folder_name != "Mixed Albums":
                    if "Bassbaba Sumon" in current_album or "Sumon" in current_album or folder_name == "Bassbaba Sumon":
                        current_artist = "Bassbaba Sumon"
                    else:
                        current_artist = folder_name
            
            # Release Year metadata
            m_yr = re.search(r'\*\*Release Year:\*\*\s*(\d{4})', line_str)
            if m_yr:
                current_year = int(m_yr.group(1))
                
            # Band / Artist metadata
            m_art = re.search(r'\*\*(?:Band|Artist|Artists):\*\*\s*([^\n\r]+)', line_str)
            if m_art:
                meta_art = m_art.group(1).strip()
                meta_art = re.sub(r'\(.*?\)', '', meta_art).strip()
                if meta_art and folder_name != "Mixed Albums":
                    current_artist = meta_art
                    
            # Lossy note
            if "16 kHz shelf cutoff lossy" in line_str or "16 cut - Lossy version" in line_str:
                lossy_note = True
                
            # Cover image in markdown
            m_img = re.search(r'<img\s+[^>]*src="([^"]+)"', line_str)
            if m_img:
                img_src = m_img.group(1).strip()
                if "img.shields.io" not in img_src and "band_cover" not in img_src and "assets/band_cover" not in img_src:
                    if not img_src.startswith("http"):
                        unquoted = urllib.parse.unquote(img_src.replace("\\", "/"))
                        encoded_path = "/".join(urllib.parse.quote(seg) for seg in unquoted.split("/"))
                        img_src = f"https://raw.githubusercontent.com/GhostDog45/{repo_name}/master/{encoded_path}"
                    else:
                        unquoted = urllib.parse.unquote(img_src)
                        parts = unquoted.split("://", 1)
                        if len(parts) == 2:
                            proto = parts[0]
                            path_parts = parts[1].split("/")
                            host = path_parts[0]
                            rest = "/".join(urllib.parse.quote(seg) for seg in path_parts[1:])
                            img_src = f"{proto}://{host}/{rest}"
                    if not current_cover:
                        current_cover = img_src
                    
            # Track link
            m_trk = re.search(r'-\s+\[\*\*([^*]+)\*\*\]\((https://media\.githubusercontent\.com/media/[^)]+)\)', line_str)
            if m_trk:
                raw_title = m_trk.group(1).strip()
                url = m_trk.group(2).strip()
                
                clean_url = url.split("?")[0]
                if clean_url in seen_urls:
                    continue
                seen_urls.add(clean_url)
                
                album_track_counter += 1
                is_mixed = (folder_name == "Mixed Albums") or is_mixed_section
                
                # Determine artist and track name
                effective_artist = current_artist
                track_artist, track_title, feat_from_artist, track_artists = clean_track(raw_title, effective_artist, is_mixed=is_mixed)
                
                # Check for featured artist
                feat = feat_from_artist
                if not feat:
                    m_feat = re.search(r'\((?:feat|ft)\.?\s*([^)]+)\)', track_title, re.IGNORECASE)
                    if not m_feat:
                        m_feat = re.search(r'-(?:feat|ft)\.?\s*([^-]+)', track_title, re.IGNORECASE)
                    if m_feat:
                        feat = m_feat.group(1).strip()
                    
                track_album = current_album
                track_year = current_year
                
                # If current_album is Unknown Album or generic, extract album subfolder from stream URL
                m_subfolder = re.match(r'https://media\.githubusercontent\.com/media/GhostDog45/[^/]+/master/([^/]+)/', clean_url)
                if m_subfolder:
                    folder_in_url = urllib.parse.unquote(m_subfolder.group(1)).strip()
                    if folder_in_url and not folder_in_url.lower().endswith(('.flac', '.wav', '.mp3', '.m4a')):
                        if track_album == "Unknown Album" or "about the band" in track_album.lower():
                            m_y = re.search(r'\((\d{4})\)', folder_in_url)
                            if m_y:
                                track_year = int(m_y.group(1))
                                track_album = re.sub(r'\s*\(\d{4}\)', '', folder_in_url).strip()
                            else:
                                track_album = folder_in_url

                # High-precision cover resolution:
                # 1. Exact album cover deduced from streamUrl
                # 2. Markdown cover if valid
                # 3. Fallback
                track_cover = get_exact_album_cover(url) or current_cover
                
                # Dynamically collect all physical album covers/booklets for this album
                if track_album not in album_covers_map:
                    covs = get_all_album_covers(clean_url)
                    if covs:
                        album_covers_map[track_album] = covs
                
                track_id = f"track-{len(catalog)+1}"
                
                catalog.append({
                    "id": track_id,
                    "title": track_title,
                    "artist": track_artist,
                    "artists": track_artists,
                    "featured": feat,
                    "album": track_album,
                    "year": track_year,
                    "trackNo": album_track_counter,
                    "streamUrl": clean_url,
                    "downloadUrl": f"{clean_url}?download=true",
                    "coverUrl": track_cover,
                    "repo": repo_name,
                    "isLossyTranscode": lossy_note
                })
                
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_json = OUTPUT_DIR / "catalog.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        
    print(f"\n Successfully wrote {len(catalog)} tracks to {out_json}!")
    
    # Export dynamic album covers and booklets map for album page gallery
    out_covers = OUTPUT_DIR / "assets" / "album_covers.json"
    out_covers.parent.mkdir(parents=True, exist_ok=True)
    with open(out_covers, "w", encoding="utf-8") as f:
        json.dump(album_covers_map, f, ensure_ascii=False, indent=2)
    print(f" Successfully exported {len(album_covers_map)} album galleries to {out_covers}!")
    
    # Automatically map artist images from assets/artists/
    build_artists_map(catalog)
    
    # Update BD Band Music README with live track count badge and text
    readme_path = OUTPUT_DIR / "README.md"
    if readme_path.exists():
        readme_text = readme_path.read_text(encoding="utf-8")
        updated_text = re.sub(r'Catalog-\d+%20FLAC%20Tracks', f'Catalog-{len(catalog)}%20FLAC%20Tracks', readme_text)
        updated_text = re.sub(r'\*\*\d+\s+lossless\s+FLAC\s+tracks\*\*', f'**{len(catalog)} lossless FLAC tracks**', updated_text)
        if updated_text != readme_text:
            readme_path.write_text(updated_text, encoding="utf-8")
            print(f" Updated README.md badge and count to {len(catalog)} tracks.")
    
    # Print summary statistics
    artists = Counter(t['artist'] for t in catalog)
    albums = len(set(t['album'] for t in catalog))
    print(f" Total Unique Artists: {len(artists)}")
    print(f" Total Albums/Compilations: {albums}")
    print("\nTop 15 Artists:")
    for a, count in artists.most_common(15):
        print(f"  • {a}: {count} tracks")

def build_artists_map(catalog):
    """Scans assets/artists directory and matches images to artists in catalog, exporting artists_map.json."""
    artists_dir = OUTPUT_DIR / "assets" / "artists"
    if not artists_dir.exists():
        return {}
    
    all_artists = set()
    for t in catalog:
        for a in t.get('artists', [t['artist']]):
            all_artists.add(a)
    all_artists = sorted(list(all_artists))
    img_files = [f for f in artists_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
    
    def normalize_slug(s):
        return re.sub(r'[\s_\-\W]+', '', s.lower())

    file_map = {}
    for f in img_files:
        stem = f.stem.lower()
        clean_stem = re.sub(r'jpg$', '', stem)
        clean_stem = re.sub(r'_logo$', '', clean_stem)
        rel_path = f"assets/artists/{f.name}"
        file_map[normalize_slug(clean_stem)] = rel_path
        file_map[normalize_slug(stem)] = rel_path

    alias_map = {
        normalize_slug('durey'): normalize_slug('duray'),
        normalize_slug('mohakaal'): normalize_slug('mohakal'),
        normalize_slug('the icons'): normalize_slug('icons'),
        normalize_slug('bassbaba sumon & anila naz chowdhury'): normalize_slug('bassbaba_sumon'),
        normalize_slug('stentorian feat. bassbaba sumon'): normalize_slug('stentorian'),
        normalize_slug('bishop fuad'): normalize_slug('fuad'),
        normalize_slug('power surge'): normalize_slug('powersurge')
    }

    artist_images = {}
    seen_norm = set()
    for art in all_artists:
        norm_art = normalize_slug(art)
        if norm_art in seen_norm:
            continue
        target_key = alias_map.get(norm_art, norm_art)
        if target_key in file_map:
            artist_images[art] = file_map[target_key]
            seen_norm.add(norm_art)

    out_map_file = artists_dir / "artists_map.json"
    with open(out_map_file, "w", encoding="utf-8") as f:
        json.dump(artist_images, f, ensure_ascii=False, indent=2)

    print(f"[*] Generated artists_map.json with {len(artist_images)} artist images mapped.")
    return artist_images

if __name__ == "__main__":
    build_catalog()
