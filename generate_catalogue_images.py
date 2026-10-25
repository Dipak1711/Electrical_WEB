#!/usr/bin/env python3
"""
Gurukrupa Electrical & Services - Complete Product Image Generator
Generates realistic, studio-quality, optimized WebP product images for all 190 catalogue items.
"""

import os
import math
import sqlite3
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOADS_DIR = os.path.join(DATA_DIR, 'uploads')
DB_FILE = os.path.join(DATA_DIR, 'gurukrupa.db')

os.makedirs(UPLOADS_DIR, exist_ok=True)

# Fonts
try:
    font_bold = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 16, index=1)
    font_reg = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 13, index=0)
    font_sm = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 11, index=0)
    font_title = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 22, index=1)
except Exception:
    font_bold = ImageFont.load_default()
    font_reg = font_bold
    font_sm = font_bold
    font_title = font_bold


def create_canvas():
    img = Image.new('RGB', (500, 500), '#f8fafc')
    draw = ImageDraw.Draw(img)
    # Subtle studio spotlight vignette
    for r in range(250, 40, -25):
        c = int(248 + (255 - 248) * (1 - r/250))
        draw.ellipse([250-r, 250-r, 250+r, 250+r], fill=(c, c+1, c+3))
    return img, draw


def add_shadow(draw, cx=250, cy=425, rx=130, ry=20, opacity=65):
    for i in range(10):
        factor = (10 - i) / 10
        r_x = rx * (0.65 + 0.35 * factor)
        r_y = ry * (0.65 + 0.35 * factor)
        c = int(248 - (248 - 212) * factor * (opacity / 100))
        draw.ellipse([cx - r_x, cy - r_y, cx + r_x, cy + r_y], fill=(c, c+2, c+5))


