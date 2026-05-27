const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// sessionCode -> { target: ws, operator: ws, agent: ws }
const sessions = {};

wss.on('connection', (ws) => {
  let currentSession = null;
  let currentRole = null;

  ws.on('message', (messageAsString) => {
    try {
      const message = JSON.parse(messageAsString);

      if (message.type === 'join') {
        const { sessionCode, role } = message;
        if (!sessionCode || !role) return;

        if (!sessions[sessionCode]) {
          sessions[sessionCode] = { target: null, operator: null, agent: null };
        }

        sessions[sessionCode][role] = ws;
        currentSession = sessionCode;
        currentRole = role;

        console.log(`[${sessionCode}] ${role} joined.`);
        
        // Notify others in session if needed (optional)
        // E.g., tell operator that target is ready.
      } else if (message.type === 'signal') {
        if (!currentSession || !sessions[currentSession]) return;
        
        // Forward signals: Target <-> Operator
        if (currentRole === 'target' && sessions[currentSession].operator) {
          sessions[currentSession].operator.send(JSON.stringify(message));
        } else if (currentRole === 'operator' && sessions[currentSession].target) {
          sessions[currentSession].target.send(JSON.stringify(message));
        }
      } else if (message.type === 'control') {
        if (!currentSession || !sessions[currentSession]) return;
        
        // Forward control messages: Operator -> Agent
        if (currentRole === 'operator' && sessions[currentSession].agent) {
          sessions[currentSession].agent.send(JSON.stringify(message));
        }
      } else if (message.type === 'metadata') {
        if (!currentSession || !sessions[currentSession]) return;
        
        // Forward metadata (like screen size): Target <-> Operator
        if (currentRole === 'target' && sessions[currentSession].operator) {
          sessions[currentSession].operator.send(JSON.stringify(message));
        }
      } else if (message.type === 'chat') {
        if (!currentSession || !sessions[currentSession]) return;

        // Forward chat messages: Operator -> Agent
        if (currentRole === 'operator' && sessions[currentSession].agent) {
          sessions[currentSession].agent.send(JSON.stringify(message));
        }
      }
    } catch (err) {
      console.error('Failed to parse message:', err);
    }
  });

  ws.on('close', () => {
    if (currentSession && sessions[currentSession]) {
      console.log(`[${currentSession}] ${currentRole} disconnected.`);
      sessions[currentSession][currentRole] = null;
      
      // Clean up session if empty
      const sess = sessions[currentSession];
      if (!sess.target && !sess.operator && !sess.agent) {
        console.log(`[${currentSession}] Session destroyed.`);
        delete sessions[currentSession];
      }
    }
  });
});

const PORT = process.env.PORT || 8765;

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
