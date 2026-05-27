import { useState, useRef, useEffect } from 'react';
import { Monitor, StopCircle, CheckCircle2 } from 'lucide-react';
import ConsentBanner from '../components/ConsentBanner';
import SessionCode from '../components/SessionCode';

export default function TargetClient() {
  const [sessionCode, setSessionCode] = useState('');
  const [connected, setConnected] = useState(false);
  const [sharing, setSharing] = useState(false);
  
  const wsRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    // Generate a 6-digit random code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSessionCode(code);
    
    // Connect to signaling server
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8765';
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', role: 'target', sessionCode: code }));
      setConnected(true);
    };

    ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'signal') {
        const payload = msg.payload;
        if (!peerRef.current) return;
        
        if (payload.type === 'offer') {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload));
          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: 'signal', payload: peerRef.current.localDescription }));
        } else if (payload.candidate) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload));
        }
      }
    };

    ws.onclose = () => setConnected(false);

    return () => {
      ws.close();
      stopEverything();
    };
  }, []);

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      // Send screen size metadata
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'metadata',
          width: settings.width || window.screen.width,
          height: settings.height || window.screen.height
        }));
      }

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
          console.log("Target sending ICE candidate");
          wsRef.current.send(JSON.stringify({ type: 'signal', payload: event.candidate }));
        }
      };

      peer.oniceconnectionstatechange = () => {
        console.log("Target ICE State:", peer.iceConnectionState);
      };

      stream.getTracks().forEach(track => {
        console.log("Target adding track:", track.kind);
        peer.addTrack(track, stream);
      });

      track.onended = () => {
        stopEverything();
      };

      setSharing(true);
    } catch (err) {
      console.error('Error starting screen share:', err);
    }
  };

  const stopEverything = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    setSharing(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100vh] p-4">
      <div className="glass-panel" style={{ maxWidth: '600px', width: '100%' }}>
        <h1 className="text-center">Remote Support Portal</h1>
        
        <ConsentBanner />

        <div className="text-center mb-4">
          <div className={`status-indicator ${connected ? 'status-connected' : 'status-disconnected'}`}>
            <div className="status-dot"></div>
            {connected ? 'Connected to Signaling Server' : 'Disconnected'}
          </div>
        </div>

        <SessionCode code={sessionCode} />

        <div className="flex flex-col gap-4 mt-4">
          {!sharing ? (
            <button className="btn-primary" onClick={startScreenShare} disabled={!connected}>
              <Monitor size={20} />
              Start Screen Share
            </button>
          ) : (
            <>
              <div className="glass-panel text-center" style={{ borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)' }}>
                <CheckCircle2 color="var(--danger)" size={32} className="mx-auto mb-2" />
                <h3 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Screen Sharing Active</h3>
                <p>The operator can now view and request control of your screen.</p>
              </div>
              
              <button className="btn-danger" onClick={stopEverything}>
                <StopCircle size={20} />
                Stop Everything
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
