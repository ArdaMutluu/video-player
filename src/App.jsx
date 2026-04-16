import React, { Suspense, lazy } from 'react';

// 1. Lazy load the component 
// This tells the browser: "Don't download the player code yet!"
const CustomVideoPlayer = lazy(() => import("./CustomVideoPlayer.jsx"));

// Import your test video (Vite will handle the pathing)
import myTestVideo from './assets/test-video.mp4'; 

function App() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <h1 style={{ color: '#ccff00', textAlign: 'center' }}>aaa</h1>
      
      {/* 2. Wrap in Suspense */}
      {/* The 'fallback' shows while the browser is fetching the Player code */}
      <Suspense fallback={
        <div style={{ 
          color: '#ccff00', 
          height: '400px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          border: '2px dashed #ccff00',
          borderRadius: '12px'
        }}>
          Yükleniyor...
        </div>
      }>
        <CustomVideoPlayer streamUrl={myTestVideo} />
      </Suspense>
    </div>
  );
}

export default App;