def add_badge(draw, p):
    text = ""
    brand = (p.get('brand') or '').strip()
    spec = (p.get('spec') or '').strip()
    name = (p.get('name') or '').strip()
    
    # Extract short spec if spec is long
    if spec:
        short_spec = spec.split(' - ')[0].split(',')[0].strip()
    else:
        # Try extracting numbers from name (e.g. 20 mm, 9W, 48")
        import re
        m = re.search(r'(\d+(?:\.\d+)?\s*(?:mm|sqmm|W|A|ft|"|M|Yard|V|mtr|inch))', name, re.IGNORECASE)
        short_spec = m.group(1) if m else ""

    if brand and short_spec:
        text = f"{brand} · {short_spec}"
    elif brand:
        text = brand
    elif short_spec:
        text = short_spec
    else:
        text = p.get('subcat', '')

    if not text:
        return

    # Truncate if too long
    if len(text) > 28:
        text = text[:26] + "…"

    bbox = font_reg.getbbox(text)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    
    bx = 500 - tw - 30
    by = 16
    bw = tw + 18
    bh = th + 12
    
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=8, fill='#ffffff', outline='#e2e8f0', width=1)
    draw.ellipse([bx + 7, by + bh//2 - 3, bx + 13, by + bh//2 + 3], fill='#a3201f')
    draw.text((bx + 16, by + 5), text, fill='#1e293b', font=font_reg)


# ==============================================================================
# SUB-CATEGORY RENDERERS
# ==============================================================================

def render_pica_conduit(draw, p):
    # Corrugated flexible conduit pipe (black / dark charcoal)
    add_shadow(draw, 250, 420, 160, 24)
    # Draw curved corrugated tube loop
    # Base curved path with ribs
    center_x, center_y = 250, 240
    outer_r = 140
    inner_r = 85
    
    # Outer coil loop
    num_ribs = 48
    for i in range(num_ribs):
        angle = math.pi * 0.15 + (i / num_ribs) * math.pi * 1.7
        x = center_x + math.cos(angle) * 115
        y = center_y + math.sin(angle) * 105
        # draw rib segment
        r_w = 18
        col_main = '#26292e' if i % 2 == 0 else '#373c44'
        col_high = '#474f5a' if i % 2 == 0 else '#1f2226'
        draw.ellipse([x - r_w, y - r_w, x + r_w, y + r_w], fill=col_main, outline=col_high, width=1)
    
    # Cut end opening showing pipe caliber
    ex, ey = 145, 330
    draw.ellipse([ex - 22, ey - 18, ex + 22, ey + 18], fill='#181a1d', outline='#4a5568', width=2)
    draw.ellipse([ex - 15, ey - 12, ex + 15, ey + 12], fill='#0b0d0e')
    # White caliber text
    import re
    m = re.search(r'(\d+)\s*mm', p['name'])
    size_str = (m.group(1) + ' mm') if m else "20 mm"
    draw.text((220, 235), "PICA CONDUIT\n" + size_str, fill='#94a3b8', font=font_bold, align='center')


def sbox(x0, y0, x1, y1):
    return [min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)]


def render_pvc_pipe(draw, p):
    # Smooth rigid PVC conduit pipes
    is_grey = 'grey' in p['name'].lower() or 'gray' in (p.get('spec') or '').lower()
    pipe_col = '#64748b' if is_grey else '#f8fafc'
    outline_col = '#475569' if is_grey else '#cbd5e1'
    highlight_col = '#94a3b8' if is_grey else '#ffffff'
    
    add_shadow(draw, 250, 420, 170, 22)
    # Three pipes grouped cleanly
    for offset, scale in [(-35, 0.9), (35, 0.9), (0, 1.0)]:
        x1, y1 = 100 + offset, 380 - offset*0.2
        x2, y2 = 400 + offset, 110 - offset*0.2
        # Main pipe shaft
        w = 26 * scale
        dx, dy = abs((y2 - y1) / 350 * w), abs(-(x2 - x1) / 350 * w)
        pts = [(x1 - dx, y1 + dy*0.1), (x2 - dx, y2 - dy*0.1), (x2 + dx, y2 + dy*0.1), (x1 + dx, y1 - dy*0.1)]
        draw.polygon(pts, fill=pipe_col, outline=outline_col)
        # Highlight stripe
        draw.line([(x1 - dx*0.2, y1), (x2 - dx*0.2, y2)], fill=highlight_col, width=int(5*scale))
        # Top cut oval
        draw.ellipse(sbox(x2 - dx, y2 - dy*0.6, x2 + dx, y2 + dy*0.6), fill='#e2e8f0' if not is_grey else '#475569', outline=outline_col)
        draw.ellipse(sbox(x2 - dx*0.7, y2 - dy*0.4, x2 + dx*0.7, y2 + dy*0.4), fill='#334155' if is_grey else '#1e293b')
    
    label = "PVC CONDUIT " + ('GREY' if is_grey else 'WHITE')
    draw.text((150, 435), label, fill='#64748b', font=font_sm)



def render_pvc_fitting(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 415, 120, 22)
    
    if 'elbow' in name:
        # 90 deg elbow bend
        # Corner outer arc
        draw.pieslice([140, 140, 380, 380], 90, 180, fill='#ffffff', outline='#cbd5e1', width=3)
        draw.pieslice([190, 190, 380, 380], 90, 180, fill='#f8fafc', outline='#cbd5e1', width=2)
        # Sockets
        # Horizontal socket
        draw.rounded_rectangle([130, 260, 200, 335], radius=6, fill='#ffffff', outline='#cbd5e1', width=2)
        draw.ellipse([125, 260, 145, 335], fill='#e2e8f0', outline='#94a3b8')
        draw.ellipse([128, 275, 142, 320], fill='#334155')
        # Vertical socket
        draw.rounded_rectangle([260, 130, 335, 200], radius=6, fill='#ffffff', outline='#cbd5e1', width=2)
        draw.ellipse([260, 125, 335, 145], fill='#e2e8f0', outline='#94a3b8')
        draw.ellipse([275, 128, 320, 142], fill='#334155')
    elif 'tee' in name:
        # T-junction
        # Horizontal run
        draw.rounded_rectangle([110, 230, 390, 305], radius=8, fill='#ffffff', outline='#cbd5e1', width=3)
        # Vertical branch
        draw.rounded_rectangle([212, 130, 288, 260], radius=8, fill='#ffffff', outline='#cbd5e1', width=3)
        # Center seam blending
        draw.rectangle([214, 231, 286, 290], fill='#ffffff')
        # Sockets openings
        draw.ellipse([105, 230, 125, 305], fill='#e2e8f0', outline='#94a3b8')
        draw.ellipse([108, 245, 122, 290], fill='#334155')
        draw.ellipse([375, 230, 395, 305], fill='#e2e8f0', outline='#94a3b8')
        draw.ellipse([378, 245, 392, 290], fill='#334155')
        draw.ellipse([212, 125, 288, 145], fill='#e2e8f0', outline='#94a3b8')
        draw.ellipse([227, 128, 273, 142], fill='#334155')
    else:
        # Junction Box
        # Round circular base with 4 spouts
        # 4 spouts
        draw.rectangle([225, 110, 275, 390], fill='#ffffff', outline='#cbd5e1', width=2)
        draw.rectangle([110, 225, 390, 275], fill='#ffffff', outline='#cbd5e1', width=2)
        # Center round body
        draw.ellipse([160, 160, 340, 340], fill='#ffffff', outline='#cbd5e1', width=3)
        # Lid seam
        draw.ellipse([175, 175, 325, 325], fill='#f8fafc', outline='#94a3b8', width=1)
        # Center screws
        draw.ellipse([195, 245, 207, 257], fill='#cbd5e1', outline='#64748b')
        draw.ellipse([293, 245, 305, 257], fill='#cbd5e1', outline='#64748b')


def render_casing_patti(draw, p):
    # PVC Casing & Capping channel
    add_shadow(draw, 250, 425, 150, 20)
    # Draw rectangular profile in perspective
    draw.polygon([(120, 360), (380, 240), (380, 150), (120, 270)], fill='#ffffff', outline='#cbd5e1', width=2)
    # Base channel side
    draw.polygon([(120, 270), (380, 150), (360, 140), (100, 260)], fill='#f1f5f9', outline='#cbd5e1', width=2)
    # Snap lid highlight
    draw.line([(120, 295), (380, 175)], fill='#cbd5e1', width=2)
    # Front cross-section opening showing U-base + top cap
    draw.polygon([(90, 380), (120, 360), (120, 270), (90, 290)], fill='#e2e8f0', outline='#94a3b8', width=2)
    # Brand text along patti
    brand_txt = p.get('brand') or 'PVC CASING'
    draw.text((180, 300), f"★★★ {brand_txt.upper()} 25MM ★★★", fill='#94a3b8', font=font_sm)


def render_casing_fitting(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 110, 20)
    if 'elbow' in name:
        # Flat L bend
        draw.polygon([(150, 350), (350, 350), (350, 270), (230, 270), (230, 150), (150, 150)], fill='#ffffff', outline='#cbd5e1', width=3)
        draw.line([(150, 150), (230, 270)], fill='#e2e8f0', width=2)
    elif 'tee' in name:
        # Flat T fitting
        draw.polygon([(130, 330), (370, 330), (370, 250), (290, 250), (290, 160), (210, 160), (210, 250), (130, 250)], fill='#ffffff', outline='#cbd5e1', width=3)
    elif 'internal' in name or 'external' in name:
        # 3D corner angle
        draw.polygon([(170, 170), (250, 130), (330, 170), (330, 330), (250, 370), (170, 330)], fill='#ffffff', outline='#cbd5e1', width=3)
        draw.line([(250, 130), (250, 370)], fill='#cbd5e1', width=2)
    else:
        # Casing Junction Box square
        draw.rounded_rectangle([160, 160, 340, 340], radius=14, fill='#ffffff', outline='#cbd5e1', width=3)
        # 4 way entry notches
        draw.rectangle([230, 148, 270, 165], fill='#f1f5f9', outline='#cbd5e1')
        draw.rectangle([230, 335, 270, 352], fill='#f1f5f9', outline='#cbd5e1')
        draw.rectangle([148, 230, 165, 270], fill='#f1f5f9', outline='#cbd5e1')
        draw.rectangle([335, 230, 352, 270], fill='#f1f5f9', outline='#cbd5e1')
        draw.ellipse([240, 240, 260, 260], fill='#e2e8f0', outline='#94a3b8')


def render_saddle_clamp(draw, p):
    # Metal galvanized C-Clamp / China Saddle
    add_shadow(draw, 250, 420, 130, 20)
    # Semicircular arch with two mounting ears
    # Left ear
    draw.rounded_rectangle([110, 320, 190, 355], radius=6, fill='#cbd5e1', outline='#64748b', width=2)
    draw.ellipse([135, 330, 155, 346], fill='#475569')
    # Right ear
    draw.rounded_rectangle([310, 320, 390, 355], radius=6, fill='#cbd5e1', outline='#64748b', width=2)
    draw.ellipse([345, 330, 365, 346], fill='#475569')
    # Arch
    draw.arc([160, 170, 340, 350], 180, 360, fill='#94a3b8', width=32)
    draw.arc([160, 170, 340, 350], 180, 360, fill='#e2e8f0', width=26)
    # Stamped mm size
    import re
    m = re.search(r'(\d+)\s*mm', p['name'])
    size = (m.group(1) + 'mm') if m else "20mm"
    draw.text((230, 230), size, fill='#475569', font=font_bold)


def render_cable_tie(draw, p):
    # Bundle of white nylon zip cable ties
    add_shadow(draw, 250, 430, 140, 22)
    # Draw spray of ties
    for i in range(-5, 6):
        angle = i * 2.5
        x1 = 250 + i * 8
        y1 = 400
        x2 = 250 + i * 16
        y2 = 140
        draw.line([(x1, y1), (x2, y2)], fill='#f1f5f9', width=6)
        draw.line([(x1, y1), (x2, y2)], fill='#ffffff', width=4)
        # Head of tie
        draw.rounded_rectangle([x2-8, y2-8, x2+8, y2+4], radius=2, fill='#ffffff', outline='#cbd5e1', width=1)
        draw.rectangle([x2-3, y2-4, x2+3, y2], fill='#64748b')
    # Holding band in center
    draw.rounded_rectangle([180, 280, 320, 315], radius=4, fill='#3b82f6', outline='#1d4ed8', width=2)
    draw.text((200, 290), "NYLON TIES 100 PCS", fill='#ffffff', font=font_sm)


def render_insulation_tape(draw, p):
    # Roll of PVC insulation tape
    is_red = 'red' in p.get('spec', '').lower()
    is_waterproof = 'water' in p['name'].lower()
    tape_col = '#1e293b' if not is_red else '#dc2626'
    if is_waterproof:
        tape_col = '#0f172a'
    
    add_shadow(draw, 250, 420, 140, 24)
    # Tape cylinder
    # Outer circle
    draw.ellipse([140, 160, 360, 380], fill=tape_col, outline='#475569', width=2)
    # Inner cardboard spool
    draw.ellipse([200, 220, 300, 320], fill='#e2e8f0', outline='#94a3b8', width=2)
    draw.ellipse([215, 235, 285, 305], fill='#f8fafc', outline='#cbd5e1', width=1)
    # Center hole
    draw.ellipse([235, 255, 265, 285], fill='#1e293b')
    # Label inside spool
    brand = p.get('brand') or ('WATERPROOF' if is_waterproof else 'PVC TAPE')
    draw.text((220, 290), brand[:6], fill='#dc2626' if not is_red else '#2563eb', font=font_sm)


def render_connector_strip(draw, p):
    # 12-way terminal block strip
    add_shadow(draw, 250, 415, 160, 20)
    # Base body (translucent PE)
    draw.rounded_rectangle([90, 210, 410, 300], radius=8, fill='#f1f5f9', outline='#cbd5e1', width=2)
    # 12 compartments
    for i in range(12):
        bx = 95 + i * 26
        draw.line([(bx, 210), (bx, 300)], fill='#cbd5e1', width=1)
        # Brass screws inside
        draw.ellipse([bx + 4, 222, bx + 20, 238], fill='#f59e0b', outline='#b45309', width=1)
        draw.line([(bx + 7, 230), (bx + 17, 230)], fill='#78350f', width=2)
        draw.ellipse([bx + 4, 270, bx + 20, 286], fill='#f59e0b', outline='#b45309', width=1)
        draw.line([(bx + 7, 278), (bx + 17, 278)], fill='#78350f', width=2)
    # Amp rating
    rating = "16A" if '16' in p['name'] else "10A"
    draw.text((225, 320), f"STRIP {rating}", fill='#64748b', font=font_bold)


def render_ceiling_fan(draw, p):
    # 3-blade aerodynamic ceiling fan
    is_design = 'design' in p['name'].lower() or 'design' in (p.get('spec') or '').lower()
    is_orient = 'orient' in (p.get('brand') or '').lower()
    
    fan_color = '#78350f' if is_orient else '#f8fafc'
    fan_outline = '#451a03' if is_orient else '#cbd5e1'
    accent_col = '#f59e0b'
    
    add_shadow(draw, 250, 420, 160, 26)
    
    cx, cy = 250, 250
    # 3 Aerofoil Blades
    for i in range(3):
        angle = math.radians(i * 120 - 90)
        bx = cx + math.cos(angle) * 160
        by = cy + math.sin(angle) * 135
        # draw blade polygon
        perp = angle + math.pi/2
        w1, w2 = 18, 38
        p1 = (cx + math.cos(perp)*w1, cy + math.sin(perp)*w1)
        p2 = (bx + math.cos(perp)*w2, by + math.sin(perp)*w2)
        p3 = (bx - math.cos(perp)*w2, by - math.sin(perp)*w2)
        p4 = (cx - math.cos(perp)*w1, cy - math.sin(perp)*w1)
        draw.polygon([p1, p2, p3, p4], fill=fan_color, outline=fan_outline, width=2)
        if is_design:
            # Decorative gold trim line
            draw.line([(p1[0]*0.4 + p2[0]*0.6, p1[1]*0.4 + p2[1]*0.6), (p4[0]*0.4 + p3[0]*0.6, p4[1]*0.4 + p3[1]*0.6)], fill=accent_col, width=3)
    
    # Motor body central housing
    draw.ellipse([cx - 52, cy - 52, cx + 52, cy + 52], fill=fan_color, outline=fan_outline, width=3)
    draw.ellipse([cx - 40, cy - 40, cx + 40, cy + 40], fill='#e2e8f0' if not is_orient else '#92400e', outline=accent_col if is_design else fan_outline, width=2)
    # Downrod cap
    draw.rectangle([cx - 14, cy - 85, cx + 14, cy - 40], fill=fan_color, outline=fan_outline, width=2)
    draw.ellipse([cx - 14, cy - 92, cx + 14, cy - 78], fill=fan_color, outline=fan_outline, width=2)


def render_portable_fan(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 425, 130, 22)
    
    if 'table' in name:
        # Table fan with oval base & grill
        # Base
        draw.ellipse([180, 360, 320, 415], fill='#f1f5f9', outline='#94a3b8', width=2)
        # Speed buttons
        for i in range(3):
            draw.ellipse([215 + i*25, 382, 230 + i*25, 397], fill='#3b82f6' if i==1 else '#cbd5e1')
        # Stand neck
        draw.polygon([(240, 270), (260, 270), (265, 375), (235, 375)], fill='#cbd5e1', outline='#64748b')
        # Cage grill
        draw.ellipse([140, 100, 360, 320], fill='#ffffff', outline='#64748b', width=3)
        # Blades inside
        for a in [0, 120, 240]:
            rad = math.radians(a)
            draw.ellipse([250 + math.cos(rad)*35 - 20, 210 + math.sin(rad)*35 - 20, 250 + math.cos(rad)*35 + 20, 210 + math.sin(rad)*35 + 20], fill='#93c5fd')
        # Spoke radial lines
        for a in range(0, 360, 30):
            rad = math.radians(a)
            draw.line([(250, 210), (250 + math.cos(rad)*105, 210 + math.sin(rad)*105)], fill='#cbd5e1', width=1)
        # Center logo dome
        draw.ellipse([225, 185, 275, 235], fill='#1e293b', outline='#e2e8f0', width=2)
    elif 'pedestal' in name:
        # Tall standing pedestal fan
        draw.ellipse([190, 390, 310, 430], fill='#1e293b', outline='#64748b', width=2)
        draw.rectangle([244, 210, 256, 400], fill='#94a3b8', outline='#475569', width=1)
        # Cage
        draw.ellipse([160, 80, 340, 260], fill='#ffffff', outline='#475569', width=3)
        # Radial spokes
        for a in range(0, 360, 30):
            rad = math.radians(a)
            draw.line([(250, 170), (250 + math.cos(rad)*85, 170 + math.sin(rad)*85)], fill='#cbd5e1', width=1)
        draw.ellipse([230, 150, 270, 190], fill='#1e293b')
    else:
        # Wall Fan
        # Bracket
        draw.rectangle([230, 290, 270, 380], fill='#e2e8f0', outline='#94a3b8', width=2)
        # Pull cords
        draw.line([(240, 380), (240, 430)], fill='#64748b', width=2)
        draw.ellipse([236, 428, 244, 436], fill='#dc2626')
        draw.line([(260, 380), (260, 420)], fill='#64748b', width=2)
        draw.ellipse([256, 418, 264, 426], fill='#2563eb')
        # Cage
        draw.ellipse([150, 90, 350, 290], fill='#ffffff', outline='#64748b', width=3)
        for a in range(0, 360, 30):
            rad = math.radians(a)
            draw.line([(250, 190), (250 + math.cos(rad)*95, 190 + math.sin(rad)*95)], fill='#cbd5e1', width=1)
        draw.ellipse([230, 170, 270, 210], fill='#1e293b')


def render_exhaust_fan(draw, p):
    # Heavy exhaust fan with square frame & central fan rotor
    add_shadow(draw, 250, 420, 130, 22)
    # Square outer mounting frame
    draw.rounded_rectangle([130, 130, 370, 370], radius=14, fill='#f8fafc', outline='#94a3b8', width=3)
    # 4 Corner mounting holes
    for hx, hy in [(155, 155), (345, 155), (155, 345), (345, 345)]:
        draw.ellipse([hx-6, hy-6, hx+6, hy+6], fill='#cbd5e1', outline='#64748b')
    # Circular intake port
    draw.ellipse([160, 160, 340, 340], fill='#1e293b', outline='#64748b', width=2)
    # 4 Heavy metal aerofoil blades
    for a in [0, 90, 180, 270]:
        rad = math.radians(a + 25)
        bx = 250 + math.cos(rad) * 65
        by = 250 + math.sin(rad) * 65
        draw.ellipse([bx-25, by-25, bx+25, by+25], fill='#94a3b8', outline='#cbd5e1', width=1)
    # Motor hub
    draw.ellipse([220, 220, 280, 280], fill='#475569', outline='#e2e8f0', width=2)


def render_fan_accessory(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 120, 20)
    
    if 'pipe' in name:
        # Fan downrod pipe
        draw.rounded_rectangle([230, 100, 270, 380], radius=6, fill='#ffffff', outline='#94a3b8', width=2)
        # Highlight
        draw.line([(242, 110), (242, 370)], fill='#e2e8f0', width=4)
        # Cotter pin cross-holes
        draw.ellipse([243, 125, 257, 139], fill='#334155')
        draw.ellipse([243, 345, 257, 359], fill='#334155')
    elif 'hook' in name:
        # J-Hook
        draw.arc([180, 220, 320, 360], 0, 180, fill='#94a3b8', width=24)
        draw.rectangle([296, 120, 320, 290], fill='#cbd5e1', outline='#64748b', width=2)
        # Threaded top
        for y in range(120, 180, 6):
            draw.line([(290, y), (326, y)], fill='#475569', width=2)
    elif 'rubber' in name:
        # Rubber clamp
        draw.rounded_rectangle([180, 200, 320, 340], radius=16, fill='#1e293b', outline='#0f172a', width=3)
        draw.ellipse([225, 245, 275, 295], fill='#f8fafc', outline='#475569', width=2)
    else:
        # Fan clamp fastener
        draw.arc([190, 170, 310, 290], 180, 360, fill='#cbd5e1', width=26)
        # Bolt tabs
        draw.rectangle([190, 230, 216, 350], fill='#94a3b8', outline='#475569', width=2)
        draw.rectangle([284, 230, 310, 350], fill='#94a3b8', outline='#475569', width=2)
        # Hex bolts
        draw.ellipse([195, 270, 211, 286], fill='#475569')
        if 'double' in name:
            draw.ellipse([195, 315, 211, 331], fill='#475569')


def render_fan_capacitor(draw, p):
    # Cylindrical motor run capacitor with twin leads
    add_shadow(draw, 250, 420, 110, 20)
    # Twin wire leads coming from top
    draw.line([(235, 80), (235, 170)], fill='#dc2626', width=5)
    draw.line([(265, 80), (265, 170)], fill='#1e293b', width=5)
    # Top neck seal
    draw.ellipse([200, 155, 300, 185], fill='#94a3b8', outline='#64748b', width=2)
    # Main cylinder
    draw.rounded_rectangle([200, 170, 300, 380], radius=10, fill='#ffffff', outline='#cbd5e1', width=2)
    # Spec text on capacitor
    m = '3.15 µF' if '3.15' in p['name'] else '2.5 µF'
    t = 'OIL' if 'oil' in p['name'].lower() else 'PAPER'
    draw.text((215, 220), f"CAPACITOR\n{m} ±5%\n440V AC\n50 Hz\n{t} TYPE", fill='#1e293b', font=font_sm, align='center')


def render_gi_box(draw, p):
    # Galvanized iron concealed metal box
    add_shadow(draw, 250, 420, 140, 22)
    # Metal box in perspective
    draw.rounded_rectangle([130, 160, 370, 370], radius=8, fill='#94a3b8', outline='#475569', width=2)
    draw.rounded_rectangle([150, 180, 350, 350], radius=6, fill='#cbd5e1', outline='#64748b', width=1)
    # Stamped circular knockouts
    for kx, ky in [(200, 230), (300, 230), (200, 300), (300, 300)]:
        draw.ellipse([kx-18, ky-18, kx+18, ky+18], fill='#94a3b8', outline='#475569', width=2)
        draw.line([(kx-18, ky), (kx+18, ky)], fill='#64748b', width=1)
    # Brass earthing screw
    draw.ellipse([240, 190, 256, 206], fill='#f59e0b', outline='#b45309')
    draw.text((220, 375), "GI CONCEALED", fill='#64748b', font=font_sm)


def render_modular_surface_box(draw, p):
    # Glossy white modular PVC surface gang box
    add_shadow(draw, 250, 420, 130, 22)
    draw.rounded_rectangle([140, 150, 360, 360], radius=16, fill='#ffffff', outline='#cbd5e1', width=3)
    draw.rounded_rectangle([165, 175, 335, 335], radius=10, fill='#f8fafc', outline='#e2e8f0', width=2)
    # Brass threaded fixing inserts on pillars
    for ix, iy in [(180, 255), (320, 255)]:
        draw.ellipse([ix-7, iy-7, ix+7, iy+7], fill='#f59e0b', outline='#b45309', width=1)
        draw.ellipse([ix-3, iy-3, ix+3, iy+3], fill='#1e293b')
    draw.text((215, 245), "RAPID BOX", fill='#94a3b8', font=font_sm)


def render_cover_plate(draw, p):
    add_shadow(draw, 250, 420, 120, 20)
    # Round plate or dummy plate
    if 'round' in p['name'].lower() or 'button' in p['name'].lower():
        draw.ellipse([150, 150, 350, 350], fill='#ffffff', outline='#cbd5e1', width=3)
        draw.ellipse([215, 215, 285, 285], fill='#f8fafc', outline='#e2e8f0', width=2)
        draw.ellipse([240, 240, 260, 260], fill='#334155')
    else:
        draw.rounded_rectangle([150, 150, 350, 350], radius=12, fill='#ffffff', outline='#cbd5e1', width=3)
        draw.text((220, 240), "BLANK PLATE", fill='#94a3b8', font=font_sm)


def render_pvc_switch_board(draw, p):
    # Pre-cut switch board
    add_shadow(draw, 250, 420, 140, 22)
    draw.rounded_rectangle([120, 170, 380, 350], radius=12, fill='#ffffff', outline='#cbd5e1', width=3)
    # Cutout apertures
    # Left cutout (switch)
    draw.rounded_rectangle([160, 210, 230, 310], radius=4, fill='#1e293b')
    # Right cutout (socket)
    draw.ellipse([280, 225, 340, 285], fill='#1e293b')
    draw.ellipse([295, 290, 325, 320], fill='#1e293b')


def render_extension_board(draw, p):
    # Multi-socket power strip with coiled cord
    add_shadow(draw, 250, 420, 150, 22)
    # Strip body
    draw.rounded_rectangle([120, 200, 380, 320], radius=12, fill='#ffffff', outline='#cbd5e1', width=3)
    # 4 Sockets + Switches
    for i in range(3):
        sx = 145 + i * 75
        # Switch
        draw.rounded_rectangle([sx, 220, sx+25, 255], radius=3, fill='#dc2626')
        # Socket (3 pin)
        draw.ellipse([sx+40, 225, sx+52, 237], fill='#1e293b')
        draw.ellipse([sx+34, 243, sx+44, 253], fill='#1e293b')
        draw.ellipse([sx+48, 243, sx+58, 253], fill='#1e293b')
    # Coiled cord on left
    draw.arc([70, 160, 140, 240], 90, 270, fill='#94a3b8', width=8)
    draw.arc([60, 210, 130, 290], 90, 270, fill='#94a3b8', width=8)


def render_modular_switch(draw, p):
    # Modern white modular switch with rocker paddle
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 120, 22)
    
    # Outer modular frame
    draw.rounded_rectangle([160, 140, 340, 360], radius=14, fill='#ffffff', outline='#cbd5e1', width=3)
    draw.rounded_rectangle([185, 165, 315, 335], radius=8, fill='#f1f5f9', outline='#e2e8f0', width=1)
    
    if 'bell' in name:
        # Bell push switch
        draw.rounded_rectangle([195, 175, 305, 325], radius=6, fill='#ffffff', outline='#cbd5e1', width=2)
        # Bell icon
        draw.arc([235, 220, 265, 260], 180, 360, fill='#1e293b', width=3)
        draw.line([(230, 260), (270, 260)], fill='#1e293b', width=3)
        draw.ellipse([246, 265, 254, 273], fill='#1e293b')
    elif 'indicator' in name:
        # Red neon indicator
        draw.rounded_rectangle([210, 210, 290, 290], radius=8, fill='#dc2626', outline='#b91c1c', width=2)
        draw.ellipse([235, 235, 265, 265], fill='#fca5a5')
    elif 'bed' in name:
        # Pear / torpedo inline switch
        draw.ellipse([180, 160, 320, 340], fill='#ffffff', outline='#cbd5e1', width=3)
        draw.rounded_rectangle([225, 210, 275, 290], radius=6, fill='#dc2626')
    else:
        # Rocker switch
        draw.rounded_rectangle([195, 175, 305, 325], radius=6, fill='#ffffff', outline='#cbd5e1', width=2)
        # Rocker divide line
        draw.line([(195, 250), (305, 250)], fill='#cbd5e1', width=2)
        # Red ON dot / stripe
        draw.ellipse([245, 225, 255, 235], fill='#dc2626')
        amp = '20A' if '20' in name else ('16A' if '16' in name else ('10A' if '10' in name else '6A'))
        draw.text((238, 280), amp, fill='#94a3b8', font=font_sm)


