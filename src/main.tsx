import React from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    (window as any).__qNexusDeferredPrompt = e;
    window.dispatchEvent(new CustomEvent('q-nexus-install-ready'));
  });
  window.addEventListener('appinstalled', () => {
    (window as any).__qNexusDeferredPrompt = null;
    window.dispatchEvent(new CustomEvent('q-nexus-app-installed'));
  });
}

registerSW({
  immediate: true,
  onRegisterError() {},
});

// Google Maps Platform Quota Defense Handlers
(window as any).gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};
const origError = console.error;
console.error = (...args: unknown[]) => {
  origError.apply(console, args);
  const msg = args.map((a) => String(a)).join(' ');
  if (msg.includes('OverQuotaMapError') || msg.includes('QuotaExceededError')) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
};

class AppErrorBoundary extends React.Component<
  {children: React.ReactNode},
  {hasError: boolean}
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError(): {hasError: boolean} {
    return {hasError: true};
  }

  componentDidCatch(error: Error) {
    console.warn('Recovered UI boundary:', error?.message || error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#02050f] text-slate-100 flex flex-col items-center justify-center p-6 gap-4 text-center font-sans">
          <div className="text-lg font-bold text-cyan-300">Wasu&apos;s Jarvis Interface Recovering</div>
          <button
            type="button"
            onClick={() => {
              this.setState({hasError: false});
            }}
            className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs cursor-pointer"
          >
            Restore Interface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
