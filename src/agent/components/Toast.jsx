import { createContext, useCallback, useContext, useRef, useState } from 'react';

const Ctx = createContext(() => {});

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const timer = useRef(null);
  const show = useCallback((text) => {
    setMsg(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2800);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg ? <div className="toast" role="status">{msg}</div> : null}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
