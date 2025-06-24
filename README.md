# Among Us Blacklist Checker

Continuously captures your screen, OCR-reads any “Username#1234” patterns, and alerts you (via voice and console) if one of them is on your blacklist.

---

## 📦 Repository Contents

- **`blacklistcheck.py`**  
  The main Python script that:
  1. Grabs your screen (configurable region).
  2. Runs Tesseract OCR on it.
  3. Extracts usernames of the form `Name#1234`.
  4. Compares them against `blacklisted.txt`.
  5. Logs all seen names, issues voice alerts and console messages.
- **`blacklisted.txt`**  
  A plain-text list of blocked usernames, one per line (e.g. `toxicgamr#0420`).
- **`parsed_usernames.txt`** (auto-generated)  
  All usernames your script has ever seen, appended over time.

---

## 🔧 Prerequisites

1. **Python 3.7+**  
2. **Tesseract-OCR**  
   - Windows: download & install from  
     [https://github.com/tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract)  
   - macOS (with Homebrew):  
     ```bash
     brew install tesseract
     ```
   - Linux:  
     ```bash
     sudo apt update
     sudo apt install tesseract-ocr
     ```

3. **Python packages**  
   From your terminal/PowerShell:
   ```bash
   pip install pytesseract pillow opencv-python numpy pyperclip pyttsx3
