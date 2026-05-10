import { MousePointer2, Keyboard } from 'lucide-react';

export default function ControlPanel({ controlEnabled, setControlEnabled, connected }) {
  return (
    <div className="mt-4 border-t border-gray-700 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg">Remote Control</h3>
        <div className={`status-indicator ${controlEnabled ? 'status-connected' : 'status-disconnected'}`}>
          <div className="status-dot"></div>
          {controlEnabled ? 'Active' : 'Inactive'}
        </div>
      </div>

      <button 
        className={`btn-primary w-full flex items-center justify-center gap-2 ${controlEnabled ? 'bg-indigo-600' : ''}`}
        onClick={() => setControlEnabled(!controlEnabled)}
        disabled={!connected}
        style={{ width: '100%', backgroundColor: controlEnabled ? 'var(--accent)' : 'var(--bg-panel)' }}
      >
        {controlEnabled ? <Keyboard size={18} /> : <MousePointer2 size={18} />}
        {controlEnabled ? 'Disable Control' : 'Enable Control'}
      </button>
      
      <p className="text-sm mt-4 text-center opacity-70">
        {controlEnabled 
          ? 'Click video to focus keyboard. Mouse movements are tracked over the video area.' 
          : 'Control is disabled. You are in view-only mode.'}
      </p>
    </div>
  );
}
