
let prompts = [];
let isRunning = false;
let isPaused = false;
let currentIndex = 0;

const fileInput = document.getElementById('fileInput');
const promptPreview = document.getElementById('promptPreview');
const startBtn = document.getElementById('startBtn');
const resumeBtn = document.getElementById('resumeBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');

const logContainer = document.getElementById('logs');
const totalCountSpan = document.getElementById('totalCount');
const progressText = document.getElementById('progressText');
const statusText = document.getElementById('statusText');
const progressFill = document.getElementById('progressFill');

// --- UI UPDATERS ---

function addLog(message, type = 'info') {
  const div = document.createElement('div');
  div.className = `log-item log-${type}`;
  
  // Simple timestamp
  const time = new Date().toLocaleTimeString([], { hour12: false });
  div.innerText = `[${time}] ${message}`;
  
  logContainer.appendChild(div);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function updateProgress() {
  totalCountSpan.innerText = prompts.length;
  progressText.innerText = `${currentIndex} / ${prompts.length}`;
  const percent = prompts.length > 0 ? (currentIndex / prompts.length) * 100 : 0;
  progressFill.style.width = `${percent}%`;
}

function updateControls() {
  if (isRunning) {
    startBtn.disabled = true;
    resumeBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    fileInput.disabled = true;
    statusText.innerText = "Running...";
    statusText.style.color = "#2563eb";
  } else if (isPaused) {
    startBtn.disabled = true; // Can't start new while paused, must stop first
    resumeBtn.disabled = false;
    pauseBtn.disabled = true;
    stopBtn.disabled = false;
    statusText.innerText = "Paused";
    statusText.style.color = "#f59e0b";
  } else {
    // Idle / Stopped
    startBtn.disabled = prompts.length === 0;
    resumeBtn.disabled = true;
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    fileInput.disabled = false;
    statusText.innerText = "Idle";
    statusText.style.color = "#6b7280";
  }
}

// --- LISTENERS ---

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    prompts = text.split(/\r?\n/).filter(line => line.trim() !== '');
    promptPreview.value = prompts.join('\n');
    currentIndex = 0;
    
    // Reset states
    isRunning = false;
    isPaused = false;
    
    updateProgress();
    updateControls();
    addLog(`Loaded ${prompts.length} prompts.`, 'info');
  };
  reader.readAsText(file);
});

// Handle "LOG" messages from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "LOG") {
    addLog(message.message, message.type);
  }
});

startBtn.addEventListener('click', () => {
  if (prompts.length === 0) return;
  currentIndex = 0; // Reset index for new start
  isRunning = true;
  isPaused = false;
  updateControls();
  addLog('Starting automation from beginning...', 'info');
  runAutomation();
});

resumeBtn.addEventListener('click', () => {
  if (currentIndex >= prompts.length) {
    addLog('All prompts already completed. Please Start New.', 'info');
    return;
  }
  isRunning = true;
  isPaused = false;
  updateControls();
  addLog(`Resuming from prompt ${currentIndex + 1}...`, 'info');
  runAutomation();
});

pauseBtn.addEventListener('click', () => {
  isRunning = false;
  isPaused = true;
  updateControls();
  addLog('Pausing after current operation finishes...', 'info');
});

stopBtn.addEventListener('click', () => {
  isRunning = false;
  isPaused = false;
  currentIndex = 0;
  updateProgress();
  updateControls();
  addLog('Automation stopped & reset.', 'error');
});

resetBtn.addEventListener('click', () => {
  isRunning = false;
  isPaused = false;
  currentIndex = 0;
  prompts = [];
  
  fileInput.value = '';
  promptPreview.value = '';
  logContainer.innerHTML = '';
  
  updateProgress();
  updateControls();
  addLog('Reset complete.', 'info');
});

// --- AUTOMATION LOOP ---

async function runAutomation() {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs[0];

    if (!tab || !tab.url || !tab.url.includes('firefly.adobe.com')) {
      addLog('Error: Please open Adobe Firefly tab first.', 'error');
      isRunning = false;
      updateControls();
      return;
    }

    processQueue(tab.id);

  } catch (err) {
    addLog(`Init Error: ${err.message}`, 'error');
    isRunning = false;
    updateControls();
  }
}

async function processQueue(tabId) {
  while (isRunning && currentIndex < prompts.length) {
    
    // Check pause state again at start of loop
    if (isPaused) {
      isRunning = false;
      updateControls();
      break;
    }

    const currentPrompt = prompts[currentIndex];
    updateProgress();
    
    // addLog(`Prompt ${currentIndex + 1}: "${currentPrompt.substring(0, 30)}..."`, 'info');

    try {
      // Execute in content script
      const response = await chrome.tabs.sendMessage(tabId, { 
        action: "PROCESS_PROMPT", 
        prompt: currentPrompt 
      });

      if (response && response.status === "success") {
        // addLog(`Completed. Downloads: ${response.count}`, 'success');
      } else {
        addLog(`Failed: ${response ? response.message : 'Unknown error'}`, 'error');
      }

    } catch (error) {
      if (error.message.includes('Receiving end does not exist')) {
         addLog('Lost connection to page. Refresh Firefly & Restart.', 'error');
         isRunning = false;
         isPaused = false;
         updateControls();
         return;
      } else {
         addLog(`Error: ${error.message}`, 'error');
      }
    }

    // Move to next
    currentIndex++;
    updateProgress();

    // Check if user paused during execution
    if (isPaused) {
      isRunning = false;
      updateControls();
      addLog('Paused.', 'info');
      break;
    }
  }

  if (currentIndex >= prompts.length) {
    addLog('All prompts processed!', 'success');
    isRunning = false;
    isPaused = false;
    updateControls();
  }
}
