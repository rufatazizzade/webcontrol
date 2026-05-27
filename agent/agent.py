import asyncio
import websockets
import json
import pyautogui
import sys
import threading
import tkinter as tk
from tkinter import ttk

# Safety first
pyautogui.FAILSAFE = True

class NotificationOverlay:
    def __init__(self):
        self.root = tk.Tk()
        self.root.withdraw()  # Hide main window
        self.overlay = None
        self.fade_timer = None

    def show_message(self, text):
        if self.overlay:
            self.overlay.destroy()
        
        self.overlay = tk.Toplevel(self.root)
        self.overlay.overrideredirect(True)
        self.overlay.attributes("-topmost", True)
        self.overlay.attributes("-alpha", 0.0)  # Start transparent for fade-in
        
        # Style
        bg_color = "#1a1a1a"
        text_color = "#ffffff"
        
        frame = tk.Frame(self.overlay, bg=bg_color, padx=20, pady=15)
        frame.pack()
        
        lbl_title = tk.Label(frame, text="MESSAGE FROM OPERATOR", font=("Arial", 8, "bold"), 
                             bg=bg_color, fg="#3b82f6")
        lbl_title.pack(anchor="w")
        
        lbl_msg = tk.Label(frame, text=text, font=("Arial", 12), 
                           bg=bg_color, fg=text_color, wraplength=300, justify="left")
        lbl_msg.pack(anchor="w", pady=(5, 0))
        
        # Position at bottom right
        self.root.update_idletasks()
        width = self.overlay.winfo_width()
        height = self.overlay.winfo_height()
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        
        x = screen_width - width - 20
        y = screen_height - height - 60 # Above taskbar
        self.overlay.geometry(f"+{x}+{y}")
        
        # Fade in
        self._fade_in(0)
        
        # Auto-hide after 7 seconds
        if self.fade_timer:
            self.root.after_cancel(self.fade_timer)
        self.fade_timer = self.root.after(7000, lambda: self._fade_out(0.8))

    def _fade_in(self, alpha):
        if alpha < 0.8:
            alpha += 0.1
            self.overlay.attributes("-alpha", alpha)
            self.root.after(30, lambda: self._fade_in(alpha))

    def _fade_out(self, alpha):
        if self.overlay and self.overlay.winfo_exists():
            if alpha > 0:
                alpha -= 0.1
                self.overlay.attributes("-alpha", alpha)
                self.root.after(30, lambda: self._fade_out(alpha))
            else:
                self.overlay.destroy()
                self.overlay = None

    def run(self):
        self.root.mainloop()

overlay_manager = NotificationOverlay()

async def agent_loop(session_code, server_url):
    uri = server_url
    print(f"Connecting to {uri} with session code {session_code}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            join_msg = {
                "type": "join",
                "role": "agent",
                "sessionCode": session_code
            }
            await websocket.send(json.dumps(join_msg))
            print("Connected! Remote control active. Move mouse to any corner to abort.")
            
            async for message in websocket:
                data = json.loads(message)
                
                if data.get("type") == "chat":
                    text = data.get("text", "")
                    print(f"Chat message: {text}")
                    # Safely trigger UI update from thread
                    overlay_manager.root.after(0, overlay_manager.show_message, text)
                    
                elif data.get("type") == "control":
                    action = data.get("action")
                    try:
                        if action == "move":
                            x, y = data.get("x"), data.get("y")
                            if x is not None and y is not None:
                                pyautogui.moveTo(x, y)
                        elif action == "click":
                            button = data.get("button", "left")
                            pyautogui.click(button=button)
                        elif action == "right_click":
                            pyautogui.rightClick()
                        elif action == "double_click":
                            pyautogui.doubleClick()
                        elif action == "scroll":
                            amount = data.get("amount", 0)
                            pyautogui.scroll(amount)
                        elif action == "press":
                            key = data.get("key")
                            if key:
                                pyautogui.press(key)
                        elif action == "type":
                            text = data.get("text")
                            if text:
                                pyautogui.write(text)
                        elif action == "hotkey":
                            keys = data.get("keys", [])
                            if keys:
                                pyautogui.hotkey(*keys)
                    except pyautogui.FailSafeException:
                        print("Failsafe triggered! Mouse moved to corner. Exiting...")
                        sys.exit(1)
                    except Exception as e:
                        print(f"Error executing action {action}: {e}")
                        
    except Exception as e:
        print(f"Connection failed: {e}")

def start_agent_thread(code, url):
    asyncio.run(agent_loop(code, url))

if __name__ == "__main__":
    print("=== Remote Support Agent ===")
    code = input("Enter 6-digit session code: ").strip()
    if not code:
        print("Session code is required.")
        sys.exit(1)
        
    url = input("Enter WebSocket Server URL (leave blank for ws://localhost:8765): ").strip()
    if not url:
        url = "ws://localhost:8765"
    
    # Start agent in background thread
    t = threading.Thread(target=start_agent_thread, args=(code, url), daemon=True)
    t.start()
    
    # Run GUI on main thread
    print("Notification overlay active.")
    overlay_manager.run()
