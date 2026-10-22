import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { FlowProvider } from './features/flows/FlowProvider';
import { StoreProvider } from './store/StoreProvider';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import { ToastProvider } from './ui/Toast';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <FlowProvider>
          <App />
        </FlowProvider>
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
);
