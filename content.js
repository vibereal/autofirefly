// --- UTILS ---

function sendLog(message, type = 'step') {
    chrome.runtime.sendMessage({ action: "LOG", message, type }).catch(() => { });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Mencari elemen tunggal menembus Shadow DOM secara rekursif
 */
function queryDeepShadow(selector, root = document.body) {
    if (!root) return null;

    // Cek light DOM
    if (root.querySelector) {
        const found = root.querySelector(selector);
        if (found) return found;
    }

    // Cek Shadow DOM dan children
    const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of allElements) {
        if (el.shadowRoot) {
            const foundInShadow = queryDeepShadow(selector, el.shadowRoot);
            if (foundInShadow) return foundInShadow;
        }
    }

    return null;
}

/**
 * Mencari SEMUA elemen menembus Shadow DOM secara rekursif
 */
function queryAllDeepShadow(selector, root = document.body) {
    let results = [];

    if (!root) return results;

    // 1. Cari di scope saat ini
    if (root.querySelectorAll) {
        const found = root.querySelectorAll(selector);
        if (found.length > 0) {
            results = results.concat(Array.from(found));
        }
    }

    // 2. Cari di dalam setiap elemen yang punya shadowRoot
    const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (const el of allElements) {
        if (el.shadowRoot) {
            results = results.concat(queryAllDeepShadow(selector, el.shadowRoot));
        }
    }

    return results;
}

// --- ACTIONS ---

async function typeText(element, text) {
    element.focus();
    element.value = "";

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

    sendLog("Typing prompt...", 'info');
    for (const char of text) {
        const currentVal = element.value;
        nativeInputValueSetter.call(element, currentVal + char);

        const event = new Event('input', { bubbles: true });
        element.dispatchEvent(event);

        const delay = Math.floor(Math.random() * 20) + 5;
        await sleep(delay);
    }
}

async function setPrompt(text) {
    const textArea = queryDeepShadow('textarea[aria-label="Prompt"]');
    if (!textArea) throw new Error("Prompt textarea not found");

    await typeText(textArea, text);
    await sleep(500);
}

async function clickGenerate() {
    let btn = queryDeepShadow('[data-testid="generate-image-generate-button"]');
    if (!btn) btn = queryDeepShadow('[data-testid="refresh-button"]');
    if (!btn) btn = queryDeepShadow('button[aria-label="Generate"]');

    if (!btn) {
        const buttons = queryAllDeepShadow('button');
        btn = buttons.find(b => b.innerText.trim().toLowerCase() === 'generate');
    }

    if (!btn) throw new Error("Generate button not found");

    btn.click();
}

async function handleContentCredentials() {
    const continueBtn = queryDeepShadow('.cai-modal sp-button[variant="accent"]');
    const confirmBtn = queryDeepShadow('sp-dialog sp-button[variant="primary"]');

    if (continueBtn && continueBtn.offsetParent !== null) {
        continueBtn.click();
        await sleep(500);
    } else if (confirmBtn && confirmBtn.offsetParent !== null) {
        confirmBtn.click();
        await sleep(500);
    }
}

/**
 * Helper: Mencoba klik tombol download
 */
async function attemptDownload(promptText) {
    sendLog("Scanning for download buttons...", 'info');

    // 1. Cari tombol "Download All" (Prioritas Utama)
    const downloadAllBtns = queryAllDeepShadow('button');
    const dlAll = downloadAllBtns.find(b => {
        const label = (b.getAttribute('aria-label') || "").toLowerCase();
        return label.includes('download all') || label.includes('unduh semua');
    });

    if (dlAll) {
        sendLog("Found 'Download All' button.", 'success');
        dlAll.click();
        await handleContentCredentials();
        return 4;
    }

    // 2. Cari tombol Download individual
    // Kita perlu trigger hover pada gambar dulu karena tombol seringkali hidden
    const images = queryAllDeepShadow('img');
    const relevantImages = images.filter(img => img.src.startsWith('http') && img.width > 100); // Filter icon kecil

    if (relevantImages.length > 0) {
        sendLog(`Hovering over ${relevantImages.length} potential images...`, 'step');
        for (const img of relevantImages) {
            // Simulate Hover
            img.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            img.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        }
        await sleep(1000); // Tunggu tombol muncul
    }

    // Sekarang cari tombol
    const allButtons = queryAllDeepShadow('button');
    const downloadBtns = allButtons.filter(b => {
        const label = (b.getAttribute('aria-label') || "").toLowerCase();
        const testId = (b.getAttribute('data-testid') || "").toLowerCase();
        return label.includes('download') || label.includes('unduh') || testId.includes('download');
    });

    const visibleDlBtns = downloadBtns.filter(b => b.offsetParent !== null);

    if (visibleDlBtns.length > 0) {
        sendLog(`Found ${visibleDlBtns.length} download buttons.`, 'info');

        let successCount = 0;
        for (const btn of visibleDlBtns) {
            try {
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(300);
                btn.click();
                successCount++;
                await handleContentCredentials();
                await sleep(1500);
            } catch (e) {
                console.error("Click failed", e);
            }
        }
        return successCount;
    }

    return 0;
}

