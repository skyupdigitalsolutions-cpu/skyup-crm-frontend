import { useState } from 'react';
import { useAgentPwa } from '../pwa.js';

const DISMISS_KEY = 'agent_install_tip_dismissed';

// Shows how to install the app. On iPhone this matters: the app only runs
// full-screen after "Add to Home Screen".
export default function InstallTip() {
  const { canInstall, iosHint, install } = useAgentPwa();
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  if (hidden || (!canInstall && !iosHint)) return null;
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ } setHidden(true); };

  return (
    <div className="install-tip" role="note">
      {iosHint ? (
        <span>Install SkyUp CRM: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.</span>
      ) : (
        <span>Install SkyUp CRM on this phone for quick access.</span>
      )}
      {canInstall ? (
        <button onClick={async () => { await install(); dismiss(); }}>Install</button>
      ) : (
        <button onClick={dismiss} aria-label="Dismiss">Hide</button>
      )}
    </div>
  );
}
