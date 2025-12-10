import { useEffect, useRef, useState } from 'react';
import './SyntheticAvatar.css';

// Viseme to mouth shape mapping
const VISEME_MOUTH_SHAPES = {
  0: { open: 0, shape: 'closed', width: 60, height: 3 },
  1: { open: 0.3, shape: 'puckered', width: 50, height: 30 },
  2: { open: 0.2, shape: 'teeth', width: 70, height: 25 },
  3: { open: 0.25, shape: 'tongue', width: 65, height: 35 },
  4: { open: 0.4, shape: 'open', width: 75, height: 40 },
  5: { open: 0.5, shape: 'wide', width: 100, height: 50 },
  6: { open: 0.35, shape: 'rounded', width: 70, height: 45 },
  7: { open: 0.3, shape: 'narrow', width: 45, height: 25 },
  8: { open: 0.4, shape: 'open', width: 75, height: 40 },
  9: { open: 0.45, shape: 'rounded', width: 75, height: 48 },
  10: { open: 0.6, shape: 'wide', width: 110, height: 55 },
  11: { open: 0.5, shape: 'smile', width: 95, height: 18 },
  12: { open: 0.4, shape: 'narrow', width: 50, height: 28 },
  13: { open: 0.55, shape: 'rounded', width: 80, height: 52 },
  14: { open: 0.5, shape: 'puckered', width: 55, height: 35 },
};

function SyntheticAvatar({ viseme, speaking }) {
  const [mouthOpen, setMouthOpen] = useState(0);
  const [mouthShape, setMouthShape] = useState('closed');
  const [mouthWidth, setMouthWidth] = useState(60);
  const [mouthHeight, setMouthHeight] = useState(3);
  const [isBlinking, setIsBlinking] = useState(false);
  const [headRotation, setHeadRotation] = useState({ x: 0, y: 0 });
  const [eyeOpen, setEyeOpen] = useState(1);
  const blinkTimerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Update mouth based on viseme
  useEffect(() => {
    if (viseme !== null && viseme !== undefined) {
      const mouthData = VISEME_MOUTH_SHAPES[viseme] || VISEME_MOUTH_SHAPES[0];
      setMouthOpen(mouthData.open);
      setMouthShape(mouthData.shape);
      setMouthWidth(mouthData.width);
      setMouthHeight(mouthData.height);
    } else if (!speaking) {
      setMouthOpen(0);
      setMouthShape('closed');
      setMouthWidth(60);
      setMouthHeight(3);
    }
  }, [viseme, speaking]);

  // Blinking animation
  useEffect(() => {
    const scheduleBlink = () => {
      const blinkDelay = 2000 + Math.random() * 3000;
      blinkTimerRef.current = setTimeout(() => {
        setIsBlinking(true);
        setEyeOpen(0);
        setTimeout(() => {
          setIsBlinking(false);
          setEyeOpen(1);
        }, 150);
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

  // Head movement while speaking
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
    <div className="synthetic-avatar-container">
      <div 
        className="synthetic-avatar-wrapper"
        style={{
          transform: `rotateY(${headRotation.y * 10}deg) rotateX(${headRotation.x * 10}deg)`,
        }}
      >
        <div className="synthetic-avatar">
          {/* Face shape */}
          <div className="face-shape">
            {/* Hair */}
            <div className="hair" />
            
            {/* Forehead highlight */}
            <div className="forehead-highlight" />
            
            {/* Left eyebrow */}
            <div className="eyebrow left" />
            
            {/* Right eyebrow */}
            <div className="eyebrow right" />
            
            {/* Left eye */}
            <div className="eye left">
              <div className="eyeball">
                <div className="iris">
                  <div className="pupil" />
                </div>
              </div>
              <div 
                className="eyelid"
                style={{
                  height: `${(1 - eyeOpen) * 100}%`,
                }}
              />
            </div>
            
            {/* Right eye */}
            <div className="eye right">
              <div className="eyeball">
                <div className="iris">
                  <div className="pupil" />
                </div>
              </div>
              <div 
                className="eyelid"
                style={{
                  height: `${(1 - eyeOpen) * 100}%`,
                }}
              />
            </div>
            
            {/* Nose */}
            <div className="nose">
              <div className="nose-bridge" />
              <div className="nose-shadow" />
            </div>
            
            {/* Cheeks */}
            <div className="cheek left" />
            <div className="cheek right" />
            
            {/* Mouth */}
            <div 
              className={`mouth ${mouthShape}`}
              style={{
                width: `${mouthWidth}px`,
                height: `${mouthHeight}px`,
                opacity: speaking && mouthOpen > 0 ? Math.min(0.95, 0.7 + mouthOpen * 0.25) : (mouthOpen > 0 ? 0.3 : 0.1),
                transform: `translateX(-50%) scaleY(${0.2 + mouthOpen * 0.8}) scaleX(${0.8 + mouthOpen * 0.4})`,
                transition: 'all 0.08s ease-out',
              }}
            >
              <div className="mouth-inner">
                {mouthOpen > 0.3 && <div className="mouth-teeth" />}
                {mouthOpen > 0.4 && mouthShape === 'tongue' && <div className="mouth-tongue" />}
              </div>
              <div className="mouth-shadow" />
            </div>
            
            {/* Chin */}
            <div className="chin" />
            
            {/* Neck */}
            <div className="neck" />
            
            {/* Shirt/Collar */}
            <div className="shirt" />
          </div>
          
          {/* Speaking glow */}
          {speaking && <div className="speaking-glow" />}
        </div>
      </div>
    </div>
  );
}

export default SyntheticAvatar;