def render_fan_regulator(draw, p):
    # Modular rotary step dimmer
    add_shadow(draw, 250, 420, 120, 22)
    draw.rounded_rectangle([170, 150, 330, 350], radius=14, fill='#ffffff', outline='#cbd5e1', width=3)
    # Rotary knob
    draw.ellipse([200, 190, 300, 290], fill='#f8fafc', outline='#94a3b8', width=2)
    # Dial numbers
    for i in range(6):
        ang = math.radians(140 + i * 50)
        nx = 250 + math.cos(ang) * 62
        ny = 240 + math.sin(ang) * 62
        draw.text((nx-4, ny-6), str(i), fill='#475569', font=font_sm)
    # Knob pointer indicator
    draw.line([(250, 240), (250, 205)], fill='#2563eb', width=4)


def render_modular_socket(draw, p):
    # 3-Pin shuttered modular socket
    add_shadow(draw, 250, 420, 120, 22)
    draw.rounded_rectangle([160, 150, 340, 350], radius=14, fill='#ffffff', outline='#cbd5e1', width=3)
    draw.rounded_rectangle([180, 170, 320, 330], radius=8, fill='#f1f5f9', outline='#e2e8f0', width=1)
    # Earth pin hole (top)
    draw.ellipse([238, 195, 262, 219], fill='#1e293b', outline='#64748b', width=2)
    # Live & Neutral holes with red safety shutters
    draw.ellipse([205, 255, 225, 275], fill='#dc2626', outline='#64748b', width=2)
    draw.ellipse([275, 255, 295, 275], fill='#dc2626', outline='#64748b', width=2)
    amp = '16A' if '16' in p['name'] else '6A'
    draw.text((238, 295), amp, fill='#94a3b8', font=font_bold)


