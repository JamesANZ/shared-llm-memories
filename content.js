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

    const platform = this.detectPlatform();
    if (platform === "venice") {
      // Wait for Venice interface to be ready
      this.waitForVeniceInterface();

      // Set up periodic checking for dynamic content
      setInterval(() => {
        const textareas = document.querySelectorAll("textarea");
        if (textareas.length > 0) {
          console.log("🔍 Venice.ai - Found textareas:", textareas.length);
          textareas.forEach((textarea, index) => {
            console.log(`Textarea ${index}:`, {
              class: textarea.className,
              placeholder: textarea.placeholder,
              id: textarea.id,
            });
          });
        }
      }, 2000); // Check every 2 seconds

      // Add submit event listener to catch messages when sent
      document.addEventListener("submit", (event) => {
        console.log("🔍 Venice.ai - Form submitted:", event.target);
        const textarea = event.target.querySelector("textarea");
        if (textarea && textarea.value.trim()) {
          const text = textarea.value.trim();
          if (!this.seen.has(text)) {
            this.seen.add(text);
            console.log("🧠 Captured Venice submitted message:", text);
            this.storeMemory(text);
          }
        }
      });

      // Also listen for button clicks that might submit messages
      document.addEventListener("click", (event) => {
        if (
          event.target.tagName === "BUTTON" &&
          (event.target.textContent.includes("Submit") ||
            event.target.getAttribute("aria-label")?.includes("Submit"))
        ) {
          console.log("🔍 Venice.ai - Submit button clicked:", event.target);
          const textarea = document.querySelector("textarea");
          if (textarea && textarea.value.trim()) {
            const text = textarea.value.trim();
            if (!this.seen.has(text)) {
              this.seen.add(text);
              console.log("🧠 Captured Venice button-submitted message:", text);
              this.storeMemory(text);
            }
          }
        }
      });
    }

    this.observer = new MutationObserver(() => {
      const platform = this.detectPlatform();

      if (platform === "chatgpt") {
        // ChatGPT: Look for user messages
        const userMessages = document.querySelectorAll(
          '[data-message-author-role="user"]',
        );
        userMessages.forEach((msg) => {
          const text = msg.innerText?.trim();
          if (text && !this.seen.has(text)) {
            this.seen.add(text);
            console.log("🧠 Captured ChatGPT prompt:", text);
            this.storeMemory(text);
          }
        });
      } else if (platform === "claude") {
        // Claude: Look for user messages
        const userMessages = document.querySelectorAll(
          '[data-message-author-role="user"]',
        );
        userMessages.forEach((msg) => {
          const text = msg.innerText?.trim();
          if (text && !this.seen.has(text)) {
            this.seen.add(text);
            console.log("🧠 Captured Claude prompt:", text);
            this.storeMemory(text);
          }
        });
      }
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
        inputElement.textContent = `${contextText}${currentText}`;
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
        inputElement.value = `${contextText}${currentText}`;
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
    // Find Venice's textarea using the correct class
    const textarea =
      document.querySelector("textarea.chakra-textarea.css-1mba8or") ||
      document.querySelector('textarea[placeholder*="Ask a question"]') ||
      document.querySelector('textarea[placeholder*="question"]') ||
      document.querySelector("textarea");

    if (!textarea) {
      console.log("❌ Could not find Venice textarea");
      return;
    }

    const contextText = this.formatMemoriesAsContext(memories);
    const currentText = textarea.value || "";
    textarea.value = currentText
      ? `${contextText}\n\n${currentText}`
      : contextText;
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

  waitForVeniceInterface() {
    console.log("🔄 Waiting for Venice interface to be ready...");

    const checkInterface = () => {
      // Look for common Venice interface elements
      const textarea = document.querySelector("textarea");
      const inputArea = document.querySelector('[contenteditable="true"]');
      const submitButton = document.querySelector('button[type="submit"]');

      if (textarea || inputArea || submitButton) {
        console.log("✅ Venice interface ready!");
        console.log("Found elements:", {
          textarea: !!textarea,
          inputArea: !!inputArea,
          submitButton: !!submitButton,
        });

        // Start more aggressive monitoring
        this.startVeniceMonitoring();
        return true;
      }

      return false;
    };

    // Check immediately
    if (checkInterface()) {
      return;
    }

    // Check every 500ms for up to 10 seconds
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      attempts++;
      if (checkInterface() || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts) {
          console.log("⚠️ Venice interface not detected after 10 seconds");
        }
      }
    }, 500);
  }

  startVeniceMonitoring() {
    console.log("🎯 Starting Venice user input monitoring...");

    // Only capture when user explicitly submits a message
    // Don't monitor contenteditable divs as they might contain AI responses

    // Monitor for form submissions (user sending messages)
    document.addEventListener("submit", (event) => {
      console.log("🔍 Venice form submitted");
      const textarea = event.target.querySelector("textarea");

      if (textarea && textarea.value.trim()) {
        const text = textarea.value.trim();
        if (!this.seen.has(text)) {
          this.seen.add(text);
          console.log(
            "🧠 Captured Venice form submission:",
            text.substring(0, 100) + "...",
          );
          this.storeMemory(text);
        }
      }
    });

    // Monitor for button clicks that submit messages
    document.addEventListener("click", (event) => {
      if (event.target.tagName === "BUTTON") {
        const buttonText =
          event.target.textContent ||
          event.target.getAttribute("aria-label") ||
          "";
        if (
          buttonText.includes("Submit") ||
          buttonText.includes("Send") ||
          buttonText.includes("Send message")
        ) {
          console.log("🔍 Venice submit button clicked");

          // Look for the input field - only textarea, not contenteditable
          const textarea = document.querySelector("textarea");

          if (textarea && textarea.value.trim()) {
            const text = textarea.value.trim();
            if (!this.seen.has(text)) {
              this.seen.add(text);
              console.log(
                "🧠 Captured Venice button-submitted textarea:",
                text.substring(0, 100) + "...",
              );
              this.storeMemory(text);
            }
          }
        }
      }
    });

    // Monitor Enter key presses in textareas
    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        const textarea = event.target;
        if (textarea.tagName === "TEXTAREA" && textarea.value.trim()) {
          const text = textarea.value.trim();
          if (!this.seen.has(text)) {
            this.seen.add(text);
            console.log(
              "🧠 Captured Venice Enter-submitted textarea:",
              text.substring(0, 100) + "...",
            );
            this.storeMemory(text);
          }
        }
      }
    });
  }
}

// Initialize
new MemoryManager();
