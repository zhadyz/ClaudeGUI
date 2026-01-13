# ClaudeGUI

A lightweight GUI wrapper for **Claude Code CLI**.

## Why use this?

**Claude Desktop** is great, but it's limited. If you want Claude to actually *do things* on your computer - edit files, run commands, work autonomously - you need **Claude Code CLI**.

The problem? CLI isn't for everyone. Some people just want a nice interface.

ClaudeGUI gives you the best of both worlds:
- Full power of Claude Code CLI (including `--dangerously-skip-permissions` for autonomous workflows)
- Clean GUI that doesn't get in your way
- Multi-session management so you can juggle multiple projects
- Right-click any folder → "Open with ClaudeGUI"

If you're already comfortable with the CLI, you probably don't need this. But if you want Claude Code's capabilities without living in a terminal, here you go.

## Disclaimer

**This is NOT affiliated with Anthropic.** It's just a wrapper around their CLI tool. "Claude" is Anthropic's trademark.

## Features

- Real-time streaming responses
- Syntax highlighting and LaTeX rendering
- Session history with favorites
- Windows Explorer integration
- Dark theme

## Requirements

1. **Claude Code CLI** installed and authenticated:
   ```bash
   npm install -g @anthropic-ai/claude-code
   claude login
   ```
2. Windows 10/11
3. Active Claude subscription (Pro, Max, or Enterprise)

## Installation

Download the installer from [Releases](../../releases) and run it. That's it.

Or build from source:
```bash
git clone https://github.com/zhadyz/ClaudeGUI.git
cd ClaudeGUI
npm install
npm run dist
```

## Usage

1. Launch ClaudeGUI
2. Pick a working directory
3. Chat with Claude

Right-click any folder in Explorer → "Open with ClaudeGUI" to jump straight in.

## License

MIT - see [LICENSE](LICENSE)

---

*Not affiliated with Anthropic.*
