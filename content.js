class MemoryManager {
  constructor() {
    this.isEnabled = false;
    this.initialize();
    this.seen = new Set();

    // Listen for toggle state changes from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "toggleExtension") {
        console.log("🔄 Toggle state changed to:", request.enabled);
        this.isEnabled = request.enabled;
        if (this.isEnabled) {
          this.startMonitoring();
        } else {
          this.stopMonitoring();
        }
        sendResponse({ success: true });
      }

      if (request.action === "injectMemories") {
        console.log("💉 Injecting memories:", request.memories);
        try {
          this.injectMemories(request.memories);
          console.log("✅ Injection completed successfully");
          sendResponse({
            success: true,
            message: "Memories injected successfully",
          });
        } catch (error) {
          console.error("❌ Error injecting memories:", error);
          sendResponse({ success: false, message: error.message });
        }
        return true; // Keep the message channel open for async response
      }
    });
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

  stopMonitoring() {
    if (this.observer) {
      console.log("🛑 Stopping monitoring.");
      this.observer.disconnect();
      this.observer = null;
    }
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

  injectMemories(memories) {
    const platform = this.detectPlatform();

    if (platform === "chatgpt") {
      this.injectIntoChatGPT(memories);
    } else if (platform === "claude") {
      this.injectIntoClaude(memories);
    } else if (platform === "venice") {
      this.injectIntoVenice(memories);
    } else {
      console.log("❌ Unknown platform for injection:", platform);
    }
  }

  injectIntoChatGPT(memories) {
    // Find the ChatGPT input - try both contenteditable div and textarea for different UI versions
    const contentEditableDiv =
      document.querySelector(
        'div[contenteditable="true"][id="prompt-textarea"]',
      ) ||
      document.querySelector(
        'div[contenteditable="true"][data-virtualkeyboard="true"]',
      ) ||
      document.querySelector('div[contenteditable="true"]');

    const textarea =
      document.querySelector('textarea[data-id="root"]') ||
      document.querySelector('textarea[placeholder*="Message"]') ||
      document.querySelector('textarea[placeholder*="Send a message"]') ||
      document.querySelector('textarea[placeholder*="chat"]') ||
      document.querySelector("textarea");

    let inputElement = null;
    let isContentEditable = false;

    if (contentEditableDiv) {
      inputElement = contentEditableDiv;
      isContentEditable = true;
      console.log("✅ Found ChatGPT contenteditable div");
    } else if (textarea) {
      inputElement = textarea;
      isContentEditable = false;
      console.log("✅ Found ChatGPT textarea");
    } else {
      console.log("❌ Could not find ChatGPT input element");
      return;
    }

    // Format memories as context
    const contextText = this.formatMemoriesAsContext(memories);

    if (isContentEditable) {
      // Handle contenteditable div
      const currentText = inputElement.textContent || "";

      // Add context invisibly by storing it in a data attribute
      inputElement.setAttribute("data-memory-context", contextText);

      // If there's already text, prepend the context invisibly
      if (currentText) {
        const newText = `${contextText}${currentText}`;
        inputElement.textContent = newText;
      } else {
        // If no text, just set the context as the value
        inputElement.textContent = contextText;
      }

      // Trigger input event to update ChatGPT's internal state
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));

      // Also trigger keydown event to simulate user input
      inputElement.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    } else {
      // Handle textarea (legacy)
      const currentText = inputElement.value || "";

      // Add context invisibly by storing it in a data attribute
      inputElement.setAttribute("data-memory-context", contextText);

      // If there's already text, prepend the context invisibly
      if (currentText) {
        const newText = `${contextText}${currentText}`;
        inputElement.value = newText;
      } else {
        // If no text, just set the context as the value
        inputElement.value = contextText;
      }

      // Trigger input event to update ChatGPT's internal state
      inputElement.dispatchEvent(new Event("input", { bubbles: true }));
      inputElement.dispatchEvent(new Event("change", { bubbles: true }));
    }

    console.log("✅ Memories injected into ChatGPT (invisible context)");
    console.log("Context length:", contextText.length, "characters");
  }

  injectIntoClaude(memories) {
    // Find Claude's textarea
    const textarea =
      document.querySelector('textarea[placeholder*="Message"]') ||
      document.querySelector("textarea");

    if (!textarea) {
      console.log("❌ Could not find Claude textarea");
      return;
    }

    const contextText = this.formatMemoriesAsContext(memories);
    const currentText = textarea.value || "";
    const newText = currentText
      ? `${contextText}\n\n${currentText}`
      : contextText;

    textarea.value = newText;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    console.log("✅ Memories injected into Claude");
  }

  injectIntoVenice(memories) {
    // Find Venice's textarea
    const textarea =
      document.querySelector('textarea[placeholder*="Message"]') ||
      document.querySelector("textarea");

    if (!textarea) {
      console.log("❌ Could not find Venice textarea");
      return;
    }

    const contextText = this.formatMemoriesAsContext(memories);
    const currentText = textarea.value || "";
    const newText = currentText
      ? `${contextText}\n\n${currentText}`
      : contextText;

    textarea.value = newText;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    console.log("✅ Memories injected into Venice");
  }

  formatMemoriesAsContext(memories) {
    if (!memories || memories.length === 0) {
      return "";
    }

    // Group memories by platform
    const memoriesByPlatform = memories.reduce((acc, memory) => {
      if (!acc[memory.platform]) {
        acc[memory.platform] = [];
      }
      acc[memory.platform].push(memory);
      return acc;
    }, {});

    // Format as invisible context using zero-width characters
    let context = "\u200B"; // Zero-width space to make it invisible

    Object.entries(memoriesByPlatform).forEach(
      ([platform, platformMemories]) => {
        context += `\u200BContext from ${platform}:\u200B `;
        platformMemories.forEach((memory, index) => {
          // Truncate long memories to keep context manageable
          const truncatedContent =
            memory.content.length > 200
              ? memory.content.substring(0, 200) + "..."
              : memory.content;
          context += `\u200B${index + 1}. ${truncatedContent.replace(/\n/g, " ")}\u200B `;
        });
        context += "\u200B";
      },
    );

    context += "\u200B"; // End with zero-width space

    return context;
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