/**
 * Mengecek apakah gambar sudah muncul (Hybrid Strategy)
 */
function checkGenerationStatus(promptText, initialImageCount) {
    const images = queryAllDeepShadow('img');
    const currentImageCount = images.length;

    // 1. Cek Prompt Match (Paling Akurat)
    const searchKey = promptText.substring(0, 15).toLowerCase();
    const matched = images.some(img => {
        const alt = (img.alt || "").toLowerCase();
        return alt.includes(searchKey) && img.src.startsWith('http');
    });

    if (matched) return { ready: true, reason: "matched_prompt" };

    // 2. Cek Count Increase (Fallback)
    // Jika jumlah gambar bertambah signifikan (misal +4), anggap selesai
    if (currentImageCount >= initialImageCount + 4) {
        return { ready: true, reason: "count_increase" };
    }

    return { ready: false, count: currentImageCount };
}

/**
 * Fungsi Utama: Polling dengan Log Periodik dan Fallback Timeout
 */
async function pollAndDownload(promptText, initialImageCount, timeoutMs = 45000) {
    const startTime = Date.now();
    let nextLogTime = 0;

    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            const now = Date.now();
            const elapsed = now - startTime;

            const status = checkGenerationStatus(promptText, initialImageCount);

            if (status.ready) {
                clearInterval(interval);
                sendLog(`Image Generated! (${status.reason})`, 'success');

                // 1. Wait 5 seconds as requested
                sendLog("Waiting 5s for UI stability...", 'step');
                await sleep(5000);

                // 2. Retry 3x
                for (let i = 1; i <= 3; i++) {
                    sendLog(`Attempting download (Try ${i}/3)...`, 'info');
                    const count = await attemptDownload(promptText);

                    if (count > 0) {
                        resolve(count);
                        return;
                    }

                    if (i < 3) {
                        sendLog("Download failed, retrying in 3s...", 'warning');
                        await sleep(3000);
                    }
                }

                // 3. If all fail, continue to next prompt (Resolve 0)
                sendLog("Failed to download after 3 attempts. Skipping...", 'error');
                resolve(0);
                return;
            }

            if (elapsed > timeoutMs) {
                clearInterval(interval);
                sendLog("Timeout waiting for image generation.", 'error');
                reject(new Error("Timeout: Image did not appear in time."));
                return;
            }

            if (now >= nextLogTime) {
                sendLog(`Waiting... (Img count: ${status.count})`, 'step');
                nextLogTime = now + 5000;
            }

        }, 2000);
    });
}


// --- MAIN MESSAGE LISTENER ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "PROCESS_PROMPT") {
        (async () => {
            try {
                // Hitung baseline image count
                const initialImages = queryAllDeepShadow('img');
                const initialCount = initialImages.length;
                sendLog(`Baseline images: ${initialCount}`, 'info');

                await setPrompt(request.prompt);
                await clickGenerate();

                const count = await pollAndDownload(request.prompt, initialCount, 45000);

                sendLog(`Success! Downloaded ${count} images.`, 'success');
                sendResponse({ status: "success", count: count });

                const waitTime = Math.floor(Math.random() * 3000) + 2000;
                await sleep(waitTime);

            } catch (error) {
                console.error("Automation Error:", error);
                if (!error.message.includes("Timeout")) {
                    sendLog(`${error.message}`, 'error');
                }
                sendResponse({ status: "error", message: error.message });
            }
        })();
        return true;
    }
});
