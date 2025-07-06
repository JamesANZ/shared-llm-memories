document.addEventListener("DOMContentLoaded", () => {
  const toggleSwitch = document.getElementById("toggleSwitch");
  const statusText = document.getElementById("statusText");
  const syncBtn = document.getElementById("syncBtn");
  const exportBtn = document.getElementById("exportBtn");
  const clearBtn = document.getElementById("clearBtn");
  const memoriesList = document.getElementById("memoriesList");
  const memoryCount = document.getElementById("memoryCount");
  const lastUpdated = document.getElementById("lastUpdated");

  // Test function to debug storage
  function testStorage() {
    console.log("=== STORAGE TEST ===");
    chrome.storage.local.get(null, (result) => {
      console.log("All storage:", result);
    });
  }

  // Load and display memories
  function loadMemories() {
    chrome.runtime.sendMessage({ action: "getMemories" }, (response) => {
      const memories = response.memories || [];
      displayMemories(memories);
      updateStats(memories);
    });
  }

  // Update statistics
  function updateStats(memories) {
    memoryCount.textContent = memories.length;

    if (memories.length > 0) {
      const latestMemory = memories.reduce((latest, current) =>
        current.timestamp > latest.timestamp ? current : latest,
      );
      lastUpdated.textContent = new Date(
        latestMemory.timestamp,
      ).toLocaleString();
    } else {
      lastUpdated.textContent = "Never";
    }
  }

  // Load toggle state
  function loadToggleState() {
    console.log("Loading toggle state...");
    testStorage(); // Debug: show current storage
    chrome.runtime.sendMessage({ action: "getToggleState" }, (response) => {
      console.log("Toggle state response:", response);
      if (chrome.runtime.lastError) {
        console.error("Error getting toggle state:", chrome.runtime.lastError);
        updateToggleUI(false); // Default to disabled on error
        return;
      }
      if (!response) {
        console.error("No response received for getToggleState");
        updateToggleUI(false); // Default to disabled on error
        return;
      }
      const isEnabled = response.enabled;
      console.log("Setting toggle to:", isEnabled);
      updateToggleUI(isEnabled);
    });
  }

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.extensionEnabled) {
      console.log(
        "Storage changed - extensionEnabled:",
        changes.extensionEnabled.newValue,
      );
      updateToggleUI(changes.extensionEnabled.newValue);
    }
  });

  // Update toggle UI
  function updateToggleUI(isEnabled) {
    console.log("Updating toggle UI to:", isEnabled);
    console.log("Current toggle switch classes:", toggleSwitch.className);
    console.log("Current status text classes:", statusText.className);

    if (isEnabled) {
      toggleSwitch.classList.add("active");
      statusText.textContent = "Enabled";
      statusText.className = "status-text enabled";
    } else {
      toggleSwitch.classList.remove("active");
      statusText.textContent = "Disabled";
      statusText.className = "status-text disabled";
    }

    console.log(
      "After update - toggle switch classes:",
      toggleSwitch.className,
    );
    console.log("After update - status text classes:", statusText.className);
  }

  // Display memories in the popup
  function displayMemories(memories) {
    if (memories.length === 0) {
      memoriesList.innerHTML =
        '<div style="text-align: center; color: #6c757d; padding: 20px; font-style: italic;">No memories stored yet. Enable the extension and start using LLM platforms to collect memories.</div>';
      return;
    }

    // Sort memories by timestamp (newest first)
    const sortedMemories = memories.sort((a, b) => b.timestamp - a.timestamp);

    memoriesList.innerHTML = sortedMemories
      .map(
        (memory) => `
      <div class="memory-item">
        <div class="memory-platform">${memory.platform}</div>
        <div class="memory-timestamp">${new Date(memory.timestamp).toLocaleString()}</div>
        <div class="memory-content">${memory.content}</div>
      </div>
    `,
      )
      .join("");
  }

  // Toggle extension on/off
  toggleSwitch.addEventListener("click", () => {
    const isCurrentlyEnabled = toggleSwitch.classList.contains("active");
    const newState = !isCurrentlyEnabled;

    console.log(
      "Toggle clicked. Current state:",
      isCurrentlyEnabled,
      "New state:",
      newState,
    );

    // Update UI immediately for better responsiveness
    updateToggleUI(newState);

    // Send message to background script to update storage
    chrome.runtime.sendMessage(
      {
        action: "setToggleState",
        enabled: newState,
      },
      (response) => {
        console.log("Set toggle state response:", response);
        if (chrome.runtime.lastError) {
          console.error(
            "Error setting toggle state:",
            chrome.runtime.lastError,
          );
          // Revert UI if there was an error
          updateToggleUI(isCurrentlyEnabled);
          return;
        }
        if (!response || !response.success) {
          console.error("Failed to set toggle state:", response);
          // Revert UI if there was an error
          updateToggleUI(isCurrentlyEnabled);
          return;
        }
        console.log("Toggle state successfully updated to:", newState);
        testStorage(); // Debug: show storage after setting
      },
    );
  });

  // Inject memories to current tab
  syncBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getMemories" }, (response) => {
      const memories = response.memories || [];
      if (memories.length === 0) {
        alert(
          "No memories to inject. Start using LLM platforms with the extension enabled to collect memories.",
        );
        return;
      }

      // Send memories directly to the current tab's content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          console.log("📤 Sending injection request to tab:", tabs[0].id);
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "injectMemories",
              memories: memories,
            },
            (response) => {
              console.log("📥 Received response:", response);
              console.log("Runtime error:", chrome.runtime.lastError);

              if (chrome.runtime.lastError) {
                console.error(
                  "Error injecting memories:",
                  chrome.runtime.lastError,
                );
                alert(
                  "Failed to inject memories. Make sure you're on a supported LLM platform (ChatGPT, Claude, or Venice).",
                );
              } else if (response && response.success) {
                alert(
                  `Successfully injected ${memories.length} memories into the current tab.`,
                );
              } else {
                console.error("Injection failed:", response);
                alert(
                  `Failed to inject memories: ${response?.message || "Unknown error"}`,
                );
              }
            },
          );
        } else {
          alert("Could not find the current tab.");
        }
      });
    });
  });

  // Export memories as Model Context Protocol JSON
  function exportMemoriesAsMCP(memories) {
    // Group memories by platform for better organization
    const memoriesByPlatform = memories.reduce((acc, memory) => {
      if (!acc[memory.platform]) {
        acc[memory.platform] = [];
      }
      acc[memory.platform].push(memory);
      return acc;
    }, {});

    // Convert memories to Model Context Protocol format
    const mcpData = {
      version: "1.0",
      schema: "https://modelcontextprotocol.io/schema/v1.0",
      metadata: {
        source: "Shared LLM Memories Chrome Extension",
        exportDate: new Date().toISOString(),
        totalMemories: memories.length,
        platforms: Object.keys(memoriesByPlatform),
        description:
          "Exported conversation memories from various LLM platforms",
      },
      context: {
        conversations: Object.entries(memoriesByPlatform).map(
          ([platform, platformMemories]) => ({
            platform: platform,
            messages: platformMemories
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
              .map((memory) => ({
                role: "user",
                content: memory.content,
                timestamp: memory.timestamp,
                metadata: {
                  platform: memory.platform,
                  source: "browser_extension",
                  originalTimestamp: memory.timestamp,
                },
              })),
          }),
        ),
        summary: {
          totalConversations: Object.keys(memoriesByPlatform).length,
          totalMessages: memories.length,
          dateRange: {
            start: new Date(
              Math.min(...memories.map((m) => new Date(m.timestamp))),
            ).toISOString(),
            end: new Date(
              Math.max(...memories.map((m) => new Date(m.timestamp))),
            ).toISOString(),
          },
        },
      },
    };

    // Create and download the file
    const blob = new Blob([JSON.stringify(mcpData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `llm-memories-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Export button click handler
  exportBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "getMemories" }, (response) => {
      const memories = response.memories || [];
      if (memories.length === 0) {
        alert(
          "No memories to export. Start using LLM platforms with the extension enabled to collect memories.",
        );
        return;
      }

      try {
        exportMemoriesAsMCP(memories);
        alert(
          `Successfully exported ${memories.length} memories as Model Context Protocol JSON.`,
        );
      } catch (error) {
        console.error("Export error:", error);
        alert("Failed to export memories. Please try again.");
      }
    });
  });

  // Clear all memories
  clearBtn.addEventListener("click", () => {
    if (
      confirm(
        "Are you sure you want to clear all memories? This action cannot be undone.",
      )
    ) {
      chrome.runtime.sendMessage({ action: "clearMemories" }, () => {
        loadMemories();
      });
    }
  });

  // Initial load
  console.log("Popup loaded, initializing...");
  loadToggleState();
  loadMemories();
});
