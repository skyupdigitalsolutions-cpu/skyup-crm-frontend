// Minimal inline icon set (stroke icons, 24px grid).
const S = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />
);
export const IconHome = () => <S><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></S>;
export const IconUsers = () => <S><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" /><path d="M18 14.8c1.9.7 3.1 2.4 3.5 5.2" /></S>;
export const IconUser = () => <S><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.3-6 8-6s7 2 8 6" /></S>;
export const IconPhone = () => <S><path d="M5 3h3.5l1.8 4.6-2.3 1.5a12 12 0 0 0 6 6l1.5-2.3L20 14.5V18a2 2 0 0 1-2.2 2A16 16 0 0 1 3 5.2 2 2 0 0 1 5 3z" /></S>;
export const IconChat = () => <S><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /><path d="M9 10.5c.4 1.7 1.8 3.1 3.5 3.5l1.3-1 2 .9" /></S>;
export const IconSearch = () => <S><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></S>;
export const IconBack = () => <S><path d="M15 5l-7 7 7 7" /></S>;
export const IconRefresh = () => <S><path d="M20 11a8 8 0 0 0-14.7-4.4L3 9" /><path d="M3 4v5h5" /><path d="M4 13a8 8 0 0 0 14.7 4.4L21 15" /><path d="M21 20v-5h-5" /></S>;
export const IconPin = () => <S><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></S>;
export const IconMail = () => <S><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></S>;
export const IconEdit = () => <S><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></S>;
export const IconCalls = () => <S><path d="M5 3h3.5l1.8 4.6-2.3 1.5a12 12 0 0 0 6 6l1.5-2.3L20 14.5V18a2 2 0 0 1-2.2 2A16 16 0 0 1 3 5.2 2 2 0 0 1 5 3z" /><path d="M15 3h6v6" /><path d="m21 3-6 6" /></S>;
export const IconBell = () => <S><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></S>;
export const IconClock = () => <S><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>;
