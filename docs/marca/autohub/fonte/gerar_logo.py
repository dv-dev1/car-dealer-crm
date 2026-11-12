import math, sys, pathlib
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

FONT = sys.argv[1]
OUT = pathlib.Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

f = TTFont(FONT)
f = instancer.instantiateVariableFont(f, {"wght": 700, "wdth": 125})
upem = f["head"].unitsPerEm
gs = f.getGlyphSet()
cmap = f.getBestCmap()
hmtx = f["hmtx"]

TRACK = -0.03 * upem
D = 0.56 * upem          # diametro externo do anel (0.56em, como no canvas)
MARGIN = 0.035 * upem

def glyph(ch):
    name = cmap[ord(ch)]
    pen = SVGPathPen(gs)
    gs[name].draw(pen)
    bp = BoundsPen(gs)
    gs[name].draw(bp)
    return name, pen.getCommands(), bp.bounds, hmtx[name][0]

def build(fill):
    parts = []
    x = 0.0
    xmin = None
    ymax = -1e9
    ymin = 1e9
    xmax = 0
    def add(ch):
        nonlocal x, xmin, ymax, ymin, xmax
        name, d, b, adv = glyph(ch)
        parts.append(("g", x, d))
        if xmin is None:
            xmin = x + b[0]
        ymax = max(ymax, b[3]); ymin = min(ymin, b[1])
        xmax = x + b[2]
        x += adv + TRACK
    for ch in "Aut":
        add(ch)
    x += MARGIN
    ring_x = x
    parts.append(("ring", ring_x, None))
    ymax = max(ymax, D); ymin = min(ymin, 0)
    xmax = ring_x + D
    x += D + MARGIN
    for ch in "Hub":
        add(ch)
    return parts, xmin, xmax, ymin, ymax

def ring_group(fill, px, py, d, ring_fill=None):
    # anel em caixa 100x100: r=38, traco 24, vao de 26 (de 238.76), girado -35 graus
    return (f'<g transform="translate({px:.2f} {py:.2f}) scale({d/100:.5f})">'
            f'<circle cx="50" cy="50" r="38" fill="none" stroke="{ring_fill or fill}" stroke-width="24" '
            f'stroke-dasharray="212.8 26" transform="rotate(-35 50 50)"/></g>')

def logo_svg(fill, title):
    parts, xmin, xmax, ymin, ymax = build(fill)
    w = xmax - xmin
    h = ymax - ymin
    base = ymax  # linha de base em y-baixo = ymax (topo do logo = 0)
    body = []
    for kind, x, d in parts:
        if kind == "g":
            body.append(f'<path transform="translate({x-xmin:.2f} {base:.2f}) scale(1 -1)" d="{d}"/>')
        else:
            body.append(ring_group(fill, x - xmin, base - D, D))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img" aria-label="{title}">\n'
            f'<title>{title}</title>\n<g fill="{fill}">\n' + "\n".join(body) + '\n</g>\n</svg>\n')

def ring_svg(fill, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="{title}">\n'
            f'<title>{title}</title>\n' + ring_group(fill, 0, 0, 100) + '\n</svg>\n')

def icon_svg(bg, fg, title):
    # quadrado 512, raio 117 (22/96), anel 266 (50/96) centralizado
    d = 512 * 50 / 96
    p = (512 - d) / 2
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="{title}">\n'
            f'<title>{title}</title>\n<rect width="512" height="512" rx="117" fill="{bg}"/>\n'
            + ring_group(fg, p, p, d) + '\n</svg>\n')

BRANCO, PRETO = "#f4f5f6", "#14161a"
files = {
    "autohub-logo-branco.svg": logo_svg(BRANCO, "AutoHub"),
    "autohub-logo-preto.svg": logo_svg(PRETO, "AutoHub"),
    "autohub-anel-branco.svg": ring_svg(BRANCO, "AutoHub"),
    "autohub-anel-preto.svg": ring_svg(PRETO, "AutoHub"),
    "autohub-icone-claro.svg": icon_svg(BRANCO, PRETO, "AutoHub"),
    "autohub-icone-escuro.svg": icon_svg(PRETO, BRANCO, "AutoHub"),
}
for n, c in files.items():
    (OUT / n).write_text(c, encoding="utf-8")
    print(n, len(c))