def render_plug_top_adapter(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 120, 22)
    
    if '3 pin' in name or 'top' in name:
        # 3-pin plug top (Indian round pins)
        draw.rounded_rectangle([170, 190, 330, 340], radius=18, fill='#ffffff', outline='#cbd5e1', width=3)
        # Brass solid pins extending downwards in perspective
        draw.rounded_rectangle([240, 120, 260, 190], radius=5, fill='#f59e0b', outline='#b45309', width=2) # Earth
        draw.rounded_rectangle([190, 135, 208, 190], radius=4, fill='#f59e0b', outline='#b45309', width=2) # N
        draw.rounded_rectangle([292, 135, 310, 190], radius=4, fill='#f59e0b', outline='#b45309', width=2) # L
        # Cord entry boot
        draw.rectangle([235, 340, 265, 385], fill='#1e293b')
        amp = '16A' if '16' in name else '6A'
        draw.text((238, 260), amp, fill='#94a3b8', font=font_bold)
    elif 'adapter' in name:
        # Multi adapter
        draw.rounded_rectangle([170, 160, 330, 340], radius=14, fill='#ffffff', outline='#cbd5e1', width=3)
        draw.ellipse([240, 190, 260, 210], fill='#1e293b')
        draw.ellipse([210, 240, 226, 256], fill='#1e293b')
        draw.ellipse([274, 240, 290, 256], fill='#1e293b')
        # Red switch on top
        draw.rounded_rectangle([230, 280, 270, 315], radius=3, fill='#dc2626')
    else:
        # 2-pin plug
        draw.rounded_rectangle([185, 200, 315, 330], radius=14, fill='#ffffff', outline='#cbd5e1', width=3)
        draw.rounded_rectangle([210, 140, 226, 200], radius=4, fill='#f59e0b', outline='#b45309', width=2)
        draw.rounded_rectangle([274, 140, 290, 200], radius=4, fill='#f59e0b', outline='#b45309', width=2)


