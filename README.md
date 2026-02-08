# 🤖 Clawdbot - Your Personal PC Automation Assistant

Control your PC through WhatsApp, Gmail, or Terminal! Clawdbot is an AI-powered automation bot that can execute tasks, manage files, browse the web, and automate repetitive workflows.

## ✨ Features

- **📱 WhatsApp Control** - Send commands via WhatsApp messages
- **💻 Terminal Interface** - Direct CLI for local control
- **🧠 AI-Powered** - Natural language understanding with Gemini AI
- **📁 File Operations** - Search, list, read, and download files
- **🌐 Browser Automation** - Open websites, take screenshots, web scraping
- **⚙️ System Control** - Run commands, open apps, get system info
- **📸 Screenshots** - Capture your screen on demand
- **🔐 Security** - Phone number whitelist, command blocking

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install chromium
```

### 3. Configure Environment

```bash
# Copy the example env file
copy .env.example .env

# Edit .env with your settings:
# - Add your GEMINI_API_KEY
# - Add allowed WhatsApp numbers
```

### 4. Start the Bot

```bash
npm run dev
```

### 5. Scan WhatsApp QR Code

When the bot starts, scan the QR code shown in the terminal with your WhatsApp mobile app.

## 📋 Commands

### Natural Language
Just chat naturally! The AI will understand what you want:
- "Find all PDF files in my Downloads folder"
- "Take a screenshot"
- "Open YouTube"
- "What's my system memory usage?"

### Slash Commands
```
/search <pattern>     - Search for files
/list [path]          - List directory contents
/open <url>           - Open a website
/screenshot           - Take a screenshot
/run <command>        - Run a system command
/app <name>           - Open an application
/info [cpu|memory]    - Get system information
/help                 - Show help
```

## 📁 Project Structure

```
Clawdbot/
├── src/
│   ├── index.ts              # Entry point
│   ├── core/
│   │   ├── bot.ts            # Main bot orchestrator
│   │   ├── ai.ts             # Gemini AI integration
│   │   ├── command-parser.ts # Command parsing
│   │   └── task-executor.ts  # Task execution
│   ├── interfaces/
│   │   ├── terminal.ts       # CLI interface
│   │   └── whatsapp.ts       # WhatsApp interface
│   ├── capabilities/
│   │   ├── filesystem.ts     # File operations
│   │   ├── browser.ts        # Browser control
│   │   ├── system.ts         # System commands
│   │   └── screen.ts         # Screenshots
│   └── utils/
│       └── logger.ts         # Logging utility
├── .env.example              # Environment template
├── package.json
└── tsconfig.json
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `WHATSAPP_ENABLED` | Enable WhatsApp interface | No (default: true) |
| `WHATSAPP_ALLOWED_NUMBERS` | Comma-separated phone numbers | No |
| `LOG_LEVEL` | Logging level (info, debug) | No |

## 🔒 Security

- **Number Whitelist**: Only specified numbers can control the bot
- **Command Blocking**: Dangerous commands (format, del, rm) are blocked
- **Sandboxed Execution**: Commands run with safety limits

## 📱 WhatsApp Usage Examples

Send these messages to your WhatsApp:

```
📸 "Take a screenshot of my screen"
🔍 "Search for *.pdf files in Downloads"
🌐 "Open google.com"
💻 "What's my CPU usage?"
📂 "List files in C:\Users"
🚀 "Open VS Code"
```

## 🛠️ Development

```bash
# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## ⚠️ Disclaimer

- WhatsApp may restrict accounts using unofficial clients
- Use responsibly and at your own risk
- Consider using a secondary WhatsApp number

## 📄 License

MIT
