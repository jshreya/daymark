from PIL import Image, ImageDraw
import math

INK = (23, 27, 36, 255)
AMBER = (227, 168, 87, 255)
PAPER = (237, 231, 218, 255)

def draw_icon(size, padding_ratio=0.0, maskable=False):
    img = Image.new("RGBA", (size, size), INK)
    draw = ImageDraw.Draw(img)

    pad = size * (0.22 if maskable else 0.16)
    cx, cy = size / 2, size / 2
    r = (size / 2) - pad

    # Arc (270 degrees, open at bottom-right) representing the "day arc"
    arc_bbox = [cx - r, cy - r, cx + r, cy + r]
    stroke_w = max(2, int(size * 0.055))
    draw.arc(arc_bbox, start=-225, end=45, fill=AMBER, width=stroke_w)

    # Dot marking "now" at the end of the arc
    angle_deg = 45
    angle_rad = math.radians(angle_deg)
    dot_x = cx + r * math.cos(angle_rad)
    dot_y = cy + r * math.sin(angle_rad)
    dot_r = size * 0.045
    draw.ellipse(
        [dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r],
        fill=PAPER,
    )

    return img

# Standard icons
draw_icon(192).save("icons/icon-192.png")
draw_icon(512).save("icons/icon-512.png")

# Maskable icon needs more internal padding since OS may crop to a circle/squircle
draw_icon(512, maskable=True).save("icons/icon-maskable-512.png")

# Apple touch icon (iOS ignores transparency, wants a flat background — already opaque here)
draw_icon(180).save("icons/apple-touch-icon.png")

print("Icons generated.")
