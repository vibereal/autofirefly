
// --- UTILS ---

function sendLog(message, type = 'step') {
    chrome.runtime.sendMessage({ action: "LOG", message, type }).catch(() => {});
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
        
        const event = new Event('input', { bubbles: true});
        element.dispatchEvent(event);
        
        // Random delay (Human-like typing)
        const delay = Math.floor(Math.random() * 40) + 10;
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
  if (!btn) btn = queryDeepShadow('firefly-image-generation-generate-button button');

  if (!btn) throw new Error("Generate button not found");
  
  btn.click();
  // sendLog("Clicked Generate.", 'info'); // Optional, merged with typing log flow
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
 * Helper: Mencoba klik tombol download pada suatu elemen batch
 * Mengembalikan jumlah gambar yang berhasil diklik (0 jika gagal)
 */
async function attemptDownloadOnBatch(batchElement) {
    if (!batchElement) return 0;

    // A. Cek Tombol "Download All"
    const downloadAllBtn = queryDeepShadow('[data-testid="batch-action-downloadAll"]', batchElement);
    if (downloadAllBtn) {
        sendLog("Downloading image...", 'info');
        downloadAllBtn.click();
        await handleContentCredentials();
        return 4; // Asumsi batch penuh
    }

    // B. Cek Tombol Individual
    // Selector spesifik berdasarkan HTML yang diberikan user
    const individualBtns = queryAllDeepShadow('[data-testid="thumbnail-button-download"]', batchElement);
    
    if (individualBtns.length > 0) {
        sendLog("Downloading image...", 'info');
        
        let successCount = 0;
        for (const btn of individualBtns) {
            try {
                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(200);
                btn.click();
                successCount++;
                await handleContentCredentials();
                await sleep(1000); 
            } catch (e) {}
        }
        return successCount;
    }

    return 0;
}

/**
 * Fungsi Utama: Polling dengan Log Periodik dan Fallback Timeout
 */
async function pollAndDownload(initialBatchCount, timeoutMs = 30000) { // 30 Detik Timeout
    const startTime = Date.now();
    let nextLogTime = 0; // Trigger log pertama kali
    
    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            const now = Date.now();
            const elapsed = now - startTime;
            
            const currentBatches = queryAllDeepShadow('firefly-image-generation-batch');
            const newestBatch = currentBatches[currentBatches.length - 1];
            
            // Cek apakah ada indikator keberhasilan (batch bertambah & ada tombol)
            // Kita lakukan "Dry Run" query dulu sebelum eksekusi klik
            let isReady = false;
            
            if (currentBatches.length > initialBatchCount && newestBatch) {
                 const dlAll = queryDeepShadow('[data-testid="batch-action-downloadAll"]', newestBatch);
                 const dlInd = queryAllDeepShadow('[data-testid="thumbnail-button-download"]', newestBatch);
                 if (dlAll || dlInd.length > 0) {
                     isReady = true;
                 }
            }

            // --- LOGIC FLOW ---
            
            if (isReady) {
                // 1. Gambar ditemukan
                clearInterval(interval);
                sendLog("Image Generated!", 'success');
                
                const count = await attemptDownloadOnBatch(newestBatch);
                if (count > 0) {
                    resolve(count);
                } else {
                    reject(new Error("Download buttons detected but click failed."));
                }
                return;
            } 
            
            // 2. Timeout Logic (Fallback Force Download)
            if (elapsed > timeoutMs) {
                clearInterval(interval);
                
                // Coba download paksa dari batch terakhir yang ada (fallback)
                if (newestBatch) {
                    const count = await attemptDownloadOnBatch(newestBatch);
                    if (count > 0) {
                        sendLog("Recovered via fallback download.", 'success');
                        resolve(count);
                    } else {
                        sendLog("Image not generated / Failed.", 'error');
                        reject(new Error("Failed to download after 30s timeout."));
                    }
                } else {
                    sendLog("Image not generated.", 'error');
                    reject(new Error("No batches found."));
                }
                return;
            }

            // 3. Logging Berkala (Setiap 5 detik jika belum ready)
            if (now >= nextLogTime) {
                sendLog("Checking Generated Image.....", 'step');
                // Jika batch belum bertambah atau tombol belum ada
                if (!isReady && elapsed > 1000) { 
                    sendLog("Image not generated", 'info');
                    sendLog("Checking Generated Image.....", 'step');
                }
                nextLogTime = now + 5000;
            }

        }, 2000); // Cek teknis tiap 2 detik
    });
}


// --- MAIN MESSAGE LISTENER ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "PROCESS_PROMPT") {
    (async () => {
      try {
        // Hitung batch sebelum klik generate
        const initialBatches = queryAllDeepShadow('firefly-image-generation-batch');
        const initialBatchCount = initialBatches.length;
        
        await setPrompt(request.prompt);
        await clickGenerate();
        
        // Wait max 30 seconds
        const count = await pollAndDownload(initialBatchCount, 30000);
        
        sendLog(`Success!`, 'success');
        sendResponse({ status: "success", count: count });

        // Random Cooldown (1-3 detik)
        const waitTime = Math.floor(Math.random() * 2000) + 1000;
        // sendLog(`Waiting ${waitTime}ms...`); 
        await sleep(waitTime);

      } catch (error) {
        console.error("Automation Error:", error);
        // Error message sudah dikirim di dalam pollAndDownload biasanya
        if (!error.message.includes("Failed to download")) {
            sendLog(`${error.message}`, 'error');
        }
        sendResponse({ status: "error", message: error.message });
      }
    })();
    return true;
  }
});
