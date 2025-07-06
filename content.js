class MemoryManager {
  constructor() {
    this.isEnabled = false;
    this.initialize();
    this.seen = new Set();
  }

  async initialize() {
    const result = await chrome.storage.local.get(["extensionEnabled"]);
    this.isEnabled = result.extensionEnabled === true;
    if (this.isEnabled) this.startMonitoring();
  }

  startMonitoring() {
    if (!this.isEnabled) {
      console.log("🛑 Extension is disabled. Not monitoring.");
      return;
    }

    if (this.observer) {
      console.log("📡 Already monitoring.");
      return;
    }

    console.log("✅ Monitoring enabled.");
    this.observer = new MutationObserver(() => {
      const userMessages = document.querySelectorAll(
        '[data-message-author-role="user"]',
      );
      userMessages.forEach((msg) => {
        const text = msg.innerText?.trim();
        if (text && !this.seen.has(text)) {
          this.seen.add(text);
          console.log("🧠 Captured prompt:", text);
          this.storeMemory(text);
        }
      });
    });

    this.observer.observe(document.body, {
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
              content,
              timestamp: new Date().toISOString(),
            },
          ],
        },
        () => {
          console.log("💾 Memory saved.");
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
