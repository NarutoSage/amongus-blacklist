const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { parse: csvParse } = require('csv-parse');
const clipboardy = require('clipboardy');
const Tesseract = require('tesseract.js');
const say = require('say');

const EXCEL_URL = '[YOUR URL HERE]';

const BLACKLIST_REFRESH_MS = 5 * 60 * 1000;
const domain = "BlockList";
const version = "2.0";
const globalprefix= `[${domain}][v${version}]`;
const functionprefix = "[Update Sequencer]";
const sequence = [
    "THE COVERT", // Add your own spreadsheet tabs here.
    "PROSPECTS",
    "WATCH LIST",
    "PROBATION",
    "COVERT BLACKLIST",
    "OG COVERT BL"
];

const SCREENSHOT_PATH = path.join(__dirname, 'screen.png');
const PARSED_USERNAMES_PATH = path.join(__dirname, 'parsed_usernames.txt');
const ROI = null;

let serverMembers = new Set();
let prospects = new Set();
let watchList = new Set();
let probation = new Set();
let blacklist = new Set();
let ogblacklist = new Set();
let seenTags = new Set();
var statisticsOutputArray = [];

// --- Speech Queue Implementation ---
let speakQueue = [];
let speakActive = false;
function enqueueSpeak(text) {
    speakQueue.push(text);
    if (!speakActive) processSpeakQueue();
}
async function processSpeakQueue() {
    speakActive = true;
    while (speakQueue.length) {
        const msg = speakQueue.shift();
        await new Promise((resolve) => {
            say.speak(msg, undefined, 1.1, resolve);
        });
        await new Promise(res => setTimeout(res, 1000));
    }
    speakActive = false;
}

// ---  Menu Click Helper ---
async function clickMenuItemByText(frame, text, retries = 10) {
    for (let attempt = 0; attempt < retries; attempt++) {
        const all = await frame.$$('*');
        for (const el of all) {
            const elText = await (await el.getProperty('textContent')).jsonValue();
            if (elText && elText.trim() === text) {
                await frame.evaluate(el => { el.scrollIntoView({block: 'center'}); }, el);
                await new Promise(r => setTimeout(r, 200));
                await frame.evaluate(el => el.click(), el);
                return true;
            }
        }
        await new Promise(r => setTimeout(r, 400));
    }
    return false;
}

