document.addEventListener("DOMContentLoaded", () => {
  const toggleSwitch = document.getElementById("toggleSwitch");
  const statusText = document.getElementById("statusText");
  const syncBtn = document.getElementById("syncBtn");
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

  // Update toggle UI
  function updateToggleUI(isEnabled) {
    console.log("Updating toggle UI to:", isEnabled);
    if (isEnabled) {
      toggleSwitch.classList.add("active");
      statusText.textContent = "Enabled";
      statusText.className = "status-text enabled";
    } else {
      toggleSwitch.classList.remove("active");
      statusText.textContent = "Disabled";
      statusText.className = "status-text disabled";
    }
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
        if (!response) {
          console.error("No response received for setToggleState");
          // Revert UI if there was an error
          updateToggleUI(isCurrentlyEnabled);
          return;
        }
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

      chrome.runtime.sendMessage({
        action: "syncMemories",
        memories: memories,
      });

      alert(`Injected ${memories.length} memories to the current tab.`);
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