def render_switch_socket_combo(draw, p):
    # Integrated Switch + Socket combine unit
    add_shadow(draw, 250, 420, 150, 22)
    draw.rounded_rectangle([120, 160, 380, 340], radius=14, fill='#ffffff', outline='#cbd5e1', width=3)
    # Switch on left
    draw.rounded_rectangle([145, 185, 225, 315], radius=6, fill='#f8fafc', outline='#cbd5e1', width=2)
    draw.ellipse([180, 205, 190, 215], fill='#dc2626')
    # Socket on right
    draw.ellipse([290, 195, 310, 215], fill='#1e293b')
    draw.ellipse([265, 245, 281, 261], fill='#1e293b')
    draw.ellipse([319, 245, 335, 261], fill='#1e293b')
    draw.text((285, 285), "16A", fill='#94a3b8', font=font_bold)


def render_door_bell(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 120, 22)
    
    if 'water' in name:
        # Water level indicator bell
        draw.rounded_rectangle([160, 140, 340, 360], radius=14, fill='#ffffff', outline='#cbd5e1', width=3)
        # Water wave droplet graphic
        draw.pieslice([220, 180, 280, 250], 0, 360, fill='#3b82f6')
        draw.text((180, 270), "WATER TANK ALARM", fill='#1e293b', font=font_sm)
        # Buzzer grill
        for i in range(4):
            draw.line([(200, 305 + i*8), (300, 305 + i*8)], fill='#cbd5e1', width=3)
    else:
        # Ding Dong / Bull Bull chime
        draw.rounded_rectangle([170, 120, 330, 380], radius=12, fill='#ffffff', outline='#cbd5e1', width=3)
        # Decorative metallic gold accent band
        draw.rectangle([170, 220, 330, 245], fill='#f59e0b')
        # Sound louvre slats
        for i in range(6):
            draw.line([(195, 270 + i*14), (305, 270 + i*14)], fill='#cbd5e1', width=3)
        draw.text((215, 160), "DOOR CHIME", fill='#64748b', font=font_sm)


def render_mcb(draw, p):
    # Miniature Circuit Breaker (Schneider Electric style)
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 140, 22)
    
    poles = 1
    if 'dp' in name or 'double' in name:
        poles = 2
    elif 'tpn' in name or 'three' in name:
        poles = 3
    
    width_per_pole = 55
    total_w = poles * width_per_pole
    start_x = 250 - total_w // 2
    
    # Outer light grey body
    for i in range(poles):
        px = start_x + i * width_per_pole
        draw.rounded_rectangle([px, 130, px + width_per_pole - 2, 370], radius=4, fill='#f1f5f9', outline='#94a3b8', width=2)
        # Top terminal screw
        draw.ellipse([px + 18, 140, px + 34, 156], fill='#64748b')
        # Bottom terminal screw
        draw.ellipse([px + 18, 344, px + 34, 360], fill='#64748b')
        # Arc chute cooling ribs
        for y in range(300, 335, 7):
            draw.line([(px + 10, y), (px + 42, y)], fill='#cbd5e1', width=2)
    
    # Operating toggle lever (orange / red for Schneider)
    draw.rounded_rectangle([start_x + 8, 210, start_x + total_w - 10, 255], radius=6, fill='#ea580c', outline='#c2410c', width=2)
    
    # Rating text
    import re
    m = re.search(r'(\d+)\s*A', p['name'])
    amp = (m.group(1) + 'A') if m else "C32"
    draw.text((start_x + 6, 270), f"Schneider\nC{amp}\n10000", fill='#1e293b', font=font_sm)


