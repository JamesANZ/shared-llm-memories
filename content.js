// Memory extraction and injection logic
class MemoryManager {
  constructor() {
    this.isEnabled = false;
    this.observer = null;
    this.lastExtractedPrompts = new Set();
    this.initializeMessageListener();
    this.checkToggleState();

    // Debug: Log that the extension is loaded
    console.log("Shared LLM Memories extension loaded");
  }

  initializeMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "toggleExtension") {
        this.toggleExtension(request.enabled);
      } else if (request.action === "injectMemories") {
        this.injectMemories(request.memories);
      }
    });
  }

  async checkToggleState() {
    const result = await chrome.storage.local.get(["extensionEnabled"]);
    // Default to false if not set
    this.isEnabled = result.extensionEnabled === true;
    console.log("Extension enabled:", this.isEnabled);
    if (this.isEnabled) {
      this.startMonitoring();
    }
  }

  toggleExtension(enabled) {
    this.isEnabled = enabled;
    console.log("Extension toggled:", enabled);
    if (enabled) {
      this.startMonitoring();
    } else {
      this.stopMonitoring();
    }
  }

  startMonitoring() {
    if (this.observer) return; // Already monitoring

    console.log("Starting to monitor for prompts...");

    // Start observing DOM changes
    this.observer = new MutationObserver((mutations) => {
      this.checkForNewPrompts();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Initial check
    this.checkForNewPrompts();
  }

  stopMonitoring() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log("Stopped monitoring");
    }
  }

  checkForNewPrompts() {
    if (!this.isEnabled) return;

    const platform = this.detectPlatform();
    console.log("Checking for prompts on platform:", platform);

    let newPrompts = [];

    switch (platform) {
      case "chatgpt":
        newPrompts = this.getNewChatGPTPrompts();
        break;
      case "claude":
        newPrompts = this.getNewClaudePrompts();
        break;
      case "venice":
        newPrompts = this.getNewVenicePrompts();
        break;
    }

    if (newPrompts.length > 0) {
      console.log("Found new prompts:", newPrompts);
      this.storePrompts(newPrompts, platform);
    }
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes("chatgpt.com")) return "chatgpt";
    if (hostname.includes("claude.ai")) return "claude";
    if (hostname.includes("venice.ai")) return "venice";
    return null;
  }

  getNewChatGPTPrompts() {
    console.log("Looking for ChatGPT prompts...");

    // Try multiple selectors to find user messages
    const selectors = [
      '[data-message-author-role="user"]',
      ".user-message",
      '[data-testid="user-message"]',
      ".markdown",
      ".prose",
      "[data-message-author-role]",
    ];

    let allMessages = [];

    selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      console.log(
        `Found ${elements.length} elements with selector: ${selector}`,
      );
      allMessages.push(...Array.from(elements));
    });

    // Remove duplicates
    const uniqueMessages = [...new Set(allMessages)];
    console.log("Total unique message elements found:", uniqueMessages.length);

    const newPrompts = [];

    uniqueMessages.forEach((message, index) => {
      const messageText = message.textContent.trim();
      console.log(`Message ${index}:`, messageText.substring(0, 100) + "...");

      if (messageText && !this.lastExtractedPrompts.has(messageText)) {
        // For now, let's be more permissive and extract any user message
        // that looks like it might be a prompt
        if (messageText.length > 10) {
          // Only extract substantial messages
          newPrompts.push(messageText);
          this.lastExtractedPrompts.add(messageText);
          console.log(
            "Extracted prompt:",
            messageText.substring(0, 100) + "...",
          );
        }
      }
    });

    return newPrompts;
  }

  getNewClaudePrompts() {
    console.log("Looking for Claude prompts...");

    const selectors = [
      '[data-testid="user-message"]',
      ".user-message",
      '[data-message-author-role="user"]',
    ];

    let allMessages = [];

    selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      console.log(
        `Found ${elements.length} elements with selector: ${selector}`,
      );
      allMessages.push(...Array.from(elements));
    });

    const uniqueMessages = [...new Set(allMessages)];
    const newPrompts = [];

    uniqueMessages.forEach((message) => {
      const messageText = message.textContent.trim();
      if (
        messageText &&
        !this.lastExtractedPrompts.has(messageText) &&
        messageText.length > 10
      ) {
        newPrompts.push(messageText);
        this.lastExtractedPrompts.add(messageText);
      }
    });

    return newPrompts;
  }

  getNewVenicePrompts() {
    console.log("Looking for Venice prompts...");

    const selectors = [
      ".user-message",
      '[data-testid="user-message"]',
      '[data-message-author-role="user"]',
    ];

    let allMessages = [];

    selectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      console.log(
        `Found ${elements.length} elements with selector: ${selector}`,
      );
      allMessages.push(...Array.from(elements));
    });

    const uniqueMessages = [...new Set(allMessages)];
    const newPrompts = [];

    uniqueMessages.forEach((message) => {
      const messageText = message.textContent.trim();
      if (
        messageText &&
        !this.lastExtractedPrompts.has(messageText) &&
        messageText.length > 10
      ) {
        newPrompts.push(messageText);
        this.lastExtractedPrompts.add(messageText);
      }
    });

    return newPrompts;
  }

  storePrompts(prompts, platform) {
    chrome.storage.local.get(["memories"], (result) => {
      const existingMemories = result.memories || [];
      const newMemories = prompts.map((prompt) => ({
        platform: platform,
        content: prompt,
        timestamp: new Date().toISOString(),
      }));

      // Add new prompts
      const allMemories = [...existingMemories, ...newMemories];

      chrome.storage.local.set({ memories: allMemories }, () => {
        console.log("New prompts stored:", newMemories.length);
        console.log("Total memories now:", allMemories.length);
      });
    });
  }

  injectMemories(memories) {
    const platform = this.detectPlatform();
    const inputField = this.findInputField(platform);

    if (inputField) {
      const context = this.formatMemoriesForInjection(memories);
      inputField.value = context + inputField.value;

      // Trigger input event to update the UI
      inputField.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  findInputField(platform) {
    switch (platform) {
      case "chatgpt":
        return document.querySelector('textarea[data-id="root"]');
      case "claude":
        return document.querySelector('textarea[data-testid="composer"]');
      case "venice":
        return document.querySelector(".chat-input");
      default:
        return null;
    }
  }

  formatMemoriesForInjection(memories) {
    return memories
      .map(
        (memory) =>
          `[Memory from ${memory.platform} (${new Date(memory.timestamp).toLocaleString()})]:\n${memory.content}\n\n`,
      )
      .join("");
  }
}

// Initialize the memory manager
const memoryManager = new MemoryManager();
