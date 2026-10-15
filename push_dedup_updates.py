import subprocess
import sys

sys.stdout.reconfigure(encoding='utf-8')

repos = [
    'Artcell',
    'Aurthohin',
    'Bassbaba Sumon',
    'Black',
    'Icons',
    'Indalo',
    'Jon Kabir',
    'Mila',
    'Minerva',
    'Stoic Bliss',
    'The Watson Brothers',
    'BD Band Music'
]

for r in repos:
    print(f"=== Committing and pushing {r} ===")
    status = subprocess.check_output(['git', '-C', f'd:/Music/{r}', 'status', '-s'], encoding='utf-8').strip()
    if not status:
        print(f"  {r} has no changes. Skipping.")
        continue
    subprocess.check_call(['git', '-C', f'd:/Music/{r}', 'add', '-A'])
    subprocess.check_call(['git', '-C', f'd:/Music/{r}', 'commit', '-m', 'Deduplicate album artwork tables and remove redundant folder.jpg scans'])
    subprocess.check_call(['git', '-C', f'd:/Music/{r}', 'push', 'origin', 'master'])
    print(f"  Successfully pushed {r}!")

print("\nAll 12 repositories updated and pushed!")