def render_lamp_holder(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 110, 20)
    
    if 'pendent' in name or 'pendant' in name:
        # Hanging pendant holder
        # Cord grip cap
        draw.rounded_rectangle([230, 130, 270, 180], radius=6, fill='#1e293b')
        # Main holder body
        draw.ellipse([200, 180, 300, 250], fill='#ffffff', outline='#cbd5e1', width=3)
        draw.rectangle([200, 215, 300, 310], fill='#ffffff', outline='#cbd5e1', width=3)
        # Brass bayonet pins
        draw.ellipse([210, 300, 290, 340], fill='#e2e8f0', outline='#94a3b8', width=2)
        draw.ellipse([220, 310, 280, 330], fill='#f59e0b')
    else:
        # Multi / Batten holder with side socket
        draw.rounded_rectangle([180, 180, 320, 330], radius=14, fill='#ffffff', outline='#cbd5e1', width=3)
        # Angled bulb socket
        draw.ellipse([210, 200, 290, 260], fill='#f59e0b', outline='#b45309', width=2)
        # 2-pin side socket
        draw.ellipse([230, 285, 245, 300], fill='#1e293b')
        draw.ellipse([255, 285, 270, 300], fill='#1e293b')


def render_panel_light(draw, p):
    # LED Panel / Surface light
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 150, 22)
    
    # Outer white aluminum rim
    draw.ellipse([120, 120, 380, 380], fill='#ffffff', outline='#cbd5e1', width=3)
    # Frosted diffuse luminous panel
    draw.ellipse([145, 145, 355, 355], fill='#fefce8', outline='#fef08a', width=2)
    # Subtle glowing center
    draw.ellipse([180, 180, 320, 320], fill='#ffffff')
    
    # Wattage marking
    import re
    m = re.search(r'(\d+)\s*W', p['name'])
    watt = (m.group(1) + 'W') if m else "15W"
    draw.text((235, 240), watt, fill='#94a3b8', font=font_bold)
    
    if 'panel' in name:
        # Side spring clips
        draw.rectangle([95, 245, 120, 255], fill='#f59e0b')
        draw.rectangle([380, 245, 405, 255], fill='#f59e0b')


def render_led_bulb(draw, p):
    # Modern LED Bulb (Panasonic style)
    name = p['name'].lower()
    add_shadow(draw, 250, 425, 120, 22)
    
    is_high_watt = any(w in name for w in ['30w', '40w', '50w', '70w'])
    
    if is_high_watt:
        # High bay / hammer bulb with large cooling fins
        # Dome
        draw.ellipse([140, 100, 360, 270], fill='#ffffff', outline='#e2e8f0', width=2)
        # Heat sink cylinder with fins
        draw.rectangle([160, 230, 340, 330], fill='#f1f5f9', outline='#cbd5e1', width=2)
        for x in range(175, 330, 16):
            draw.line([(x, 230), (x, 330)], fill='#94a3b8', width=3)
        # B22 Base
        draw.rectangle([210, 330, 290, 380], fill='#94a3b8', outline='#475569', width=2)
        draw.ellipse([230, 375, 270, 395], fill='#1e293b')
    else:
        # Standard domestic LED Bulb
        # Luminous frosted dome (white glowing)
        draw.pieslice([150, 90, 350, 280], 180, 360, fill='#ffffff', outline='#e2e8f0', width=2)
        # Heat sink thermal body
        draw.polygon([(150, 185), (350, 185), (315, 305), (185, 305)], fill='#f8fafc', outline='#cbd5e1', width=2)
        # Neck rings
        for y in range(305, 345, 10):
            draw.rounded_rectangle([205, y, 295, y+8], radius=3, fill='#94a3b8', outline='#64748b')
        # Aluminum B22 cap with contact pin
        draw.ellipse([225, 340, 275, 365], fill='#334155')
        draw.rectangle([195, 318, 205, 328], fill='#64748b') # Bayonet pin left
        draw.rectangle([295, 318, 305, 328], fill='#64748b') # Bayonet pin right
    
    # Wattage on bulb
    import re
    m = re.search(r'(\d+(?:\.\d+)?)\s*W', p['name'], re.IGNORECASE)
    watt = (m.group(1) + 'W') if m else "9W"
    draw.text((230, 220), watt, fill='#64748b', font=font_bold)


def render_led_tube_light(draw, p):
    # 4 ft LED Tube light / Batten fixture
    add_shadow(draw, 250, 420, 170, 18)
    # Long slim aluminum batten running diagonally
    draw.polygon([(80, 340), (420, 140), (410, 125), (70, 325)], fill='#ffffff', outline='#cbd5e1', width=2)
    # Luminous white diffuser face
    draw.line([(73, 330), (413, 130)], fill='#fefce8', width=8)
    # End caps
    draw.ellipse([65, 320, 85, 345], fill='#94a3b8', outline='#475569')
    draw.ellipse([405, 120, 425, 145], fill='#94a3b8', outline='#475569')
    draw.text((190, 280), "4 FT LED BATTEN", fill='#64748b', font=font_bold)


def render_charging_bulb(draw, p):
    # Inverter / Emergency Rechargeable LED Bulb (Halonix)
    add_shadow(draw, 250, 425, 120, 22)
    # Dome
    draw.pieslice([150, 90, 350, 280], 180, 360, fill='#ffffff', outline='#e2e8f0', width=2)
    # Thermal body
    draw.polygon([(150, 185), (350, 185), (315, 305), (185, 305)], fill='#f8fafc', outline='#cbd5e1', width=2)
    # Green charging indicator dot
    draw.ellipse([244, 215, 256, 227], fill='#22c55e')
    draw.text((220, 235), "EMERGENCY\nINVERTER", fill='#15803d', font=font_sm, align='center')
    # Neck & Cap
    for y in range(305, 345, 10):
        draw.rounded_rectangle([205, y, 295, y+8], radius=3, fill='#94a3b8', outline='#64748b')
    draw.ellipse([225, 340, 275, 365], fill='#334155')


def render_house_wire(draw, p):
    # Coiled 90m roll of PVC insulated wire
    name = p['name'].lower()
    spec = p.get('spec', '').lower()
    
    wire_col = '#dc2626' # default Red
    if 'black' in spec and 'black' in name:
        wire_col = '#1e293b'
    elif 'green' in spec and 'green' in name:
        wire_col = '#16a34a'
    elif 'blue' in spec or 'blue' in name:
        wire_col = '#2563eb'
    elif 'kothari' in (p.get('brand') or '').lower():
        wire_col = '#dc2626'
    
    add_shadow(draw, 250, 425, 160, 26)
    
    # Coiled wire torus loops
    for r in range(140, 60, -12):
        draw.ellipse([250-r, 260-r*0.7, 250+r, 260+r*0.7], outline=wire_col, width=10)
    
    # Transparent wrapping sheen
    draw.ellipse([100, 155, 400, 365], fill=None, outline='#ffffff', width=4)
    
    # Branded label band in center
    draw.rounded_rectangle([180, 220, 320, 300], radius=8, fill='#ffffff', outline='#cbd5e1', width=2)
    brand = (p.get('brand') or 'POLYCAB').upper()
    import re
    m = re.search(r'(\d+(?:\.\d+)?)\s*sqmm', p['name'], re.IGNORECASE)
    gauge = (m.group(1) + ' SQMM') if m else "1.5 SQMM"
    draw.text((195, 232), f"{brand}\nFR 90 MTR\n{gauge}", fill='#1e293b', font=font_sm, align='center')
    
    # Stripped copper tip exposed
    draw.line([(360, 230), (395, 205)], fill=wire_col, width=6)
    draw.line([(395, 205), (415, 190)], fill='#d97706', width=4) # Shiny copper conductor


