"""Builds the adult-track app icons (docs/design/adult/Dozari Adult - App Icon.dc.html) from the existing hero art in assets/.
Gold coin + hero on near-black with faint gold rays and a gold frame. Run: python3 scripts/build-adult-icons.py (needs Pillow)."""
import math
from PIL import Image, ImageDraw, ImageOps

S = 1024
INK = (58, 36, 24, 255)
GOLD = (232, 182, 74, 255)


def rays(size, alpha=46):
    im = Image.new('RGBA', (size, size), (18, 11, 7, 255))
    ov = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    c, R = size / 2, size * 1.2
    for i in range(18):
        a, b = math.radians(i * 20), math.radians(i * 20 + 10)
        d.polygon([(c, c), (c + R * math.cos(a), c + R * math.sin(a)), (c + R * math.cos(b), c + R * math.sin(b))], fill=(232, 182, 74, alpha))
    return Image.alpha_composite(im, ov)


def coin(size):
    """Gold coin: radial highlight up-left, ink edge and shelf, dashed inner ring."""
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    body = size - 14
    d.ellipse([0, 14, size - 1, size - 1], fill=INK)  # shelf
    d.ellipse([0, 0, size - 1, body], fill=INK)
    inset = 12
    inner = body + 1 - 2 * inset
    g = ImageOps.colorize(Image.radial_gradient('L'), black='#FFF1B8', white='#8A5A16', mid='#E8B64A', midpoint=100).convert('RGBA')
    g = g.resize((int(inner * 1.9), int(inner * 1.9)), Image.LANCZOS)
    face = Image.new('RGBA', (inner, inner))
    face.paste(g, (-int(inner * 0.2) - int(inner * 0.05), -int(inner * 0.3) - int(inner * 0.05)))
    mask = Image.new('L', (inner, inner), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, inner - 1, inner - 1], fill=255)
    im.paste(face, (inset, inset), mask)
    cx = cy = inset + inner / 2
    ring = inner * 0.41
    for i in range(0, 360, 12):
        d.arc([cx - ring, cy - ring, cx + ring, cy + ring], i, i + 6, fill=(106, 66, 16, 255), width=4)
    return im


def hero(path, height):
    fg = Image.open(path).convert('RGBA')
    box = fg.getbbox()
    fg = fg.crop(box)
    return fg.resize((int(fg.width * height / fg.height), height), Image.LANCZOS)


def foreground(hero_path, canvas=S, coin_d=620):
    im = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    c = coin(coin_d)
    im.alpha_composite(c, ((canvas - coin_d) // 2, (canvas - coin_d) // 2 - 6))
    h = hero(hero_path, int(coin_d * 0.96))
    im.alpha_composite(h, ((canvas - h.width) // 2, (canvas - h.height) // 2 - 10))
    return im


def framed(bg, fg):
    im = bg.copy()
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([14, 14, S - 15, S - 15], radius=150, outline=(0, 0, 0, 255), width=30)
    d.rounded_rectangle([30, 30, S - 31, S - 31], radius=135, outline=GOLD, width=16)
    im.alpha_composite(fg)
    return im


bg = rays(S)
for suffix, src in (('', 'assets/adaptive-icon.png'), ('-female', 'assets/adaptive-icon-female.png')):
    fg = foreground(src)
    full = framed(bg, fg)
    full.convert('RGB').save(f'assets/icon-adult{suffix}.png')
    full.convert('RGB').resize((192, 192), Image.LANCZOS).save(f'assets/icon-adult{suffix}-192.png')
    fg.resize((432, 432), Image.LANCZOS).save(f'assets/adaptive-icon-adult{suffix}-432.png')
    if suffix == '':
        full.convert('RGB').resize((192, 192), Image.LANCZOS).save('public/icon-adult-192.png')
        full.convert('RGB').resize((512, 512), Image.LANCZOS).save('public/icon-adult-512.png')
        full.convert('RGB').resize((180, 180), Image.LANCZOS).save('public/apple-touch-icon-adult.png')
        # maskable: no frame (the launcher masks it), hero inside the 80% safe zone
        mk = bg.copy()
        mk.alpha_composite(foreground(src, coin_d=540))
        mk.convert('RGB').resize((512, 512), Image.LANCZOS).save('public/icon-adult-maskable-512.png')
rays(216).convert('RGB').save('assets/adaptive-background-adult-216.png')
print('ok')
