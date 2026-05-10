export default function SessionCode({ code }) {
  return (
    <div className="text-center">
      <p>Your Session Code:</p>
      <div className="session-code-display">{code || '------'}</div>
    </div>
  );
}
