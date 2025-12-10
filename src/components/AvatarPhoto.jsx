import { useEffect, useRef, useState } from 'react';
import './AvatarPhoto.css';

// Viseme to mouth shape mapping for 2D photo
const VISEME_MOUTH_SHAPES = {
  0: { open: 0, shape: 'closed' },      // silence - closed
  1: { open: 0.3, shape: 'puckered' },   // PP (p, b, m) - puckered
  2: { open: 0.2, shape: 'teeth' },      // FF (f, v) - teeth
  3: { open: 0.25, shape: 'tongue' },    // TH (th) - tongue
  4: { open: 0.4, shape: 'open' },       // DD (d, t, k, g, n) - open
  5: { open: 0.5, shape: 'wide' },       // kk (k, g) - wide
  6: { open: 0.35, shape: 'rounded' },   // CH (ch, j) - rounded
  7: { open: 0.3, shape: 'narrow' },     // SS (s, z) - narrow
  8: { open: 0.4, shape: 'open' },       // nn (n) - open
  9: { open: 0.45, shape: 'rounded' },   // RR (r) - rounded
  10: { open: 0.6, shape: 'wide' },      // aa (a) - wide open
  11: { open: 0.5, shape: 'smile' },      // E (e) - smile
  12: { open: 0.4, shape: 'narrow' },     // ih (i) - narrow
  13: { open: 0.55, shape: 'rounded' },   // oh (o) - rounded open
  14: { open: 0.5, shape: 'puckered' },    // ou (u) - puckered
};

function AvatarPhoto({ viseme, speaking }) {
  const [mouthOpen, setMouthOpen] = useState(0);
  const [mouthShape, setMouthShape] = useState('closed');
  const [isBlinking, setIsBlinking] = useState(false);
  const [headRotation, setHeadRotation] = useState({ x: 0, y: 0 });
  const blinkTimerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Update mouth based on viseme
  useEffect(() => {
    if (viseme !== null && viseme !== undefined) {
      const mouthData = VISEME_MOUTH_SHAPES[viseme] || VISEME_MOUTH_SHAPES[0];
      setMouthOpen(mouthData.open);
      setMouthShape(mouthData.shape);
    } else if (!speaking) {
      setMouthOpen(0);
      setMouthShape('closed');
    }
  }, [viseme, speaking]);

  // Blinking animation
  useEffect(() => {
    const scheduleBlink = () => {
      const blinkDelay = 2000 + Math.random() * 3000; // 2-5 seconds
      blinkTimerRef.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleBlink();
      }, blinkDelay);
    };

    scheduleBlink();
    return () => {
      if (blinkTimerRef.current) {
        clearTimeout(blinkTimerRef.current);
      }
    };
  }, []);

  // Head movement and gestures while speaking
  useEffect(() => {
    if (speaking) {
      let startTime = Date.now();
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const speechRhythm = Math.sin(elapsed * 2) * 0.03;
        const headNod = Math.sin(elapsed * 1.5) * 0.02;
        
        setHeadRotation({
          y: speechRhythm,
          x: headNod,
        });

        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      // Return to neutral
      const returnToNeutral = () => {
        setHeadRotation(prev => {
          const newY = prev.y * 0.9;
          const newX = prev.x * 0.9;
          
          if (Math.abs(newY) > 0.001 || Math.abs(newX) > 0.001) {
            animationFrameRef.current = requestAnimationFrame(returnToNeutral);
            return { y: newY, x: newX };
          }
          return { y: 0, x: 0 };
        });
      };
      returnToNeutral();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [speaking]);

  return (
    <div className="avatar-photo-container">
      <div 
        className="avatar-photo-wrapper"
        style={{
          transform: `rotateY(${headRotation.y * 10}deg) rotateX(${headRotation.x * 10}deg)`,
        }}
      >
        <div className="avatar-photo">
          <img 
            src="/avatar-photo.png" 
            alt="Avatar" 
            className="avatar-image"
            onError={(e) => {
              // Try JPG as fallback
              if (e.target.src.includes('.png')) {
                e.target.src = '/avatar-photo.jpg';
              } else {
                // Fallback if image doesn't exist
                e.target.style.display = 'none';
                console.warn('Avatar photo not found. Please add avatar-photo.png or avatar-photo.jpg to the public folder.');
              }
            }}
          />
          
          {/* Mouth overlay for lip-sync - Realistic version */}
          <div 
            className={`mouth-overlay ${mouthShape}`}
            style={{
              opacity: speaking && mouthOpen > 0 ? Math.min(0.95, 0.7 + mouthOpen * 0.25) : 0,
              transform: `translateX(-50%) translateY(-50%) scaleY(${0.2 + mouthOpen * 0.8}) scaleX(${0.8 + mouthOpen * 0.4})`,
              transition: 'opacity 0.08s ease-out, transform 0.08s ease-out',
            }}
          >
            <div className="mouth-inner" />
            <div className="mouth-teeth" />
            <div className="mouth-tongue" />
            <div className="mouth-shadow" />
          </div>
          
          {/* Upper lip shadow for depth */}
          <div 
            className="mouth-upper-shadow"
            style={{
              opacity: speaking && mouthOpen > 0.3 ? mouthOpen * 0.4 : 0,
            }}
          />

          {/* Eye blink overlay */}
          <div 
            className={`eye-overlay ${isBlinking ? 'blinking' : ''}`}
            style={{
              opacity: isBlinking ? 1 : 0,
            }}
          />

          {/* Subtle glow when speaking */}
          {speaking && (
            <div className="speaking-glow" />
          )}
        </div>
      </div>
      <p className="hint">
        Realistic photo avatar with advanced lip-sync
      </p>
    </div>
  );
}

export default AvatarPhoto;

