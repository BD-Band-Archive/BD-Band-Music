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
import html
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
    'Bassbaba-Sumon': 'Bassbaba Sumon',
    'Ayub-Bachchu': 'Ayub Bachchu'
}

def discover_repos():
    r"""Dynamically discovers all music and band repositories in D:\Music."""
    priority_bands = [
        "Aftermath", "Arbovirus", "Arnob", "Artcell", "Aurthohin", "Ayub Bachchu", "Bassbaba Sumon", "Black",
        "Cryptic Fate", "Icons", "Indalo", "LRB", "Minerva", "Stoic Bliss", "The Watson Brothers", "Vibe", "Warfaze"
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
    "koprophillia": "Coprophilia",
    "coprophilia": "Coprophilia",
    "aronnya": "Aronno",
    "aronno": "Aronno",
    "darks": "Dark",
    "dark": "Dark",
    "bishop fuad": "Fuad",
    "artcell": "Artcell",
    "stentorian feat. bassbaba sumon": "Stentorian",
    "reborn": "ReBORN",
    "anything but six": "Anything But Six",
    "fulbanuz revenge": "Fulbanu's Revenge",
    "fulbanu's revenge": "Fulbanu's Revenge",
    "srishty": "Srishti",
    "srishti": "Srishti",
    "hammer head": "Hammerhead",
    "hammerhead": "Hammerhead",
    "aftermath": "Aftermath",
    "arnob": "Arnob",
    "arnob & friends": "Arnob",
    "ayub bachchu": "Ayub Bachchu",
    "ayub bacchu": "Ayub Bachchu",
    "ab": "Ayub Bachchu",
    "lrb": "LRB",
    "love runs blind": "LRB",
    "warfaze": "Warfaze",
    "wazfaze": "Warfaze",
    "sahana": "Sahana Bajpaie",
    "sahana bajpaie": "Sahana Bajpaie",
    "armeen musa": "Armeen Musa",
    "armin": "Armeen Musa",
    "shovvota": "Shobbhota",
    "sovvota": "Shobbhota",
    "shobbhota": "Shobbhota",
}

