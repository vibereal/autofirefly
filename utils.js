
/**
 * Mencari elemen di dalam nested Shadow DOM.
 * @param {string} selector - CSS selector biasa, tapi bisa menembus shadow root.
 * @param {Element} root - Root element untuk memulai pencarian (default document.body).
 * @returns {Element|null}
 */
export function queryShadowRoot(selector, root = document.body) {
  // Helper untuk traverse
  function find(el, selector) {
    if (!el) return null;
    
    // Cek di elemen ini sendiri (light dom children)
    let found = el.querySelector(selector);
    if (found) return found;

    // Jika punya shadowRoot, cari di dalamnya
    if (el.shadowRoot) {
      found = el.shadowRoot.querySelector(selector);
      if (found) return found;
      
      // Recursive ke children dalam shadowRoot
      const children = Array.from(el.shadowRoot.querySelectorAll('*'));
      for (const child of children) {
        const res = find(child, selector);
        if (res) return res;
      }
    }

    // Recursive ke children biasa
    const children = Array.from(el.children);
    for (const child of children) {
      const res = find(child, selector);
      if (res) return res;
    }

    return null;
  }

  return find(root, selector);
}

/**
 * Menunggu elemen muncul di DOM (termasuk dalam Shadow DOM).
 */
export function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const intervalTime = 500;
    let elapsed = 0;

    const check = () => {
      const el = queryShadowRoot(selector);
      if (el) {
        resolve(el);
      } else {
        elapsed += intervalTime;
        if (elapsed >= timeout) {
          reject(new Error(`Timeout waiting for ${selector}`));
        } else {
          setTimeout(check, intervalTime);
        }
      }
    };
    check();
  });
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export const randomSleep = (min, max) => sleep(Math.floor(Math.random() * (max - min + 1) + min));