// --- Puppeteer: Download CSV from Excel Online ---
async function downloadCSV(spreadsheet, number) {
    const CSV_OUTPUT = path.join(__dirname, `${spreadsheet}.csv`);
    console.log(`[?]${globalprefix}: ${functionprefix}[${number}]: Starting CSV download with Puppeteer...`);
    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ['--start-maximized'],
    });
    const page = await browser.newPage();
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: __dirname,
    });
    console.log(`[?]${globalprefix}: ${functionprefix}[${number}]: Navigating to Excel Online link...`);
    await page.goto(EXCEL_URL, { waitUntil: 'networkidle2' });
    await new Promise(res => setTimeout(res, 4000));
    const frames = page.frames();
    const excelFrame = frames.find(f => f.url().includes('xlviewerinternal.aspx'));
    if (!excelFrame) {
        console.error(`[!]${globalprefix}: ${functionprefix}: Could not find Excel iframe!`);
        await browser.close();
        return false;
    }
    console.log(`[*]${globalprefix}: ${functionprefix}: Found Excel iframe:`, excelFrame.url());
    // Switch to the right tab
    console.log(`[?]${globalprefix}: ${functionprefix}: Attempting to switch to "${spreadsheet}" sheet...`);
    const tabButtons = await excelFrame.$$('[role="tab"]');
    let foundTab = false;
    for (const tab of tabButtons) {
        const text = await (await tab.getProperty('textContent')).jsonValue();
        if (text && text.trim() === `${spreadsheet}`) {
            await tab.click();
            foundTab = true;
            console.log(`[*]${globalprefix}: ${functionprefix}[${number}]: Clicked "${spreadsheet}" tab.`);
            await new Promise(res => setTimeout(res, 1500));
            break;
        }
    }
    if (!foundTab) {
        console.error(`[!]${globalprefix}: ${functionprefix}[${number}]: Could not find "${spreadsheet}" tab!`);
        await browser.close();
        return false;
    }
    // File menu
    console.log(`[?]${globalprefix}: ${functionprefix}[${number}]: Waiting for File menu to appear in iframe...`);
    await excelFrame.waitForSelector('button#FileMenuFlyoutLauncher', { timeout: 60000 });
    console.log(`[?]${globalprefix}: ${functionprefix}[${number}]: Clicking File menu...`);
    const fileBtn = await excelFrame.$('button#FileMenuFlyoutLauncher');
    await fileBtn.click();
    await new Promise(res => setTimeout(res, 1000));
    // Export
    console.log(`[*]${globalprefix}: ${functionprefix}[${number}]: Clicking Export...`);
    if (!await clickMenuItemByText(excelFrame, 'Export')) {
        console.error(`[!]${globalprefix}: ${functionprefix}[${number}]: Could not find/click Export. UI may have changed.`);
        await browser.close();
        return false;
    }
    await new Promise(res => setTimeout(res, 1200));
    // CSV UTF-8
    console.log(`[?]${globalprefix}: ${functionprefix}[${number}]: Clicking "Download as CSV UTF-8"...`);
    if (!await clickMenuItemByText(excelFrame, 'Download as CSV UTF-8')) {
        console.error(`[!]${globalprefix}: ${functionprefix}[${number}]: Could not find/click "Download as CSV UTF-8". UI may have changed.`);
        await browser.close();
        return false;
    }
    await new Promise(res => setTimeout(res, 5000));
    // Wait for CSV
    console.log(`[?]${globalprefix}: ${functionprefix}[${number}]: Waiting for CSV file to appear in download folder...`);
    let csvFilePath = null;
    for (let i = 0; i < 30; ++i) {
        const files = fs.readdirSync(__dirname);
        const csvFile = files.find(f => f.endsWith('.csv') && f !== path.basename(CSV_OUTPUT));
        if (csvFile) {
            csvFilePath = path.join(__dirname, csvFile);
            break;
        }
        console.log(`[?]${globalprefix}: ${functionprefix}[${number}]: Still waiting for CSV download... (${i + 1}s)`);
        await new Promise(r => setTimeout(r, 1000));
    }
    if (!csvFilePath) {
        console.error(`[!]${globalprefix}: ${functionprefix}[${number}]: CSV file did not appear after download.`);
        await browser.close();
        return false;
    }
    if (fs.existsSync(CSV_OUTPUT)) fs.unlinkSync(CSV_OUTPUT);
    fs.renameSync(csvFilePath, CSV_OUTPUT);
    console.log(`${globalprefix}: ${functionprefix}[${number}]: Downloaded new CSV:`, CSV_OUTPUT);
    await browser.close();
    return true;
}

