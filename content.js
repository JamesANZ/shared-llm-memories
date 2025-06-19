class MemoryManager {
  constructor() {
    this.isEnabled = false;
    this.initialize();
  }

  async initialize() {
    const result = await chrome.storage.local.get(["extensionEnabled"]);
    this.isEnabled = result.extensionEnabled === true;
    if (this.isEnabled) this.startMonitoring();
  }

  startMonitoring() {
    const observer = new MutationObserver(() => {
      // Wait a short delay so full assistant message is rendered
      setTimeout(() => {
        const messages = [
          ...document.querySelectorAll("[data-message-author-role]"),
        ];
        const parsed = messages.map((el) => ({
          role: el.getAttribute("data-message-author-role"),
          text: el.textContent.trim(),
        }));

        // Get the last user + assistant pair
        for (let i = parsed.length - 2; i >= 0; i--) {
          if (
            parsed[i].role === "user" &&
            parsed[i + 1]?.role === "assistant"
          ) {
            const toSave = [parsed[i], parsed[i + 1]];
            console.log("💾 Saving full pair:", toSave);
            this.storeMemory(toSave);
            break;
          }
        }
      }, 300); // small delay ensures assistant reply is fully rendered
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  storeMemory(content) {
    if (!content) return;
    chrome.storage.local.get(["memories"], (result) => {
      const existing = result.memories || [];
      chrome.storage.local.set(
        {
          memories: [
            ...existing,
            {
              platform: this.detectPlatform(),
              content, // Stored as array of two objects: [{user}, {assistant}]
              timestamp: new Date().toISOString(),
            },
          ],
        },
        () => {
          console.log("✅ Memory saved.");
        },
      );
    });
  }

  detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("chatgpt.com")) return "chatgpt";
    if (host.includes("claude.ai")) return "claude";
    if (host.includes("venice.ai")) return "venice";
    return "unknown";
  }
}

// Initialize
new MemoryManager();
