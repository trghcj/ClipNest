chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-clipnest",
    title: "Save Highlight to ClipNest",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-clipnest" && info.selectionText) {
    if (!tab || !tab.url) return;
    
    const highlightText = info.selectionText;
    const url = tab.url;

    // Send to backend
    chrome.storage.local.get(['clipnest_token'], (result) => {
      const token = result.clipnest_token;
      if (!token) {
        // We can't use alert() in background scripts of MV3
        // Instead, we can inject a content script to show a toast or open the popup
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => alert("Please log in to the ClipNest extension first to save highlights.")
        });
        return;
      }

      fetch("http://localhost:8000/api/v1/extension/annotations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          highlight_text: highlightText,
          url: url
        })
      })
      .then(response => {
        if (!response.ok) throw new Error("Failed to save annotation");
        return response.json();
      })
      .then(data => {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => alert("Highlight saved to ClipNest!")
        });
      })
      .catch(error => {
        console.error("Error saving highlight:", error);
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => alert("Error saving highlight. Check console for details.")
        });
      });
    });
  }
});
