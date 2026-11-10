import { createRoot } from 'react-dom/client';
import { createDefaultContext } from '../data/context';
import { getStoredProfile } from '../pwa/profile';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');
createRoot(root).render(<App ctx={createDefaultContext(getStoredProfile())} />);
