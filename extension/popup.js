document.addEventListener('DOMContentLoaded', () => {
  const urlDisplay = document.getElementById('urlDisplay');
  const titleDisplay = document.getElementById('titleDisplay');
  const saveBtn = document.getElementById('saveBtn');

  let currentUrl = '';

  // Get the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab) {
      currentUrl = tab.url;
      urlDisplay.textContent = new URL(tab.url).hostname;
      titleDisplay.textContent = tab.title || 'No Title';
    }
  });

  saveBtn.addEventListener('click', () => {
    if (!currentUrl) return;
    
    // Change this to your Vercel URL when deploying the extension!
    // e.g. const APP_URL = 'https://clipnest.vercel.app';
    const APP_URL = 'http://localhost:5173';
    
    const targetUrl = `${APP_URL}/?saveUrl=${encodeURIComponent(currentUrl)}`;
    
    // Open the ClipNest app in a new tab with the URL to save
    chrome.tabs.create({ url: targetUrl });
  });
});