function updateLocalFromCSV(spreadsheet, number) {
    const output = path.join(__dirname, `${spreadsheet}.txt`);
    const CSV_OUTPUT = path.join(__dirname, `${spreadsheet}.csv`);
    try {
        const data = fs.readFileSync(CSV_OUTPUT, 'utf8');
        csvParse(data, {}, (err, records) => {
            if (err) {
                console.error(`[!]${globalprefix}: ${functionprefix}[${number}]: Error parsing CSV:`, err);
                return;
            }
            // Search for friendcodes (user#1234) in all columns of each row
            const permTagPattern = /([A-Za-z0-9]+#[0-9]{3,5})/g;
            let tags = [];
            records.slice(1).forEach(row => {
                row.forEach(cell => {
                    if (!cell) return;
                    let matches = [...cell.matchAll(permTagPattern)];
                    for (const match of matches) {
                        // Clean up any whitespace or parentheses
                        let tag = match[1].replace(/[()\s]/g, '');
                        if (/^[A-Za-z0-9]+#[0-9]{3,5}$/.test(tag)) {
                            tags.push(tag);
                        }
                    }
                });
            });
            // Deduplicate
            const uniqueTags = Array.from(new Set(tags));
            fs.writeFileSync(output, uniqueTags.join('\n'), 'utf-8');
            console.log(`[*]${globalprefix}: ${functionprefix}[${number}]: ${spreadsheet} updated. ${uniqueTags.length} entries.`);
            statisticsOutputArray.push(`${globalprefix}: ${functionprefix}[${number}]: ${spreadsheet} updated. ${uniqueTags.length} entries.`);
        });
    } catch (e) {
        console.error(`[!]${globalprefix}: ${functionprefix}[${number}]: Error updating ${spreadsheet}:`, e);
    }
}

// --- Parallelized Blacklist updater ---
let lastManualUpdateTime = 0;
async function updateSequencer(force = false) {
    const functionprefix = "[Update Sequencer]";
    if (force) {
        // Debounce: Only allow every 10 seconds
        const now = Date.now();
        if (now - lastManualUpdateTime < 10000) {
            console.log(`${globalprefix}: ${functionprefix}: Manual update debounced.`);
            return;
        }
        lastManualUpdateTime = now;
        console.log(`${globalprefix}: ${functionprefix}: MANUAL/IMMEDIATE UPDATE TRIGGERED.`);
    } else {
        console.log(`${globalprefix}: ${functionprefix}: Updating All Information in PARALLEL.. `);
    }
    try {
        console.log(`${globalprefix}: ${functionprefix}: Expecting to make ${sequence.length} updates!`);
        await Promise.all(
            sequence.map(async (sheet, i) => {
                const number = `${i+1}/${sequence.length}`;
                console.log(`[~]${globalprefix}: ${functionprefix}: ${number} ${sheet} .. `)
                const downloaded = await downloadCSV(sheet, number);
                if (downloaded) {
                    updateLocalFromCSV(sheet, number);
                } else {
                    console.log(`${globalprefix}: ${functionprefix}: [ERROR]: Download for ${sheet} failed! Will retry in next round...`)
                }
            })
        );
    } catch (e) {
        console.error(`${globalprefix}: ${functionprefix}: [FAIL] Blacklist update loop error:`, e);
    }
    if (!force) {
        console.log(`Completed Updater`)
        console.log(statisticsOutputArray);
        console.log(`${globalprefix}: ${functionprefix}: [INFO] Waiting ${BLACKLIST_REFRESH_MS/1000} seconds before next update...`);
        setTimeout(() => updateSequencer(), BLACKLIST_REFRESH_MS); // loop
    }
}

// --- Load all group sets from .txt files ---
function loadGroupSets() {
    const groupMap = {
        'serverMembers': 'THE COVERT.txt',
        'prospects': 'PROSPECTS.txt',
        'watchList': 'WATCH LIST.txt',
        'probation': 'PROBATION.txt',
        'blacklist': 'COVERT BLACKLIST.txt',
        'ogblacklist': 'OG COVERT BL.txt'
    };
    for (const [key, filename] of Object.entries(groupMap)) {
        try {
            const entries = fs.readFileSync(path.join(__dirname, filename), 'utf-8')
                .split('\n')
                .map(x => x.trim())
                .filter(Boolean);
            switch (key) {
                case 'serverMembers': serverMembers = new Set(entries); break;
                case 'prospects': prospects = new Set(entries); break;
                case 'watchList': watchList = new Set(entries); break;
                case 'probation': probation = new Set(entries); break;
                case 'blacklist': blacklist = new Set(entries); break;
                case 'ogblacklist': ogblacklist = new Set(entries); break;
            }
        } catch (e) {}
    }
}

// --- Identify group for a tag (prioritized) ---
function getGroup(permTag) {
    if (blacklist.has(permTag))     return 'COVERT BLACKLIST';
    if (ogblacklist.has(permTag))   return 'OG COVERT BL';
    if (probation.has(permTag))     return 'PROBATION';
    if (watchList.has(permTag))     return 'WATCH LIST';
    if (prospects.has(permTag))     return 'PROSPECTS';
    if (serverMembers.has(permTag)) return 'THE COVERT';
    return null;
}

// --- OCR logic (use screen.png) ---
async function grabAndParseScreen() {
    if (!fs.existsSync(SCREENSHOT_PATH)) {
        return {pairs: [], text: ""};
    }
    const { data: { text } } = await Tesseract.recognize(SCREENSHOT_PATH, 'eng');
    const lines = text.split('\n').map(l => l.trim());
    const permTagPattern = /^[A-Za-z0-9]+#[0-9]{3,5}$/;
    const pairs = [];
    for (let i = 0; i < lines.length; ++i) {
        if (permTagPattern.test(lines[i])) {
            const permTag = lines[i];
            const custom = i > 0 && lines[i - 1] ? lines[i - 1] : '<unknown>';
            pairs.push([custom, permTag]);
        }
    }
    const newPairs = pairs.filter(([_, permTag]) => !seenTags.has(permTag));
    for (const [_, permTag] of newPairs) seenTags.add(permTag);
    return {pairs: newPairs, text: text};
}

// --- Logging & Alerting ---
function logUsernames(pairs) {
    if (!pairs || !pairs.length) return;
    for (const [custom, permTag] of pairs) {
        fs.appendFileSync(PARSED_USERNAMES_PATH, `${custom},${permTag}\n`);
        const group = getGroup(permTag);
        if (group) {
            let alertType = group === 'COVERT BLACKLIST' || group === 'OG COVERT BL'
                ? '[!!!] 🚨'
                : '[~]';
            console.log(`${alertType} ${group} MATCH: ${custom} (${permTag})`);
            let spoken = group === 'COVERT BLACKLIST' || group === 'OG COVERT BL'
                ? `Alert. Blacklist match found in ${group}: permanent tag ${permTag.replace('#', ' number ')} a.k.a. ${custom}`
                : `Member ${permTag.replace('#', ' number ')} a.k.a. ${custom} is in ${group}`;
            enqueueSpeak(spoken);
        } else {
            console.log(`[~] Not found in any group: ${custom} (${permTag})`);
            enqueueSpeak(`No match for ${permTag}`);
        }
    }
    clipboardy.writeSync(pairs.map(([c, t]) => `${c},${t}`).join('\n'));
}

async function ocrLoop() {
    var functionprefix = `[Screen Recognition]`;
    let initialDownloadComplete = false;
    while (true) {
        loadGroupSets();
        if (blacklist.size === 0) {
            if (!initialDownloadComplete)
                console.log(`${globalprefix}: ${functionprefix}: Waiting for initialized data download...`);
            await new Promise(res => setTimeout(res, 2000));
            continue;
        } else {
            initialDownloadComplete = true;
        }
        const {pairs, text} = await grabAndParseScreen();
        logUsernames(pairs);

        // "STARTING IN 2" detection, forgiving spaces/variations
        if (/STARTING\s*IN\s*2/i.test(text)) {
            console.log(`${globalprefix}: [Screen Recognition]: Detected "STARTING IN 2" on screen, triggering immediate update!`);
            updateSequencer(true); // force immediate update
        }

        await new Promise(res => setTimeout(res, 2000));
    }
}

// --- MAIN ---
console.log(`${globalprefix} Starting blacklist updater loop and OCR loop.`);
updateSequencer(); // starts main loop with timeout recursion
ocrLoop();         // runs continuously in parallel
