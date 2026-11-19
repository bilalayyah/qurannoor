import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    // Registration can fail in unsupported or restricted preview frames;
    // warn so a broken offline/push setup is visible instead of silent.
    console.warn('Service worker registration failed:', error);
  });
}
