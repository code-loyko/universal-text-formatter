# Universal Text Formatter

A simple userscript to use 𝗯𝗼𝗹𝗱 and 𝘪𝘵𝘢𝘭𝘪𝘤 on sites that don't support it (LinkedIn, Facebook, X, etc.). It uses Unicode symbols to mimic formatting.

### Installation

1. Get a userscript manager like [Tampermonkey](https://www.tampermonkey.net/).
2. [Click here to install the script](https://raw.githubusercontent.com/code-loyko/universal-text-formatter/main/universal-text-formatter.user.js).

### Shortcuts

*   **Ctrl / Cmd + B** : Toggle Bold
*   **Ctrl / Cmd + I** : Toggle Italic

### How it works

The script intercepts the standard formatting shortcuts. It detects if your selection is already styled or not to apply the "toggle" logic, similar to how Word or Google Docs behave. It handles multi-line selections and respects special characters.

### Privacy

The script is 100% local, no data ever leaves your browser.

### License

GPLv3
