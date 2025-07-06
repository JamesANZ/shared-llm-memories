# Shared LLM Memories Chrome Extension

This Chrome extension allows you to take memories from one web based LLM to another.

## How it works

When this extension is toggled on, it will keep track of all the prompts you write in the browser by extracting the prompt from the DOM. All prompts are stored locally inside your extension storage and are never shared with anybody. Toggling the extension off will stop the extension from recording your prompts in storage. This extension can only monitor prompts made in the browser with this extension installed.

Toggling off the extension pauses this process, enabling you to control when you want to store memories and when you do not.

Example of prompt extraction in ChatGPT:

```js
const prompts = Array.from(
  document.querySelectorAll('[data-message-author-role="user"]'),
).map((el) => el.textContent.trim());
```

## Features

- Extract prompts from supported LLM platforms
- Store memories with platform source and timestamp
- Inject memories as context into other LLM conversations
- Export memories as Model Context Protocol (MCP) JSON files
- Clean and intuitive user interface
- Toggle the extension on and off

## Export Functionality

### Export to Model Context Protocol

The extension can export your collected memories in Model Context Protocol (MCP) format, which is a standardized way to share conversation context between AI models. The exported JSON file includes:

- **Metadata**: Export date, total memories, platforms used
- **Conversations**: Grouped by platform with timestamps
- **Summary**: Date range and conversation statistics

### Example MCP Export Format

```json
{
  "version": "1.0",
  "schema": "https://modelcontextprotocol.io/schema/v1.0",
  "metadata": {
    "source": "Shared LLM Memories Chrome Extension",
    "exportDate": "2024-01-15T10:30:00.000Z",
    "totalMemories": 5,
    "platforms": ["chatgpt", "claude"],
    "description": "Exported conversation memories from various LLM platforms"
  },
  "context": {
    "conversations": [
      {
        "platform": "chatgpt",
        "messages": [
          {
            "role": "user",
            "content": "What is the capital of France?",
            "timestamp": "2024-01-15T10:00:00.000Z",
            "metadata": {
              "platform": "chatgpt",
              "source": "browser_extension",
              "originalTimestamp": "2024-01-15T10:00:00.000Z"
            }
          }
        ]
      }
    ],
    "summary": {
      "totalConversations": 1,
      "totalMessages": 1,
      "dateRange": {
        "start": "2024-01-15T10:00:00.000Z",
        "end": "2024-01-15T10:00:00.000Z"
      }
    }
  }
}
```

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Supported Platforms

- ChatGPT (chat.openai.com)
- Claude (claude.ai)
- Venice.ai (venice.ai)

## Development

The extension is built using vanilla JavaScript and Chrome Extension APIs. The main components are:

- `manifest.json`: Extension configuration
- `content.js`: Handles memory extraction and injection
- `background.js`: Manages extension state and communication
- `popup.html/js`: User interface for managing memories

## Contributing

Feel free to submit issues and enhancement requests!
