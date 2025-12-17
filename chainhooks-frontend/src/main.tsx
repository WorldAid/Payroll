import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Connect } from '@stacks/connect-react';
import { AppConfig, UserSession } from '@stacks/connect';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

const el = document.getElementById('root')!;
createRoot(el).render(
  <React.StrictMode>
    <Connect
      authOptions={{
        appDetails: {
          name: 'Stacks Chainhooks Manager',
          icon: `${window.location.origin}/icon.png`,
        },
        redirectTo: '/',
        onFinish: () => {
          window.location.reload();
        },
        userSession,
      }}
    >
      <App />
    </Connect>
  </React.StrictMode>
);