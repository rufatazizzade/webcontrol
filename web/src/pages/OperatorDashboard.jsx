import { useState, useRef, useEffect, useCallback } from 'react';
import { MonitorPlay, PowerOff } from 'lucide-react';
import ControlPanel from '../components/ControlPanel';

export default function OperatorDashboard() {
  const [sessionCode, setSessionCode] = useState('');
  const [connected, setConnected] = useState(false);
  const [controlEnabled, setControlEnabled] = useState(false);
  const [remoteSize, setRemoteSize] = useState({ width: 1920, height: 1080 }); // Defaults, updated by metadata
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const peerRef = useRef(null);

  const connectToSession = () => {
    if (!sessionCode) return;

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8765';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', role: 'operator', sessionCode }));
      setConnected(true);
      initWebRTC();
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === 'metadata') {
        setRemoteSize({ width: msg.width, height: msg.height });
      } else if (msg.type === 'signal') {
        const payload = msg.payload;
        if (!peerRef.current) return;

        if (payload.type === 'answer') {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
        } else if (payload.candidate) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
        }
      }
    };

    ws.onclose = () => setConnected(false);
  };

  const initWebRTC = async () => {
    const configuration = { 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { 
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        { 
          urls: 'turn:openrelay.metered.ca:80?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ] 
    };
    const peer = new RTCPeerConnection(configuration);
    peerRef.current = peer;

    peer.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log("Operator sending ICE candidate");
        wsRef.current.send(JSON.stringify({ type: 'signal', payload: event.candidate }));
      }
    };

    peer.oniceconnectionstatechange = () => {
      console.log("Operator ICE State:", peer.iceConnectionState);
    };

    peer.ontrack = (event) => {
      console.log("Operator received video track!");
      if (videoRef.current && event.streams[0]) {
        videoRef.current.srcObject = event.streams[0];
      }
    };

    // Create and send offer
    const offer = await peer.createOffer({ offerToReceiveVideo: true });
    await peer.setLocalDescription(offer);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'signal', payload: peer.localDescription }));
    }
  };

  const disconnect = () => {
    if (wsRef.current) wsRef.current.close();
    if (peerRef.current) peerRef.current.close();
    if (videoRef.current) videoRef.current.srcObject = null;
    setConnected(false);
    setControlEnabled(false);
  };

  // --- Control Handlers ---

  const sendControl = useCallback((action, data = {}) => {
    if (!controlEnabled || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'control', action, ...data }));
  }, [controlEnabled]);

  const getScaledCoordinates = (e) => {
    if (!videoRef.current) return { x: 0, y: 0 };
    const rect = videoRef.current.getBoundingClientRect();
    
    // The video element might have letterboxing due to object-fit: contain.
    // Calculate the actual displayed video dimensions
    const videoRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
    const elementRatio = rect.width / rect.height;
    
    let renderedWidth = rect.width;
    let renderedHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (elementRatio > videoRatio) {
      renderedWidth = rect.height * videoRatio;
      offsetX = (rect.width - renderedWidth) / 2;
    } else {
      renderedHeight = rect.width / videoRatio;
      offsetY = (rect.height - renderedHeight) / 2;
    }

    const mouseX = e.clientX - rect.left - offsetX;
    const mouseY = e.clientY - rect.top - offsetY;

    // Bounds check
    if (mouseX < 0 || mouseX > renderedWidth || mouseY < 0 || mouseY > renderedHeight) {
      return null;
    }

    const scaleX = remoteSize.width / renderedWidth;
    const scaleY = remoteSize.height / renderedHeight;

    return {
      x: Math.floor(mouseX * scaleX),
      y: Math.floor(mouseY * scaleY)
    };
  };

  const handleMouseMove = (e) => {
    const coords = getScaledCoordinates(e);
    if (coords) sendControl('move', { x: coords.x, y: coords.y });
  };

  const handleClick = (e) => {
    e.preventDefault();
    if (!controlEnabled) return;
    sendControl('click', { button: 'left' });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    if (!controlEnabled) return;
    sendControl('right_click');
  };

  const handleDoubleClick = (e) => {
    e.preventDefault();
    if (!controlEnabled) return;
    sendControl('double_click');
  };

  const handleWheel = (e) => {
    // Note: pyautogui.scroll uses positive for up, negative for down on some OS, vice versa on others.
    // Standardizing on e.deltaY mapping.
    const amount = e.deltaY > 0 ? -100 : 100;
    sendControl('scroll', { amount });
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({ type: 'chat', text: chatMessage }));
    setChatHistory(prev => [...prev, { role: 'operator', text: chatMessage, time: new Date().toLocaleTimeString() }]);
    setChatMessage('');
  };

  // Keyboard mapping
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!controlEnabled || document.activeElement !== videoRef.current) return;
      e.preventDefault();
      
      const key = e.key.toLowerCase();
      // map some special keys
      const specialKeys = ['enter', 'backspace', 'tab', 'escape', 'space', 'shift', 'ctrl', 'alt', 'up', 'down', 'left', 'right'];
      
      if (specialKeys.includes(key) || key.startsWith('arrow')) {
        let mappedKey = key.replace('arrow', '');
        if (key === 'space') mappedKey = 'space';
        sendControl('press', { key: mappedKey });
      } else if (key.length === 1) {
        sendControl('type', { text: e.key }); // Note: e.key retains case
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controlEnabled, sendControl]);

  return (
    <div className="operator-container">
      {/* Video Area */}
      <div className="video-area">
        {!connected && (
          <div className="flex flex-col items-center gap-4 text-muted">
            <MonitorPlay size={64} opacity={0.5} />
            <h2>Waiting for connection...</h2>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          tabIndex={0}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          style={{ cursor: controlEnabled ? 'crosshair' : 'default' }}
        />
      </div>

      {/* Control Panel */}
      <div className="side-panel">
        <h2>Operator Dashboard</h2>
        
        <div className="flex flex-col gap-2">
          <label>Session Code</label>
          <input 
            type="text" 
            placeholder="Enter 6-digit code" 
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value)}
            disabled={connected}
          />
        </div>

        {!connected ? (
          <button className="btn-primary w-100 mt-4" onClick={connectToSession}>
            Connect
          </button>
        ) : (
          <button className="btn-danger w-100 mt-4" onClick={disconnect}>
            <PowerOff size={18} />
            Disconnect
          </button>
        )}

        <ControlPanel 
          controlEnabled={controlEnabled} 
          setControlEnabled={setControlEnabled} 
          connected={connected} 
        />

        {/* Chat Section */}
        <div className="chat-section mt-6 border-t pt-4">
          <h3 className="text-sm font-bold uppercase tracking-wider opacity-50 mb-4">Chat with User</h3>
          
          <div className="chat-history mb-4 max-h-40 overflow-y-auto flex flex-col gap-2 pr-2">
            {chatHistory.length === 0 && (
              <p className="text-xs italic opacity-40">No messages yet...</p>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} className="bg-white/5 p-2 rounded text-xs">
                <div className="flex justify-between opacity-50 mb-1">
                  <span>Operator</span>
                  <span>{msg.time}</span>
                </div>
                <div>{msg.text}</div>
              </div>
            ))}
          </div>

          <form onSubmit={sendChatMessage} className="flex gap-2">
            <input 
              type="text" 
              placeholder="Type message..." 
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              disabled={!connected}
              className="flex-grow text-xs"
            />
            <button 
              type="submit" 
              className="btn-primary py-1 px-3 text-xs"
              disabled={!connected}
            >
              Send
            </button>
          </form>
          <p className="text-[10px] mt-2 opacity-40">Message will appear as a transparent popup on the user's screen.</p>
        </div>
      </div>
    </div>
  );
}
