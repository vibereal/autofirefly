
// Mengizinkan user membuka side panel dengan mengklik icon ekstensi
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('firefly.adobe.com')) {
    console.log("Firefly detected.");
  }
});
