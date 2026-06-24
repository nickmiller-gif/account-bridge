import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { accountBridgeThemeCss } from '@account-bridge/ui';

import { App } from './App.js';
import './styles.css';

const themeStyle = document.createElement('style');
themeStyle.id = 'account-bridge-theme';
themeStyle.textContent = accountBridgeThemeCss;
document.head.appendChild(themeStyle);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
