import React from 'react';
import { createRoot } from 'react-dom/client';

const BlockedPage = (): JSX.Element => {
  const hash = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : '';

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 32, maxWidth: 700 }}>
      <h1>You are blocked.</h1>
      <p>Go outside and complete a quick challenge to unlock this site.</p>
      {hash ? <p>Original URL: {hash}</p> : null}
      <button type="button">Go touch grass</button>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(<BlockedPage />);
