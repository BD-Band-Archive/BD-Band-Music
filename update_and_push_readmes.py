import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

for r in sorted(Path('d:/Music').iterdir()):
    if not (r / '.git').exists():
        continue
    st = subprocess.run(['git', 'status', '-s'], cwd=r, capture_output=True, text=True).stdout.strip()
    if not st:
        print(f"[✓] {r.name}: Already clean, nothing to commit.")
        continue
    print(f"[*] Processing {r.name}...")
    subprocess.run(['git', 'add', '-A'], cwd=r, check=True)
    c_res = subprocess.run(['git', 'commit', '-m', 'docs: add Contribution and DMCA notice to README'], cwd=r, capture_output=True, text=True)
    first_commit_line = c_res.stdout.splitlines()[0] if c_res.stdout.splitlines() else "No commit output"
    print(f"    Committed: {first_commit_line}")
    p_res = subprocess.run(['git', 'push', 'origin', 'master'], cwd=r, capture_output=True, text=True)
    if p_res.returncode == 0:
        print(f"    [✓] Pushed {r.name} to origin/master successfully.")
    else:
        print(f"    [!] Push failed for {r.name}:\n{p_res.stderr}")
