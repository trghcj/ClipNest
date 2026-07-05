window.addEventListener('message', (event) => {
  // We only accept messages from ourselves
  if (event.source !== window) return;

  if (event.data.type && event.data.type === 'CLIPNEST_AUTH_TOKEN') {
    if (event.data.token) {
      chrome.storage.local.set({ clipnest_token: event.data.token }, () => {
        console.log('ClipNest extension: Auth token synced successfully!');
      });
    } else {
      chrome.storage.local.remove('clipnest_token', () => {
        console.log('ClipNest extension: Auth token cleared (logged out).');
      });
    }
  }
});
