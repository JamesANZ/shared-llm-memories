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
- Clean and intuitive user interface
- Toggle the extension on and off

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
