import asyncio
import websockets
import json
import pyautogui
import sys

# Safety first
pyautogui.FAILSAFE = True

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
                print(f"Received: {message}")
                data = json.loads(message)
                if data.get("type") == "control":
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

if __name__ == "__main__":
    print("=== Remote Support Agent ===")
    code = input("Enter 6-digit session code: ").strip()
    if not code:
        print("Session code is required.")
        sys.exit(1)
        
    url = input("Enter WebSocket Server URL (leave blank for ws://localhost:8765): ").strip()
    if not url:
        url = "ws://localhost:8765"
        
    asyncio.run(agent_loop(code, url))
