"""Builds every app icon from the owner's sources in docs/design/export/app-icon/ (male, female, rays background).
Run from apps/mobile: python3 scripts/build-app-icons.py (needs Pillow).
Android adaptive foregrounds are the full icon shrunk into the launcher safe zone over the same rays backdrop; the web icons use the male hero."""
from PIL import Image

SRC = '../../docs/design/export/app-icon/'
male = Image.open(SRC + 'app-icon-male.png').convert('RGB')
female = Image.open(SRC + 'app-icon-female.png').convert('RGB')
rays = Image.open(SRC + 'app-icon-rays.png').convert('RGB')
L = Image.LANCZOS


def fg(icon, scale=0.68):
    """Full icon centred on a transparent canvas, small enough to survive the launcher mask (66% safe zone)."""
    s = int(1024 * scale)
    out = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    out.paste(icon.resize((s, s), L).convert('RGBA'), ((1024 - s) // 2,) * 2)
    return out


def maskable(icon, scale=0.8):
    out = rays.copy()
    s = int(1024 * scale)
    out.paste(icon.resize((s, s), L), ((1024 - s) // 2,) * 2)
    return out


for suffix, icon in (('', male), ('-female', female)):
    icon.save(f'assets/icon-adult{suffix}.png')
    icon.resize((192, 192), L).save(f'assets/icon-adult{suffix}-192.png')
    fg(icon).resize((432, 432), L).save(f'assets/adaptive-icon-adult{suffix}-432.png')
rays.resize((216, 216), L).save('assets/adaptive-background-adult-216.png')

# Web: static male icon (manifest-adult is the one the page links; the plain names are kept identical for the old manifest and the landing site).
for name in ('', '-adult'):
    male.resize((192, 192), L).save(f'public/icon{name}-192.png')
    male.resize((512, 512), L).save(f'public/icon{name}-512.png')
    maskable(male).resize((512, 512), L).save(f'public/icon{name}-maskable-512.png')
for p in ('public/apple-touch-icon.png', 'public/apple-touch-icon-adult.png'):
    male.resize((180, 180), L).save(p)
male.resize((48, 48), L).save('assets/favicon.png')
d = '../landing/assets/icons/'
for s, n in ((32, 'favicon-32'), (192, 'icon-192'), (512, 'icon-512'), (180, 'apple-touch-icon')):
    male.resize((s, s), L).save(f'{d}{n}.png')
male.save(d + 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print('ok')
