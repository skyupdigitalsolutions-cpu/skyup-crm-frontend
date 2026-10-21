// src/agent/components/ConfirmSheet.jsx — the app's own "are you sure?" sheet.
// Used instead of window.confirm(): phones often block or silently skip browser dialogs (especially in an
// installed web app, or after "don't allow more dialogs"), which made Sign out / Clock out seem to do nothing.
import Sheet from './Sheet.jsx';

export default function ConfirmSheet({ open, title, body, confirmLabel, tone = 'danger', busy, onConfirm, onClose }) {
  return (
    <Sheet open={open} onClose={busy ? undefined : onClose} label={title}>
      <h3>{title}</h3>
      {body ? <p className="muted" style={{ margin: '4px 0 18px' }}>{body}</p> : null}
      <div className="confirm-actions">
        <button className={`btn block ${tone}-solid`} onClick={onConfirm} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</button>
        <button className="btn block ghost" onClick={onClose} disabled={busy}>Cancel</button>
      </div>
    </Sheet>
  );
}
