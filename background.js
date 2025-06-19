// Background script for managing extension state and communication
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed/updated, checking storage...");
  // Only initialize if storage is completely empty
  chrome.storage.local.get(null, (result) => {
    console.log("Current storage state:", result);

    // If storage is completely empty, initialize with defaults
    if (Object.keys(result).length === 0) {
      console.log("Storage is empty, initializing with defaults...");
      chrome.storage.local.set(
        {
          memories: [],
          extensionEnabled: false,
        },
        () => {
          console.log("Storage initialized with defaults");
        },
      );
    } else {
      console.log("Storage already has data, not initializing");
    }
  });
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request);

  if (request.action === "getMemories") {
    chrome.storage.local.get(["memories"], (result) => {
      console.log("Getting memories:", result.memories);
      sendResponse({ memories: result.memories || [] });
    });
    return true; // Required for async sendResponse
  }

  if (request.action === "getToggleState") {
    chrome.storage.local.get(["extensionEnabled"], (result) => {
      console.log("Getting toggle state, raw result:", result);
      // Default to false if not set
      const enabled = result.extensionEnabled === true;
      console.log("Returning toggle state:", enabled);
      sendResponse({ enabled: enabled });
    });
    return true; // Required for async sendResponse
  }

  if (request.action === "setToggleState") {
    console.log("Setting toggle state to:", request.enabled);
    chrome.storage.local.set({ extensionEnabled: request.enabled }, () => {
      console.log("Toggle state saved to storage:", request.enabled);
      // Broadcast toggle state to all tabs
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs
            .sendMessage(tab.id, {
              action: "toggleExtension",
              enabled: request.enabled,
            })
            .catch(() => {
              // Ignore errors for tabs that don't have our content script
            });
        });
      });
      sendResponse({ success: true });
    });
    return true; // Required for async sendResponse
  }

  if (request.action === "clearMemories") {
    chrome.storage.local.set({ memories: [] }, () => {
      sendResponse({ success: true });
    });
    return true; // Required for async sendResponse
  }

  if (request.action === "syncMemories") {
    // Broadcast memories to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, {
            action: "injectMemories",
            memories: request.memories,
          })
          .catch(() => {
            // Ignore errors for tabs that don't have our content script
          });
      });
    });
    sendResponse({ success: true });
    return true;
  }

  // If we get here, it's an unknown action
  console.log("Unknown action:", request.action);
  sendResponse({ error: "Unknown action" });
  return true;
});