def render_other_wire(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 425, 150, 24)
    
    if 'flat' in name:
        # 2-core flat twin wire coil (white)
        for r in range(130, 60, -14):
            draw.ellipse([250-r, 260-r*0.7, 250+r, 260+r*0.7], outline='#ffffff', width=12)
            draw.ellipse([250-r, 260-r*0.7, 250+r, 260+r*0.7], outline='#cbd5e1', width=2)
        draw.text((200, 250), "2-CORE FLAT", fill='#475569', font=font_bold)
    elif 'copper' in p.get('subcat', '').lower() or 'copper' in name:
        # Bare bright copper wire coil
        for r in range(130, 60, -10):
            draw.ellipse([250-r, 260-r*0.7, 250+r, 260+r*0.7], outline='#d97706', width=6)
            draw.ellipse([250-r, 260-r*0.7, 250+r, 260+r*0.7], outline='#f59e0b', width=2)
        draw.text((190, 250), "COPPER WIRE", fill='#78350f', font=font_bold)
    elif 'coaxial' in p.get('subcat', '').lower() or 'rg-6' in name:
        # RG-6 Coaxial cable
        for r in range(130, 60, -12):
            draw.ellipse([250-r, 260-r*0.7, 250+r, 260+r*0.7], outline='#0f172a', width=8)
        # Stripped tip showing copper core + dielectric + braid
        draw.line([(360, 230), (410, 200)], fill='#0f172a', width=8)
        draw.line([(410, 200), (420, 194)], fill='#e2e8f0', width=6) # Dielectric
        draw.line([(420, 194), (430, 188)], fill='#d97706', width=3) # Copper center
        draw.text((205, 250), "RG-6 DISH CABLE", fill='#64748b', font=font_sm)
    elif 'speaker' in name:
        # Transparent twin speaker wire with red stripe
        for r in range(130, 60, -12):
            draw.ellipse([250-r, 260-r*0.7, 250+r, 260+r*0.7], outline='#fef3c7', width=8)
            draw.ellipse([250-r, 260-r*0.7, 250+r, 260+r*0.7], outline='#dc2626', width=2)
        draw.text((195, 250), "SPEAKER CABLE", fill='#64748b', font=font_sm)
    else:
        # Multistrand wire coil
        for r in range(130, 60, -12):
            draw.ellipse([250-r, 260-r*0.7, 250+r, 260+r*0.7], outline='#2563eb', width=8)
        draw.text((215, 250), "FLEX WIRE", fill='#1e293b', font=font_bold)


def render_hand_tool(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 120, 22)
    
    if 'plier' in name:
        # Taparia 8" Combination Pliers
        # Insulated red/orange handles
        draw.rounded_rectangle([190, 240, 225, 410], radius=16, fill='#ea580c', outline='#c2410c', width=2)
        draw.rounded_rectangle([275, 240, 310, 410], radius=16, fill='#ea580c', outline='#c2410c', width=2)
        # Handle black comfort grips
        draw.rectangle([190, 280, 225, 380], fill='#1e293b')
        draw.rectangle([275, 280, 310, 380], fill='#1e293b')
        # Forged steel pivot & jaws
        draw.polygon([(200, 240), (225, 170), (275, 170), (300, 240), (250, 260)], fill='#64748b', outline='#334155', width=2)
        draw.ellipse([240, 205, 260, 225], fill='#334155') # Pivot pin
        # Steel serrated jaws
        draw.polygon([(225, 170), (235, 95), (265, 95), (275, 170)], fill='#94a3b8', outline='#334155', width=2)
        draw.line([(250, 95), (250, 160)], fill='#334155', width=2)
        draw.text((220, 425), "TAPARIA 8\"", fill='#64748b', font=font_bold)
    elif 'tester' in name:
        # Taparia Neon Line Tester
        # Transparent amber handle
        draw.rounded_rectangle([232, 100, 268, 260], radius=6, fill='#f59e0b', outline='#b45309', width=2)
        # Fluted grip slots
        for y in range(120, 240, 14):
            draw.line([(236, y), (264, y)], fill='#d97706', width=2)
        # Internal neon bulb
        draw.ellipse([244, 180, 256, 200], fill='#ef4444')
        # Pocket clip
        draw.rectangle([268, 120, 276, 200], fill='#cbd5e1')
        # Steel shank & flat tip
        draw.rectangle([246, 260, 254, 400], fill='#94a3b8', outline='#475569', width=1)
        draw.polygon([(244, 400), (256, 400), (253, 415), (247, 415)], fill='#475569')
    elif 'stripper' in name:
        # PYE Wire Stripper & Cutter
        draw.rounded_rectangle([190, 260, 220, 400], radius=10, fill='#eab308', outline='#ca8a04', width=2)
        draw.rounded_rectangle([280, 260, 310, 400], radius=10, fill='#eab308', outline='#ca8a04', width=2)
        draw.polygon([(200, 260), (250, 140), (300, 260)], fill='#475569')
        # V-notch cutting blades
        draw.polygon([(240, 140), (250, 160), (260, 140)], fill='#f8fafc')
    else:
        # Taparia Screwdriver
        draw.rounded_rectangle([230, 90, 270, 230], radius=12, fill='#16a34a', outline='#15803d', width=2)
        for y in range(110, 210, 15):
            draw.line([(235, y), (265, y)], fill='#14532d', width=3)
        # Steel round shaft
        draw.rectangle([245, 230, 255, 395], fill='#cbd5e1', outline='#64748b', width=1)
        # Magnetic black tip
        draw.polygon([(243, 395), (257, 395), (254, 415), (246, 415)], fill='#1e293b')


def render_battery_cell(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 110, 20)
    
    if '9v' in name:
        # 9V Rectangular Transistor battery
        draw.rounded_rectangle([190, 170, 310, 380], radius=8, fill='#1e293b', outline='#475569', width=2)
        # Golden top stripe
        draw.rectangle([190, 170, 310, 220], fill='#eab308')
        # Snap terminals on top
        draw.rectangle([210, 145, 235, 170], fill='#cbd5e1', outline='#64748b', width=1) # octagonal
        draw.ellipse([265, 145, 290, 170], fill='#cbd5e1', outline='#64748b', width=1) # circular
        draw.text((230, 260), "9V\nHEAVY\nDUTY", fill='#ffffff', font=font_bold, align='center')
    elif '2032' in name:
        # CR2032 3V Lithium coin cell
        draw.ellipse([150, 150, 350, 350], fill='#e2e8f0', outline='#94a3b8', width=3)
        draw.ellipse([170, 170, 330, 330], fill='#f8fafc', outline='#cbd5e1', width=1)
        draw.text((195, 230), "+ CR2032\n3V LITHIUM", fill='#475569', font=font_bold, align='center')
    else:
        # AA / AAA Pencil Cell
        is_aaa = 'aaa' in name
        w = 55 if is_aaa else 70
        h = 220 if is_aaa else 240
        x1 = 250 - w // 2
        y1 = 260 - h // 2
        # Battery body (Gold / Black)
        draw.rounded_rectangle([x1, y1, x1+w, y1+h], radius=6, fill='#1e293b', outline='#475569', width=2)
        # Gold upper half
        draw.rectangle([x1, y1, x1+w, y1 + int(h*0.4)], fill='#eab308')
        # Positive nipple terminal
        draw.rounded_rectangle([250 - 12, y1 - 12, 250 + 12, y1], radius=3, fill='#cbd5e1')
        lbl = "AAA 1.5V" if is_aaa else "AA 1.5V"
        draw.text((250 - 28, y1 + int(h*0.55)), lbl, fill='#ffffff', font=font_bold)


