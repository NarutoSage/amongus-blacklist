# Among Us Blacklist Checker

Continuously captures your screen, OCR-reads any `Username#1234` patterns, and alerts you (via voice and console) if one of them is on your blacklist.

---

## 📦 Repository Contents

- **`blacklistcheck.py`**  
  Main script that:  
  1. Grabs your screen (configurable region).  
  2. Runs Tesseract OCR on it.  
  3. Extracts `Name#1234` usernames.  
  4. Compares them against `blacklisted.txt`.  
  5. Logs all seen names, issues voice alerts and console messages.

- **`blacklisted.txt`**  
  A plain-text list of blocked usernames, one per line (e.g. `toxicgamr#0420`).

- **`parsed_usernames.txt`** (auto-generated)  
  Appends every new username seen over time.

---

## 🔧 Prerequisites (Windows)

### 1. Install Python 3

1. Go to https://www.python.org/downloads/windows  
2. Click **Download Python 3.x.x** (latest).  
3. In the installer, **check** “Add Python 3.x to PATH,” then click **Install Now**.  
4. Open Command Prompt (Start → type `cmd` → Enter) and verify:

    ```bat
    python --version
    ```

    You should see `Python 3.x.x`.

### 2. Install Visual Studio Code

1. Download it from https://code.visualstudio.com/Download  
2. Run the installer (accept defaults).  
3. Launch **Visual Studio Code** when done.

### 3. Install Tesseract-OCR

1. Download the Windows installer from  
   https://github.com/tesseract-ocr/tesseract/releases  
   (look for `tesseract-ocr-setup-*.exe`).  
2. Run it and accept defaults (installs to `C:\Program Files\Tesseract-OCR\`).  
3. *(Optional)* Add Tesseract to your PATH:  
   - Press **Win+R**, type `sysdm.cpl`, press **Enter**.  
   - Go to **Advanced → Environment Variables…**  
   - Under **System variables**, select **Path → Edit → New**, paste:  
     ```
     C:\Program Files\Tesseract-OCR\
     ```  
   - Click **OK** to save.

---

## 🐍 Installing Python Packages

1. **Open your project folder** in VS Code:  
   - File → Open Folder… → select the repo directory.

2. **Open the integrated terminal**:  
   - View → Terminal (or press **Ctrl + `**).

3. **(Optional) Create a virtual environment**:

    ```powershell
    python -m venv venv
    .\venv\Scripts\activate
    ```

    Your prompt will now show `(venv)`.

4. **Install dependencies**:

    ```powershell
    pip install pytesseract pillow opencv-python numpy pyperclip pyttsx3
    ```

    Wait for “Successfully installed…” messages.

---

## ⚙️ Configuring the Script

1. **Tesseract path**  
   In `blacklistcheck.py`, find:

    ```python
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    ```

   - If you used the default install, leave it.  
   - Otherwise, update the string to your actual `tesseract.exe` path.

2. **Screen region**  
   By default it grabs the full 1920×1080 screen.  
   To target a sub-region, edit in `grab_and_parse_screen()`:

    ```python
    ImageGrab.grab(bbox=(0, 0, 1920, 1080))
    ```

   Format: `(left, top, right, bottom)` in pixels.

---

## 🚀 Running the Script

In the **same VS Code terminal** (activate `venv` if you made one):

```powershell
python blacklistcheck.py
```

Every 3 seconds the script will:

1. OCR your screen.  
2. Append any _new_ `Username#1234` matches to `parsed_usernames.txt`.  
3. Print a console message.  
4. Speak an alert via your speakers if the username is found in `blacklisted.txt`.

---

## ✏️ Editing Your Blacklist

1. In VS Code’s Explorer, click **`blacklisted.txt`**.  
2. Add or remove lines—one username per line (include the `#` and digits).  
3. **Save** (Ctrl+S). Changes take effect next cycle.

---

## 🐛 Troubleshooting

- **`python` not recognized**  
  → Ensure you checked “Add Python 3.x to PATH” during installation.

- **TesseractNotFoundError**  
  → Confirm `tesseract_cmd` points to your actual install location.

- **No voice alerts?**  
  → Windows must have at least two TTS voices (e.g. “David” & “Zira”).

- **Script exits immediately**  
  → Run it from VS Code terminal so you can read any error messages.

---

## 🤝 Contributing

PRs welcome for:

- Better Windows-native audio support  
- Customizable OCR regex patterns  
- Improved logging/output formats
