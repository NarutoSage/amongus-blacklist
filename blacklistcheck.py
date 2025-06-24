import pytesseract
from PIL import ImageGrab
import cv2
import numpy as np
import re
import pyperclip
import time
import pyttsx3
import os

# Path to tesseract executable
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Initialize TTS engine
engine = pyttsx3.init()
voices = engine.getProperty('voices')
for i, v in enumerate(voices):

    print(f"{i}: {v.name} - {v.id}")

# Voice selection
voice_match = None
voice_nonmatch = None
for v in voices:
    if "zira" in v.name.lower():
        voice_nonmatch = v.id
    elif "david" in v.name.lower():
        voice_match = v.id

if not voice_match:
    voice_match = voices[0].id
if not voice_nonmatch:
    voice_nonmatch = voices[1].id if len(voices) > 1 else voices[0].id

engine.setProperty('rate', 160)

# Load blacklist
blacklist_path = os.path.join(os.path.dirname(__file__), "blacklisted.txt")
with open(blacklist_path, "r", encoding="utf-8") as f:
    blacklist = set(line.strip() for line in f if line.strip())

seen_usernames = set()

def speak(text, voice_id):
    engine.setProperty('voice', voice_id)
    engine.say(text)
    engine.runAndWait()

def grab_and_parse_screen():
    img = ImageGrab.grab(bbox=(0, 0, 1920, 1080))
    img_np = np.array(img)
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    text = pytesseract.image_to_string(gray)
    found = set(re.findall(r'\b[a-zA-Z0-9]+#[0-9]{3,5}\b', text))
    new = found - seen_usernames
    seen_usernames.update(new)
    return sorted(new)

def log_usernames(usernames):
    if not usernames:
        return
    with open("parsed_usernames.txt", "a", encoding="utf-8") as f:
        for name in usernames:
            f.write(name + "\n")
    pyperclip.copy('\n'.join(sorted(seen_usernames)))

    for name in usernames:
        if name in blacklist:
            print("[!!!] 🚨 BLACKLIST HIT:", name)
            speak(f"Alert. Blacklist match found: {name.replace('#', ' number ')}", voice_match)
        else:
            print("[~] Not on blacklist:", name)
            speak(f"No match: {name.replace('#', ' number ')}", voice_nonmatch)

while True:
    new_names = grab_and_parse_screen()
    log_usernames(new_names)
    time.sleep(3)
