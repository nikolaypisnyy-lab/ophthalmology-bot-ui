import ReactDOM from 'react-dom/client';
import { App } from './App';
import './globals.css';

// Чистим пациентов без ID из localStorage
try {
  const raw = localStorage.getItem('rm_patients');
  if (raw) {
    const list = JSON.parse(raw);
    const clean = list.filter((p: any) => p.id && String(p.id) !== 'undefined' && String(p.id) !== '');
    localStorage.setItem('rm_patients', JSON.stringify(clean));
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
);