MULTI_ARTIST_MAP = {
    "artcell, black & cryptic fate": ["Artcell", "Black", "Cryptic Fate"],
    "lamia, shaheen, johan shihab": ["Lamia", "Shaheen", "Johan", "Shihab"],
    "johan, fuad shanto": ["Johan", "Fuad", "Shanto"],
    "bassbaba sumon feat. arbovirus": ["Bassbaba Sumon", "Arbovirus"],
    "stentorian feat. bassbaba sumon": ["Stentorian", "Bassbaba Sumon"],
    "bassbaba sumon & anila naz chowdhury": ["Bassbaba Sumon", "Anila"],
    "bassbaba sumon & anila": ["Bassbaba Sumon", "Anila"],
    "sumon & anila": ["Bassbaba Sumon", "Anila"],
    "anila & sumon": ["Bassbaba Sumon", "Anila"],
    "upol & maher": ["Upol", "Maher"],
    "upol and maher": ["Upol", "Maher"],
    "armin & nabila": ["Armeen Musa", "Nabila"],
    "armeen musa & nabila": ["Armeen Musa", "Nabila"],
    "arnob;zerin": ["Arnob", "Zerin"],
    "arnob feat. zerin": ["Arnob", "Zerin"],
    "arnob & sahana bajpaie": ["Arnob", "Sahana Bajpaie"],
    "arnob & sahana": ["Arnob", "Sahana Bajpaie"],
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
        if art_lower in ["bassbaba sumon & anila naz chowdhury", "bassbaba sumon & anila", "sumon & anila", "anila & sumon"]:
            artist = "Bassbaba Sumon & Anila"
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
    m = re.match(r'https://media\.githubusercontent\.com/media/BD-Band-Archive/([^/]+)/master/(.+)/[^/]+$', stream_url)
    repo = None
    target_dirs = []
    
    if m:
        repo = m.group(1)
        rel_folder = urllib.parse.unquote(m.group(2))
        repo_dir = get_local_repo_dir(repo)
        target_dirs.append((rel_folder, repo_dir / rel_folder))
        if '/' in rel_folder:
            parent_folder = rel_folder.split('/')[0]
            target_dirs.append((parent_folder, repo_dir / parent_folder))
    else:
        m_root = re.match(r'https://media\.githubusercontent\.com/media/BD-Band-Archive/([^/]+)/master/([^/]+)$', stream_url)
        if m_root:
            repo = m_root.group(1)
            repo_dir = get_local_repo_dir(repo)
            target_dirs.append(("", repo_dir))
        else:
            return ''

    for cur_folder, target_dir in target_dirs:
        if not target_dir or not target_dir.exists():
            continue
        for cov_name in ['Album Cover', 'Album Covers']:
            cov_dir = target_dir / cov_name
            if cov_dir.exists():
                files = [f for f in cov_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
                if files:
                    front = None
                    # If in Singles folder, look for a track-specific cover first
                    if 'singles' in cur_folder.lower():
                        track_file = stream_url.split('/')[-1].split('?')[0]
                        track_clean = re.sub(r'^\d+[\s\.\-_]+', '', urllib.parse.unquote(Path(track_file).stem).lower()).strip()
                        words = [w for w in re.split(r'[\s\-_]+', track_clean) if len(w) > 3 and w not in ['aftermath', 'arnob', 'artcell', 'singles', 'flac', 'bangladesh']]
                        for f in files:
                            if 'front' in f.name.lower() or f.stem.lower() == 'folder':
                                continue
                            f_stem = f.stem.lower()
                            if any(w in f_stem for w in words):
                                front = f
                                break

                    if not front:
                        front = next((f for f in files if 'front' in f.name.lower() or 'artwork' in f.name.lower()), files[0])

                    enc_cov = urllib.parse.quote(cov_name)
                    enc_file = urllib.parse.quote(front.name)
                    if cur_folder:
                        enc_alb = "/".join(urllib.parse.quote(seg) for seg in cur_folder.split("/"))
                        return f'https://raw.githubusercontent.com/BD-Band-Archive/{repo}/master/{enc_alb}/{enc_cov}/{enc_file}'
                    else:
                        return f'https://raw.githubusercontent.com/BD-Band-Archive/{repo}/master/{enc_cov}/{enc_file}'
                
    return ''

def get_all_album_covers(stream_url):
    """Directly inspect filesystem for all album covers and booklet scans based on stream URL."""
    m = re.match(r'https://media\.githubusercontent\.com/media/BD-Band-Archive/([^/]+)/master/(.+)/[^/]+$', stream_url)
    repo = None
    target_dirs = []
    
    if m:
        repo = m.group(1)
        rel_folder = urllib.parse.unquote(m.group(2))
        repo_dir = get_local_repo_dir(repo)
        target_dirs.append((rel_folder, repo_dir / rel_folder))
        if '/' in rel_folder:
            parent_folder = rel_folder.split('/')[0]
            target_dirs.append((parent_folder, repo_dir / parent_folder))
    else:
        m_root = re.match(r'https://media\.githubusercontent\.com/media/BD-Band-Archive/([^/]+)/master/([^/]+)$', stream_url)
        if m_root:
            repo = m_root.group(1)
            repo_dir = get_local_repo_dir(repo)
            target_dirs.append(("", repo_dir))
        else:
            return []

    covers = []
    seen_hashes = set()
    seen_urls = set()
    import hashlib
    
    def get_f_hash(p):
        with open(p, 'rb') as fp:
            return hashlib.md5(fp.read()).hexdigest()

    for cur_folder, target_dir in target_dirs:
        if not target_dir or not target_dir.exists():
            continue
        for cov_name in ['Album Cover', 'Album Covers']:
            cov_dir = target_dir / cov_name
            if cov_dir.exists():
                files = [f for f in cov_dir.iterdir() if f.is_file() and f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp']]
                def natural_sort_key(f):
                    n = f.name.lower()
                    cat = 8
                    if 'front' in n:
                        cat = 1
                    elif 'artwork' in n:
                        cat = 2
                    elif 'booklet' in n:
                        cat = 3
                    elif 'lyrics' in n:
                        cat = 4
                    elif 'inlay' in n or 'inset' in n or 'inlet' in n:
                        cat = 5
                    elif 'cd' in n or 'disc' in n or 'tape' in n or 'cassette' in n:
                        cat = 6
                    elif 'back' in n:
                        cat = 7
                    elif 'poster' in n:
                        cat = 8
                    return (cat, [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', f.name)])

                files.sort(key=natural_sort_key)
                has_front = any('front' in f.name.lower() or 'artwork' in f.name.lower() for f in files)

                for f in files:
                    if has_front and f.stem.lower() in ['folder']:
                        continue
                    try:
                        h = get_f_hash(f)
                        if 'singles' in cur_folder.lower():
                            if f.name in seen_urls:
                                continue
                        else:
                            if h in seen_hashes:
                                continue
                            seen_hashes.add(h)
                    except Exception:
                        pass
                    
                    enc_cov = urllib.parse.quote(cov_name)
                    enc_file = urllib.parse.quote(f.name)
                    if cur_folder:
                        enc_alb = "/".join(urllib.parse.quote(seg) for seg in cur_folder.split("/"))
                        raw_url = f'https://raw.githubusercontent.com/BD-Band-Archive/{repo}/master/{enc_alb}/{enc_cov}/{enc_file}'
                    else:
                        raw_url = f'https://raw.githubusercontent.com/BD-Band-Archive/{repo}/master/{enc_cov}/{enc_file}'

                    if raw_url in seen_urls:
                        continue
                    seen_urls.add(raw_url)
                    
                    clean_stem = f.stem.replace('+-5B', ' [').replace('-5B', ' [').replace('+-5D', ']').replace('-5D', ']').replace('+', ' ')
                    m_tag = re.search(r'\[([^\]]+)\](?:\s*\((.*?)\))?', clean_stem)
                    if m_tag:
                        tag_name = m_tag.group(1).strip()
                        if m_tag.group(2):
                            tag_name = f"{tag_name} ({m_tag.group(2).strip()})"
                    else:
                        tag_name = clean_stem.strip()
                    
                    covers.append({
                        "title": tag_name,
                        "filename": f.name,
                        "url": raw_url
                    })
    return covers

def validate_repo_structure(folder_name, readme_path):
    """
    Validates mandatory discography structural hierarchy:
      1. Original Albums (Studio albums, Live albums, core EPs) - ascending by release year
      2. Solos / Singles (Solo releases, standalone singles, unreleased demo tracks)
      3. Linked Mixed Albums (Mixed album / compilation appearances) - strictly ascending by release year
      
    Also enforces:
      - Sequential numbering without gaps (1, 2, 3, ...)
      - If a 'Singles' folder exists on disk with audio tracks, a Singles section must exist in README
      - No Tier 3 (Mixed) albums appearing before Tier 1 or Tier 2
      - Mandatory ascending chronological order for all albums in 'Mixed Albums' repository
    """
    if folder_name == "BD Band Music":
        return True

    if not readme_path.exists():
        return False

    with open(readme_path, "r", encoding="utf-8") as f:
        content = f.read()

    body_matches = re.findall(r"^##\s+(\d+)\.\s+([^\n]+)", content, re.MULTILINE)
    if not body_matches:
        return True

    # Special validation for the central Mixed Albums repository
    if folder_name == "Mixed Albums":
        prev_yr = 0
        prev_num = 0
        errors = []
        for num_str, title in body_matches:
            num = int(num_str)
            if num != prev_num + 1:
                errors.append(f"Header numbering jump: expected {prev_num+1}, got {num} ('{title}')")
            prev_num = num
            y_m = re.search(r"\((\d{4})\)", title)
            if y_m:
                yr = int(y_m.group(1))
                if yr < prev_yr:
                    errors.append(
                        f"Ascending chronological order violation in Mixed Albums: section {num} ('{title}', year {yr}) "
                        f"is earlier than previous album year {prev_yr}!"
                    )
                prev_yr = yr
        if errors:
            print(f"\n❌ [CHRONOLOGICAL VIOLATION] in Mixed Albums:")
            for err in errors:
                print(f"   • {err}")
            raise ValueError("Mixed Albums violates mandatory ascending chronological order.")
        print(f"  [✓] Mixed Albums Chronological Order Verified ({len(body_matches)} albums ascending)")
        return True

    repo_dir = MUSIC_DIR / folder_name
    sections = []
    for num_str, title in body_matches:
        num = int(num_str)
        t_clean = re.sub(r"\[.*?\]\((.*?)\)", r"\1", title).strip()
        t_lower = title.lower()
        if "mixed-albums" in t_lower or "github.com/bd-band-archive/mixed-albums" in t_lower or "github.com/ghostdog45/mixed-albums" in t_lower or ("http" in t_lower and folder_name.lower().replace(" ", "-") not in t_clean.lower()):
            sec_type = "mixed"
        elif any(k in t_lower for k in ["single", "standalone", "collaboration", "solos"]):
            sec_type = "single"
        else:
            sec_type = "original"
        sections.append((num, sec_type, title))

    tier_map = {"original": 1, "single": 2, "mixed": 3}
    errors = []

    # Check Singles directory on disk
    singles_dir = repo_dir / "Singles"
    if singles_dir.is_dir():
        flac_files = [f for f in singles_dir.iterdir() if f.is_file() and f.suffix.lower() == ".flac"]
        has_single_sec = any(sec_type == "single" for _, sec_type, _ in sections)
        if flac_files and not has_single_sec:
            errors.append(f"Contains {len(flac_files)} Singles FLAC files on disk, but README.md is missing a Singles section!")

    current_tier = 1
    prev_num = 0
    prev_years = {"original": 0, "single": 0, "mixed": 0}

    for num, sec_type, title in sections:
        tier = tier_map[sec_type]
        if num != prev_num + 1:
            errors.append(f"Header numbering jump: expected {prev_num+1}, got {num} ('{title}')")
        prev_num = num

        if tier < current_tier:
            errors.append(
                f"Structure hierarchy violation: section {num} ('{title}') of tier '{sec_type}' "
                f"appears after higher-tier section! Hierarchy must strictly follow: "
                f"Original Albums -> Solos/Singles -> Linked Mixed Albums"
            )
        else:
            current_tier = tier

        # Validate ascending chronological release year order within original and mixed sections
        y_m = re.search(r"\((\d{4})\)", title)
        if y_m and sec_type in ["original", "mixed"]:
            yr = int(y_m.group(1))
            if yr < prev_years[sec_type]:
                errors.append(
                    f"Ascending chronological order violation in {sec_type} albums: "
                    f"section {num} ('{title}', year {yr}) appears after year {prev_years[sec_type]}! "
                    f"All albums within {sec_type} albums must be in ascending chronological order."
                )
            else:
                prev_years[sec_type] = yr

    if errors:
        print(f"\n❌ [STRUCTURAL VIOLATION] in repository '{folder_name}':")
        for err in errors:
            print(f"   • {err}")
        raise ValueError(f"Repository '{folder_name}' violates mandatory discography structure hierarchy.")
    else:
        summary_tiers = " -> ".join(s[1] for s in sections)
        print(f"  [✓] Structure Verified ({len(sections)} sections: {summary_tiers})")
        return True

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
        validate_repo_structure(folder_name, readme_path)
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
                    "special thanks", "acknowledgements", "contribution", "contributing",
                    "dmca", "disclaimer"
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
                
                # Strip Bengali script subtitles (e.g. "Lokayot (লোকাযত)" -> "Lokayot", "Charpotro (ছাড়পত্র)" -> "Charpotro")
                clean_album = re.sub(r'\s*\([\u0980-\u09FF\s\d\w\-\.,]+\)', '', clean_album).strip()

                if folder_name != "Mixed Albums" and any(k in clean_album.lower() for k in ["single", "standalone", "solos", "collaboration"]):
                    clean_album = f"{folder_name} Singles"
                
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
                        img_src = f"https://raw.githubusercontent.com/BD-Band-Archive/{repo_name}/master/{encoded_path}"
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
                    
                # Ekhon Ami is the celebrated duet album by Bassbaba Sumon & Anila
                if "ekhon ami" in current_album.lower():
                    track_artist = "Bassbaba Sumon & Anila"
                    track_artists = ["Bassbaba Sumon", "Anila"]
                    feat = None

                # If featured artist exists, credit them in track_artists
                if feat:
                    feat_lower = feat.lower()
                    if "anila" in feat_lower and "Anila" not in track_artists:
                        track_artists.append("Anila")
                    elif "elita" in feat_lower and "Elita" not in track_artists:
                        track_artists.append("Elita")
                    elif "tahsan" in feat_lower and "Tahsan" not in track_artists:
                        track_artists.append("Tahsan")
                    elif "arbovirus" in feat_lower and "Arbovirus" not in track_artists:
                        track_artists.append("Arbovirus")
                    elif "topu" in feat_lower and "Topu" not in track_artists:
                        track_artists.append("Topu")
                    
                track_album = current_album
                track_year = current_year
                
                # If current_album is Unknown Album or generic, extract album subfolder from stream URL
                m_subfolder = re.match(r'https://media\.githubusercontent\.com/media/BD-Band-Archive/[^/]+/master/([^/]+)/', clean_url)
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

                # Normalize album name by stripping Bengali script subtitles
                track_album = re.sub(r'\s*\([\u0980-\u09FF\s\d\w\-\.,]+\)', '', track_album).strip()

                if folder_name != "Mixed Albums" and (any(k in track_album.lower() for k in ["single", "standalone", "solos", "collaboration"]) or "/singles/" in clean_url.lower()):
                    track_album = f"{folder_name} Singles"

                # High-precision cover resolution:
                # 1. Exact album cover deduced from streamUrl
                # 2. Markdown cover if valid
                # 3. Fallback
                track_cover = get_exact_album_cover(url) or current_cover
                
                # Dynamically collect all physical album covers/booklets for this album
                artist_album_key = f"{track_artist} - {track_album}"
                covs = get_all_album_covers(clean_url)
                if covs:
                    if artist_album_key not in album_covers_map:
                        album_covers_map[artist_album_key] = list(covs)
                    else:
                        for cv in covs:
                            if not any(x['url'] == cv['url'] for x in album_covers_map[artist_album_key]):
                                album_covers_map[artist_album_key].append(cv)

                    if track_album not in album_covers_map:
                        album_covers_map[track_album] = list(covs)
                    else:
                        for cv in covs:
                            if not any(x['url'] == cv['url'] for x in album_covers_map[track_album]):
                                album_covers_map[track_album].append(cv)
                
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
    artist_images = build_artists_map(catalog)
    
    # Generate static share pages for all tracks, artists, and albums for rich link image injection
    generate_social_share_pages(catalog, album_covers_map, artist_images)
    
    # Update BD Band Music README with live track count badge and text
    readme_path = OUTPUT_DIR / "README.md"
    if readme_path.exists():
        readme_text = readme_path.read_text(encoding="utf-8")
        updated_text = re.sub(r'Catalog-\d+%20FLAC%20Tracks', f'Catalog-{len(catalog)}%20FLAC%20Tracks', readme_text)
        updated_text = re.sub(r'\*\*\d+\s+lossless\s+FLAC\s+tracks\*\*', f'**{len(catalog)} lossless FLAC tracks**', updated_text)
        if updated_text != readme_text:
            readme_path.write_text(updated_text, encoding="utf-8")
            print(f" Updated README.md badge and count to {len(catalog)} tracks.")
            
    # Automatically bump cache-buster APP_VERSION in app.js and index.html to guarantee fresh cache
    app_js_path = OUTPUT_DIR / "app.js"
    index_html_path = OUTPUT_DIR / "index.html"
    new_ver = None

    if app_js_path.exists():
        txt = app_js_path.read_text(encoding="utf-8")
        m_v = re.search(r"const APP_VERSION = '(\d+)\.(\d+)(?:\.(\d+))?';", txt)
        if m_v:
            maj = int(m_v.group(1))
            min_v = int(m_v.group(2))
            patch = int(m_v.group(3)) if m_v.group(3) else 0
            new_ver = f"{maj}.{min_v}.{patch + 1}"
            txt = re.sub(r"const APP_VERSION = '[^']+';", f"const APP_VERSION = '{new_ver}';", txt)
            app_js_path.write_text(txt, encoding="utf-8")
            print(f"[*] Bumped app.js APP_VERSION to {new_ver}")

    if index_html_path.exists() and new_ver:
        txt = index_html_path.read_text(encoding="utf-8")
        txt = re.sub(r'<script src="app\.js\?v=[^"]+"></script>', f'<script src="app.js?v={new_ver}"></script>', txt)
        txt = re.sub(r'<link rel="stylesheet" href="style\.css\?v=[^"]+">', f'<link rel="stylesheet" href="style.css?v={new_ver}">', txt)
        txt = re.sub(r"var CURRENT_VER = '[^']+';", f"var CURRENT_VER = '{new_ver}';", txt)
        txt = re.sub(r"Ensure all visitors immediately upgrade to v\S+", f"Ensure all visitors immediately upgrade to v{new_ver}", txt)
        index_html_path.write_text(txt, encoding="utf-8")
        print(f"[*] Bumped index.html cache busters and CURRENT_VER to v={new_ver}")

    package_json_path = OUTPUT_DIR / "package.json"
    if package_json_path.exists() and new_ver:
        txt = package_json_path.read_text(encoding="utf-8")
        txt = re.sub(r'"version":\s*"[^"]+"', f'"version": "{new_ver}"', txt)
        package_json_path.write_text(txt, encoding="utf-8")
        print(f"[*] Bumped package.json version to {new_ver}")

    server_js_path = OUTPUT_DIR / "server.js"
    if server_js_path.exists() and new_ver:
        txt = server_js_path.read_text(encoding="utf-8")
        txt = re.sub(r"version:\s*'[^']+'", f"version: '{new_ver}'", txt)
        server_js_path.write_text(txt, encoding="utf-8")
        print(f"[*] Bumped server.js version to {new_ver}")

    worker_js_path = OUTPUT_DIR / "worker" / "index.js"
    if worker_js_path.exists() and new_ver:
        txt = worker_js_path.read_text(encoding="utf-8")
        txt = re.sub(r"version:\s*'[^']+'", f"version: '{new_ver}'", txt)
        worker_js_path.write_text(txt, encoding="utf-8")
        print(f"[*] Bumped worker/index.js version to {new_ver}")
    
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
        normalize_slug('duray'): normalize_slug('durey'),
        normalize_slug('mohakal'): normalize_slug('mohakaal'),
        normalize_slug('the icons'): normalize_slug('icons'),
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

def generate_social_share_pages(catalog, album_covers_map, artist_images):
    """
    Generates static HTML landing pages with pre-rendered Open Graph & Twitter Card
    metadata for every track, artist, and album in the archive.
    
    When shared on WhatsApp, Facebook, Telegram, Discord, Twitter/X, or iMessage,
    crawlers parse the exact album cover or artist photo and title directly from the HTML.
    When opened by real users, it instantly redirects to the web player with zero delay.
    """
    base_site_url = "https://bd-band-archive.github.io/BD-Band-Music"
    default_cover = "https://raw.githubusercontent.com/BD-Band-Archive/BD-Band-Music/master/assets/band_cover.jpg"

    # 1. Generate Track Share Pages
    track_root = OUTPUT_DIR / "track"
    track_root.mkdir(parents=True, exist_ok=True)
    
    for t in catalog:
        track_id = t["id"]
        t_dir = track_root / track_id
        t_dir.mkdir(parents=True, exist_ok=True)
        
        title_esc = html.escape(t["title"])
        artist_esc = html.escape(t["artist"])
        album_esc = html.escape(t.get("album") or "Album")
        year_str = f" ({t['year']})" if t.get("year") else ""
        
        cover = t.get("coverUrl") or default_cover
        page_title = f"{title_esc} — {artist_esc} | BD Band Music"
        desc = f"Album: {album_esc}{year_str} • Stream Lossless FLAC on BD Band Music"
        
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{page_title}</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="{page_title}">
  <meta name="description" content="{desc}">
  
  <!-- Open Graph / WhatsApp / Facebook / Discord / Telegram -->
  <meta property="og:type" content="music.song">
  <meta property="og:site_name" content="BD Band Music">
  <meta property="og:title" content="{title_esc} — {artist_esc}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="{cover}">
  <meta property="og:image:secure_url" content="{cover}">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="600">
  <meta property="og:url" content="{base_site_url}/track/{track_id}/">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title_esc} — {artist_esc}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{cover}">
  
  <!-- Instant Player Launch for Real Users -->
  <meta http-equiv="refresh" content="0; url=../../?track={track_id}">
  <script>window.location.replace("../../?track={track_id}");</script>
</head>
<body style="background:#0e1117; color:#f3f4f6; font-family:'Segoe UI',sans-serif; text-align:center; padding:15vh 1rem;">
  <h2>🎵 {title_esc}</h2>
  <h3 style="color:#a78bfa; margin-top:-0.5rem;">{artist_esc}</h3>
  <p style="color:#9ca3af;">Loading lossless FLAC in BD Band Music player...</p>
  <p><a href="../../?track={track_id}" style="color:#8b5cf6; text-decoration:none; font-weight:600;">Click here if not redirected automatically</a></p>
</body>
</html>
"""
        (t_dir / "index.html").write_text(html_content, encoding="utf-8")

    # 2. Generate Artist Share Pages
    artist_root = OUTPUT_DIR / "artist"
    artist_root.mkdir(parents=True, exist_ok=True)
    
    artist_tracks_count = Counter()
    for t in catalog:
        for a in t.get("artists", [t["artist"]]):
            artist_tracks_count[a] += 1
            
    for art, count in artist_tracks_count.items():
        slug = re.sub(r'[^a-zA-Z0-9]+', '-', art.lower()).strip('-')
        if not slug:
            continue
            
        a_dir = artist_root / slug
        a_dir.mkdir(parents=True, exist_ok=True)
        
        art_esc = html.escape(art)
        quoted_art = urllib.parse.quote(art)
        
        rel_img = artist_images.get(art)
        if rel_img:
            art_img = f"https://raw.githubusercontent.com/BD-Band-Archive/BD-Band-Music/master/{rel_img}"
        else:
            art_img = default_cover
            
        page_title = f"{art_esc} | BD Band Music Lossless Archive"
        desc = f"Listen to all {count} lossless FLAC tracks by {art_esc} directly in your browser."
        
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{page_title}</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="{page_title}">
  <meta name="description" content="{desc}">
  
  <!-- Open Graph / WhatsApp / Facebook / Discord / Telegram -->
  <meta property="og:type" content="profile">
  <meta property="og:site_name" content="BD Band Music">
  <meta property="og:title" content="{art_esc} — BD Band Music">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="{art_img}">
  <meta property="og:image:secure_url" content="{art_img}">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="600">
  <meta property="og:url" content="{base_site_url}/artist/{slug}/">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{art_esc} — BD Band Music">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{art_img}">
  
  <!-- Instant Player Launch for Real Users -->
  <meta http-equiv="refresh" content="0; url=../../?artist={quoted_art}">
  <script>window.location.replace("../../?artist={quoted_art}");</script>
</head>
<body style="background:#0e1117; color:#f3f4f6; font-family:'Segoe UI',sans-serif; text-align:center; padding:15vh 1rem;">
  <h2>👑 {art_esc}</h2>
  <p style="color:#9ca3af;">Loading {count} lossless FLAC tracks in BD Band Music player...</p>
  <p><a href="../../?artist={quoted_art}" style="color:#8b5cf6; text-decoration:none; font-weight:600;">Click here if not redirected automatically</a></p>
</body>
</html>
"""
        (a_dir / "index.html").write_text(html_content, encoding="utf-8")

    # 3. Generate Album Share Pages
    album_root = OUTPUT_DIR / "album"
    album_root.mkdir(parents=True, exist_ok=True)
    
    albums_set = set(t["album"] for t in catalog)
    for alb in albums_set:
        slug = re.sub(r'[^a-zA-Z0-9]+', '-', alb.lower()).strip('-')
        if not slug:
            continue
            
        alb_dir = album_root / slug
        alb_dir.mkdir(parents=True, exist_ok=True)
        
        alb_esc = html.escape(alb)
        quoted_alb = urllib.parse.quote(alb)
        
        first_t = next(t for t in catalog if t["album"] == alb)
        art_name = "Various Artists" if first_t.get("repo") == "Mixed-Albums" else first_t["artist"]
        art_esc = html.escape(art_name)
        yr_str = f" ({first_t['year']})" if first_t.get("year") else ""
        
        gallery = album_covers_map.get(alb) or album_covers_map.get(f"{first_t['artist']} - {alb}") or []
        alb_cover = gallery[0]["url"] if gallery else (first_t.get("coverUrl") or default_cover)
        
        alb_tracks = [t for t in catalog if t["album"] == alb]
        page_title = f"{alb_esc}{yr_str} — {art_esc} | BD Band Music"
        desc = f"{len(alb_tracks)} lossless FLAC tracks • Listen directly in your browser."
        
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{page_title}</title>
  
  <!-- Primary Meta Tags -->
  <meta name="title" content="{page_title}">
  <meta name="description" content="{desc}">
  
  <!-- Open Graph / WhatsApp / Facebook / Discord / Telegram -->
  <meta property="og:type" content="music.album">
  <meta property="og:site_name" content="BD Band Music">
  <meta property="og:title" content="{alb_esc}{yr_str} — {art_esc}">
  <meta property="og:description" content="{desc}">
  <meta property="og:image" content="{alb_cover}">
  <meta property="og:image:secure_url" content="{alb_cover}">
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="600">
  <meta property="og:url" content="{base_site_url}/album/{slug}/">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{alb_esc}{yr_str} — {art_esc}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{alb_cover}">
  
  <!-- Instant Player Launch for Real Users -->
  <meta http-equiv="refresh" content="0; url=../../?album={quoted_alb}">
  <script>window.location.replace("../../?album={quoted_alb}");</script>
</head>
<body style="background:#0e1117; color:#f3f4f6; font-family:'Segoe UI',sans-serif; text-align:center; padding:15vh 1rem;">
  <h2>💿 {alb_esc}</h2>
  <h3 style="color:#a78bfa; margin-top:-0.5rem;">{art_esc}</h3>
  <p style="color:#9ca3af;">Loading album in BD Band Music player...</p>
  <p><a href="../../?album={quoted_alb}" style="color:#8b5cf6; text-decoration:none; font-weight:600;">Click here if not redirected automatically</a></p>
</body>
</html>
"""
        (alb_dir / "index.html").write_text(html_content, encoding="utf-8")

    print(f"[*] Generated social share pages with photo injection for {len(catalog)} tracks, {len(artist_tracks_count)} artists, and {len(albums_set)} albums.")

if __name__ == "__main__":
    build_catalog()
