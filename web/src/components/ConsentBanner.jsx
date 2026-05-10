import { ShieldAlert } from 'lucide-react';

export default function ConsentBanner() {
  return (
    <div className="warning-box">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert size={20} />
        <strong style={{ fontSize: '1.1rem' }}>Security Warning</strong>
      </div>
      <p style={{ color: 'inherit', margin: 0 }}>
        You are about to share your screen with a remote supporter. 
        Only continue if you trust them.
      </p>
    </div>
  );
}
