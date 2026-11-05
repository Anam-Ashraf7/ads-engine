import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { isSignedIn, LoginGate } from './Login';
import { AppProvider } from './state';
import '@fontsource-variable/inter/index.css';
import './styles.css';

// Signed-out visitors to "/" keep the public home page that index.html already shows. Google needs it to be public.
if (location.pathname !== '/' || isSignedIn()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <AppProvider>
          <LoginGate>
            <App />
          </LoginGate>
        </AppProvider>
      </BrowserRouter>
    </StrictMode>,
  );
}