def render_av_cable(draw, p):
    name = p['name'].lower()
    add_shadow(draw, 250, 420, 140, 22)
    
    if 'hdmi' in name:
        # HDMI Cable with gold plated connectors
        # Coiled black braided cable
        draw.arc([140, 160, 360, 360], 0, 360, fill='#1e293b', width=12)
        # Left plug
        draw.rounded_rectangle([120, 130, 170, 230], radius=6, fill='#1e293b', outline='#475569', width=2)
        draw.rectangle([132, 90, 158, 130], fill='#f59e0b', outline='#b45309', width=1) # Gold connector
        # Right plug
        draw.rounded_rectangle([330, 130, 380, 230], radius=6, fill='#1e293b', outline='#475569', width=2)
        draw.rectangle([342, 90, 368, 130], fill='#f59e0b', outline='#b45309', width=1)
        draw.text((215, 250), "HDMI 4K", fill='#94a3b8', font=font_bold)
    elif 'stereo' in name:
        # 3.5mm Aux to 2-RCA
        draw.arc([140, 170, 360, 350], 0, 360, fill='#1e293b', width=8)
        # 3.5mm plug on left
        draw.rounded_rectangle([140, 140, 170, 220], radius=4, fill='#1e293b')
        draw.rectangle([151, 95, 159, 140], fill='#f59e0b')
        # Red & White RCA on right
        draw.rounded_rectangle([320, 130, 345, 200], radius=4, fill='#dc2626')
        draw.rectangle([329, 100, 336, 130], fill='#f59e0b')
        draw.rounded_rectangle([355, 130, 380, 200], radius=4, fill='#f8fafc')
        draw.rectangle([364, 100, 371, 130], fill='#f59e0b')
    else:
        # 3-RCA to 3-RCA (Yellow, White, Red)
        draw.arc([140, 180, 360, 360], 0, 360, fill='#1e293b', width=8)
        colors = ['#eab308', '#f8fafc', '#dc2626']
        for i, col in enumerate(colors):
            x = 210 + i * 40
            draw.rounded_rectangle([x, 140, x+24, 210], radius=4, fill=col, outline='#64748b', width=1)
            draw.rectangle([x+8, 105, x+16, 140], fill='#f59e0b')


# ==============================================================================
# MAIN DISPATCHER
# ==============================================================================

def generate_image_for_product(p):
    img, draw = create_canvas()
    subcat = (p.get('subcat') or '').strip()
    name = (p.get('name') or '').strip().lower()
    cat = (p.get('cat') or '').strip()

    # Route based on subcategory
    if subcat == 'Pica Conduit Pipes':
        render_pica_conduit(draw, p)
    elif subcat == 'PVC Pipes':
        render_pvc_pipe(draw, p)
    elif subcat == 'PVC Pipe Fittings':
        render_pvc_fitting(draw, p)
    elif subcat == 'Casing & Capping':
        render_casing_patti(draw, p)
    elif subcat == 'Casing Fittings':
        render_casing_fitting(draw, p)
    elif subcat == 'Saddles & Clamps':
        render_saddle_clamp(draw, p)
    elif subcat == 'Cable Ties':
        render_cable_tie(draw, p)
    elif subcat == 'Insulation Tapes':
        render_insulation_tape(draw, p)
    elif subcat == 'Connector Strips':
        render_connector_strip(draw, p)
    elif subcat == 'Ceiling Fans':
        render_ceiling_fan(draw, p)
    elif subcat == 'Table, Pedestal & Wall Fans':
        render_portable_fan(draw, p)
    elif subcat == 'Exhaust Fans':
        render_exhaust_fan(draw, p)
    elif subcat == 'Fan Rods, Clamps & Hooks':
        render_fan_accessory(draw, p)
    elif subcat == 'Fan Capacitors':
        render_fan_capacitor(draw, p)
    elif subcat == 'GI Concealed Boxes' or subcat == 'MCB Boxes':
        render_gi_box(draw, p)
    elif subcat == 'Cover Plates':
        render_cover_plate(draw, p)
    elif subcat == 'Modular Surface Boxes':
        render_modular_surface_box(draw, p)
    elif subcat == 'PVC Switch Boards':
        render_pvc_switch_board(draw, p)
    elif subcat == 'Extension Boards':
        render_extension_board(draw, p)
    elif subcat == 'Modular Switches':
        render_modular_switch(draw, p)
    elif subcat == 'Fan Regulators':
        render_fan_regulator(draw, p)
    elif subcat == 'Modular Sockets':
        render_modular_socket(draw, p)
    elif subcat == 'Plug Tops & Adapters':
        render_plug_top_adapter(draw, p)
    elif subcat == 'Switch-Socket Combos':
        render_switch_socket_combo(draw, p)
    elif subcat == 'Door Bells':
        render_door_bell(draw, p)
    elif subcat == 'MCBs':
        render_mcb(draw, p)
    elif subcat == 'Lamp Holders':
        render_lamp_holder(draw, p)
    elif subcat == 'Panel & Surface Lights':
        render_panel_light(draw, p)
    elif subcat == 'LED Bulbs':
        render_led_bulb(draw, p)
    elif subcat == 'LED Tube Lights':
        render_led_tube_light(draw, p)
    elif subcat == 'Charging Bulbs':
        render_charging_bulb(draw, p)
    elif subcat == 'PVC Flexible House Wire':
        render_house_wire(draw, p)
    elif subcat in ['Other Wires', 'Copper Wire', 'Coaxial & Speaker Cable']:
        render_other_wire(draw, p)
    elif subcat == 'Hand Tools':
        render_hand_tool(draw, p)
    elif subcat == 'Batteries & Cells':
        render_battery_cell(draw, p)
    elif subcat == 'AV Cables':
        render_av_cable(draw, p)
    else:
        # Fallback based on name keywords
        if 'fan' in name:
            render_ceiling_fan(draw, p)
        elif 'bulb' in name:
            render_led_bulb(draw, p)
        elif 'switch' in name:
            render_modular_switch(draw, p)
        elif 'socket' in name:
            render_modular_socket(draw, p)
        elif 'wire' in name or 'cable' in name:
            render_house_wire(draw, p)
        elif 'mcb' in name:
            render_mcb(draw, p)
        else:
            render_gi_box(draw, p)

    # Add corner badge
    add_badge(draw, p)

    return img


def run():
    print(f"Connecting to database: {DB_FILE}")
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    rows = cursor.execute("""
        SELECT p.id, p.code, p.name, p.brand, p.model, p.spec, c.name as cat, s.name as subcat, p.unit, p.sell_price, p.cost_price, p.image
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN subcategories s ON p.subcategory_id = s.id
        ORDER BY p.id
    """).fetchall()

    total_products = len(rows)
    print(f"Total products to process: {total_products}")

    processed_count = 0
    generated_count = 0

    for r in rows:
        p = dict(r)
        pid = p['id']
        filename = f"p{pid}.webp"
        filepath = os.path.join(UPLOADS_DIR, filename)

        # Generate realistic representative image
        img = generate_image_for_product(p)
        
        # Save as optimized WebP
        img.save(filepath, 'WEBP', quality=85, method=4)
        
        # Update database
        cursor.execute("UPDATE products SET image = ?, updated_at = datetime('now') WHERE id = ?", (filename, pid))
        
        processed_count += 1
        generated_count += 1
        if processed_count % 25 == 0 or processed_count == total_products:
            print(f"Processed {processed_count}/{total_products} products...")

    conn.commit()
    conn.close()

    print(f"\nCompleted successfully!")
    print(f"Total products processed: {processed_count}")
    print(f"Total images generated: {generated_count}")
    print(f"Images directory: {UPLOADS_DIR}")


if __name__ == '__main__':
    run()
