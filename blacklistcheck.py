import pytesseract
from PIL import ImageGrab
import cv2
import numpy as np
import re
import pyperclip
import time
import pyttsx3
import json
import os

# ─── CONFIG: your red-boxed capture region ───────────────────────────────────────
# Change these values to the pixel coords of the top-left and bottom-right corners
# of the red box in your screenshots.
#
# Example: capture only the friend/chat overlay on the right side of a 1920×1080 screen:
ROI = (1100,  100, 1900, 1000)   # (left, top, right, bottom)


# ─── GLOBAL STATE ───────────────────────────────────────────────────────────────
capturing_enabled = True
seen_tags = set()


# ─── TESSERACT & TTS SETUP ───────────────────────────────────────────────────────
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

engine = pyttsx3.init()
voices = engine.getProperty('voices')
voice_match    = next((v.id for v in voices if 'david' in v.name.lower()), voices[0].id)
voice_nonmatch = next((v.id for v in voices if 'zira'  in v.name.lower()),
                      voices[1].id if len(voices)>1 else voices[0].id)
engine.setProperty('rate', 160)

def speak(text, voice_id):
    engine.setProperty('voice', voice_id)
    engine.say(text)
    engine.runAndWait()


# ─── BLACKLIST LOADING ──────────────────────────────────────────────────────────
blacklist_path = os.path.join(os.path.dirname(__file__), "blacklisted.txt")
with open(blacklist_path, "r", encoding="utf-8") as f:
    blacklist = set(line.strip() for line in f if line.strip())
    print(type(blacklist), blacklist)

# ─── SCREEN CAPTURE & PARSING ────────────────────────────────────────────────────
def grab_and_parse_screen():
    global capturing_enabled, seen_tags

    # 1) Grab only your region of interest
    img    = ImageGrab.grab(bbox=ROI)
    img_np = np.array(img)
    gray   = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    text   = pytesseract.image_to_string(gray)
    lower  = text.lower()

    # 2) Pause / resume logic via on-screen commands
    if "allclear" in lower and capturing_enabled:
        speak("All clear received. Pausing scan.", voice_nonmatch)
        capturing_enabled = False

    if "checkbl" in lower and not capturing_enabled:
        speak("Resuming blacklist scan.", voice_match)
        capturing_enabled = True

    if not capturing_enabled:
        return []

    # 3) Look for lines that are *exactly* a permanent tag,
    #    then grab the single line immediately above as the custom name
    lines = text.splitlines()
    perm_tag_pattern = re.compile(r'^[A-Za-z0-9]+#[0-9]{3,5}$')
    pairs = []
    for i, raw in enumerate(lines):
        line = raw.strip()
        if perm_tag_pattern.match(line):
            perm_tag = line
            custom = lines[i-1].strip() if i>0 and lines[i-1].strip() else "<unknown>"
            pairs.append((custom, perm_tag))

    # 4) Filter out tags we've already seen
    new_pairs = [(c, t) for c, t in pairs if t not in seen_tags]
    seen_tags.update(t for _, t in new_pairs)

    return sorted(new_pairs, key=lambda x: x[1])


# ─── LOGGING & ALERTING ─────────────────────────────────────────────────────────
def log_usernames(pairs):
    if not pairs:
        return

    # append to parsed_usernames.txt
    with open("parsed_usernames.txt", "a", encoding="utf-8") as f:
        for custom, perm_tag in pairs:
            f.write(f"{custom},{perm_tag}\n")

    # copy the new pairs to clipboard (optional)
    pyperclip.copy("\n".join(f"{c},{t}" for c, t in pairs))

    # console + voice
    for custom, perm_tag in pairs:
        if perm_tag in blacklist:
            print(f"[!!!] 🚨 BLACKLIST HIT: {custom} ({perm_tag})")
            speak(
                f"Alert, Alert. Blacklist match found: permanent tag {perm_tag.replace('#',' number ')} aka {custom}",
                voice_match
            )
        else:
            print(f"[~] Not on blacklist: {custom} ({perm_tag})")
            speak(f"No match for {perm_tag}", voice_nonmatch)


# ─── MAIN LOOP ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    while True:
        new_pairs = grab_and_parse_screen()
        log_usernames(new_pairs)
        time.sleep(3)
