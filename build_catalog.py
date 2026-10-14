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

REPOS = [
    ("Arbovirus", "Arbovirus"),
    ("Artcell", "Artcell"),
    ("Aurthohin", "Aurthohin"),
    ("Black", "Black"),
    ("Icons", "Icons"),
    ("Indalo", "Indalo"),
    ("Minerva", "Minerva"),
    ("Stoic Bliss", "Stoic-Bliss"),
    ("The Watson Brothers", "The-Watson-Brothers"),
    ("Vibe", "Vibe"),
    ("Mixed Albums", "Mixed-Albums")
]

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
        
    return artist, title

def build_catalog():
    catalog = []
    seen_urls = set()
    
    for folder_name, repo_name in REPOS:
        readme_path = MUSIC_DIR / folder_name / "README.md"
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
        in_sumon_section = False
        
        for line in lines:
            line_str = line.strip()
            
            # Check H2 album headers:
            m_head = re.match(r'^##\s+(?:\[?\d+[\.\)]?\s*)?([^#\n]+)', line_str)
            if m_head:
                header_text = m_head.group(1).strip()
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
                    if "Bassbaba Sumon" in current_album or "Sumon" in current_album:
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
                
            # Cover image
            m_img = re.search(r'<img\s+src="([^"]+)"', line_str)
            if not m_img:
                m_img = re.search(r'!\[.*?\]\(([^)]+)\)', line_str)
            if m_img:
                img_src = m_img.group(1).strip()
                if not img_src.startswith("http"):
                    encoded_path = "/".join(urllib.parse.quote(seg) for seg in img_src.replace("\\", "/").split("/"))
                    img_src = f"https://raw.githubusercontent.com/GhostDog45/{repo_name}/master/{encoded_path}"
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
                track_artist, track_title = clean_track(raw_title, effective_artist, is_mixed=is_mixed)
                
                # Check for featured artist
                feat = None
                m_feat = re.search(r'\((?:feat|ft)\.?\s*([^)]+)\)', track_title, re.IGNORECASE)
                if not m_feat:
                    m_feat = re.search(r'-(?:feat|ft)\.?\s*([^-]+)', track_title, re.IGNORECASE)
                if m_feat:
                    feat = m_feat.group(1).strip()
                    
                track_id = f"track-{len(catalog)+1}"
                
                catalog.append({
                    "id": track_id,
                    "title": track_title,
                    "artist": track_artist,
                    "featured": feat,
                    "album": current_album,
                    "year": current_year,
                    "trackNo": album_track_counter,
                    "streamUrl": url,
                    "coverUrl": current_cover,
                    "repo": repo_name,
                    "isLossyTranscode": lossy_note
                })
                
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_json = OUTPUT_DIR / "catalog.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
        
    print(f"\n Successfully wrote {len(catalog)} tracks to {out_json}!")
    
    # Print summary statistics
    artists = Counter(t['artist'] for t in catalog)
    albums = len(set(t['album'] for t in catalog))
    print(f" Total Unique Artists: {len(artists)}")
    print(f" Total Albums/Compilations: {albums}")
    print("\nTop 15 Artists:")
    for a, count in artists.most_common(15):
        print(f"  • {a}: {count} tracks")

if __name__ == "__main__":
    build_catalog()
