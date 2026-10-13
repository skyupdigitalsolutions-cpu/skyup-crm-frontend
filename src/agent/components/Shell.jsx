import { NavLink, useNavigate } from 'react-router-dom';
import { IconBack, IconCalls, IconHome, IconUser, IconUsers } from './icons.jsx';

// `back` is the path the back arrow goes to (explicit, so it never depends on
// browser history — the CRM's nav guard also manipulates history).
export function TopBar({ title, back, right }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back ? (
        <button className="icon-btn" onClick={() => nav(back)} aria-label="Go back">
          <IconBack />
        </button>
      ) : null}
      <h1>{title}</h1>
      {right}
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="bottomnav" aria-label="Main">
      <div className="bottomnav-inner">
        <NavLink to="/agent" end><IconHome />Home</NavLink>
        <NavLink to="/agent/leads"><IconUsers />Leads</NavLink>
        <NavLink to="/agent/calls"><IconCalls />Calls</NavLink>
        <NavLink to="/agent/profile"><IconUser />Profile</NavLink>
      </div>
    </nav>
  );
}
