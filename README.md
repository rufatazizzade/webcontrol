# Legal, Consent-Based Remote Support MVP

A simple remote control system where a target user can intentionally start a session, share their screen, and allow temporary mouse/keyboard control. Designed with transparency and user-consent at its core.

## Ethical Use Notice
**Use only on devices you own or where you have explicit permission.** This tool provides remote control capabilities and must be used responsibly.

## Architecture
- **Server:** Node.js + Express + WebSocket (Signaling and control relay)
- **Web App:** React + Vite (Target screen sharing and Operator dashboard)
- **Agent:** Python + PyAutoGUI (Translates WebSocket control messages into system-level input)

## Setup & Installation

### 1. Server Setup
```bash
cd server
npm install
npm start
# Server listens on HTTP 3001 and WS 8765
```

### 2. Web Client Setup
```bash
cd web
npm install
npm run dev
# Vite runs usually on HTTP 5173
```

### 3. Python Agent Setup
```bash
cd agent
# Optional: create a virtual environment
python -m venv venv
source venv/bin/activate # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

## How to Test Locally

1. **Start the Server:** Open a terminal and run `node index.js` in the `server/` directory.
2. **Start the Web App:** Open another terminal and run `npm run dev` in the `web/` directory.
3. **Open the Target Client:** Go to `http://localhost:5173/` in your browser.
4. **Start Session:** Click "Start Screen Share", select the entire screen. A 6-digit session code will appear.
5. **Open the Operator Dashboard:** Go to `http://localhost:5173/operator` (can be a different tab/browser).
6. **Connect:** Enter the session code and click "Connect". You should see the video stream.
7. **Start Python Agent:** Open a terminal and run `python agent.py` in the `agent/` directory. Enter the same session code.
8. **Test Control:** On the Operator Dashboard, click "Enable Control". Moving your mouse over the video will now trigger `pyautogui` movements via the agent. Click the video to type.

## Limitations & Security Features
- **Consent First:** Screen sharing requires explicit browser permission (cannot be bypassed).
- **No Background Execution:** The Python agent must be started manually in an active terminal session.
- **Failsafe:** Moving the mouse to any corner of the screen immediately aborts the Python agent (`pyautogui.FAILSAFE`).
- **Wayland Compatibility:** On Linux Wayland, browser screen capture might work via PipeWire, but `pyautogui` generally requires X11 for input injection unless specific Wayland compositors/extensions are used.

## Deployment Guide

Because Vercel Serverless Functions do not support persistent WebSockets, we split the architecture:

### 1. Deploy Frontend to Vercel
1. Push your code to GitHub.
2. In Vercel, import your repository and set the **Root Directory** to `web`.
3. Set the Build Command to `npm run build` and Output Directory to `dist`.
4. Add an Environment Variable: `VITE_WS_URL` and set it to your Render backend URL (e.g., `wss://your-backend.onrender.com`).
5. Deploy. (The `vercel.json` file ensures routing works correctly).

### 2. Deploy Backend to Render
1. In Render, create a new "Web Service" and connect your repository.
2. Set the **Root Directory** to `server`.
3. Set the Build Command to `npm install` and Start Command to `npm start`.
4. Render automatically assigns a `PORT` and supports WebSockets on that same port.
5. Once deployed, copy your Render URL (starting with `wss://`) and use it in Vercel and the Python Agent.
- **No Root/Admin:** Runs with normal user permissions. Will not interact with UAC prompts or elevate privileges.
