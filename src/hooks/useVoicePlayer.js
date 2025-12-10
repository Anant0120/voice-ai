import { useCallback, useEffect, useRef, useState } from 'react';

function useVoicePlayer() {
  const [mouthOpen, setMouthOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef(null);
  const toggleTimer = useRef(null);

  const cleanup = useCallback(() => {
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    if (toggleTimer.current) {
      clearInterval(toggleTimer.current);
      toggleTimer.current = null;
    }
    setMouthOpen(false);
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text) =>
      new Promise((resolve) => {
        if (!window.speechSynthesis) {
          resolve();
          return;
        }

        cleanup();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1;
        utterance.lang = 'en-US';

        utterance.onstart = () => {
          setSpeaking(true);
          // If boundary events are sparse, fall back to a timed toggle
          toggleTimer.current = setInterval(
            () => setMouthOpen((open) => !open),
            160
          );
        };

        utterance.onboundary = () => {
          setMouthOpen((open) => !open);
        };

        utterance.onend = () => {
          cleanup();
          resolve();
        };

        utterance.onerror = () => {
          cleanup();
          resolve();
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }),
    [cleanup]
  );

  const cancel = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return { mouthOpen, speaking, speak, cancel };
}

export default useVoicePlayer;

