import { useCallback, useEffect, useRef, useState } from 'react';

const ELEVENLABS_API_KEY =
  import.meta.env.VITE_ELEVENLABS_API_KEY || 'sk_8d7d1ffa5c095d927021459abf1ae59ae66367acc25a85bf';
const ELEVENLABS_VOICE_ID =
  import.meta.env.VITE_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; 

function useElevenLabsTTS() {
  const [viseme, setViseme] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const visemeQueueRef = useRef([]);
  const currentVisemeTimeoutRef = useRef(null);
  const browserTTSCancelIntervalRef = useRef(null);
  const postCancelIntervalRef = useRef(null);
  const elevenLabsActiveRef = useRef(false);
  const originalSpeakRef = useRef(null);
  const synthRef = useRef(
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null
  );

  // Block browser TTS permanently in avatar tab - no fallback
  const blockBrowserTTS = useCallback(() => {
    if (synthRef.current && originalSpeakRef.current === null) {
      // Store original speak method
      originalSpeakRef.current = synthRef.current.speak.bind(synthRef.current);
      // Override speak to ALWAYS block it in avatar tab (no fallback)
      synthRef.current.speak = function(utterance) {
        // Always block browser TTS in avatar tab - no exceptions
        console.log('🚫 Blocked browser TTS - Avatar tab uses ElevenLabs only');
        return;
      };
    }
  }, []);


  const cleanup = useCallback((isCancel = false) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (currentVisemeTimeoutRef.current) {
      clearTimeout(currentVisemeTimeoutRef.current);
      currentVisemeTimeoutRef.current = null;
    }
    if (browserTTSCancelIntervalRef.current) {
      clearInterval(browserTTSCancelIntervalRef.current);
      browserTTSCancelIntervalRef.current = null;
    }
    if (postCancelIntervalRef.current) {
      clearInterval(postCancelIntervalRef.current);
      postCancelIntervalRef.current = null;
    }
    // Never restore browser TTS in avatar tab - keep it blocked permanently
    // Browser TTS is only for voice tab
    // Cancel any browser TTS (only used as fallback when ElevenLabs fails)
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    visemeQueueRef.current = [];
    setViseme(null);
    setSpeaking(false);
    setError(null);
  }, []);

  const speak = useCallback(
    (text) =>
      new Promise((resolve) => {
        if (!text || !text.trim()) {
          resolve();
          return;
        }

        cleanup();
        
        // Clear any previous errors
        setError(null);
        
        // Cancel any browser TTS before starting ElevenLabs (browser TTS is ONLY used as fallback when ElevenLabs fails)
        if (synthRef.current) {
          synthRef.current.cancel();
        }
        
        // Block browser TTS when ElevenLabs is starting
        blockBrowserTTS();

        // ElevenLabs TTS API with viseme streaming
        const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`;
        
        const requestBody = {
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        };

        
        if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY.length < 10) {
          // No API key - show error message
          setError("ElevenLabs API key is missing. You can use the Voice or Chat tab instead.");
          resolve();
          return;
        }

        console.log('🔑 Using API key:', ELEVENLABS_API_KEY.substring(0, 10) + '...');
        console.log('🎤 Using Voice ID:', ELEVENLABS_VOICE_ID);

        fetch(url, {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          body: JSON.stringify(requestBody),
        })
          .then(async (response) => {
            if (!response.ok) {
              // Get error details from response
              let errorDetail = '';
              try {
                const errorData = await response.json();
                if (errorData.detail?.message) {
                  errorDetail = errorData.detail.message.toLowerCase();
                }
              } catch (e) {
                // Ignore JSON parse errors
              }
              
              // API error - show user-friendly message
              if (response.status === 429 || response.status === 402 || 
                  errorDetail.includes('quota') || errorDetail.includes('credit') || 
                  errorDetail.includes('limit') || errorDetail.includes('subscription')) {
                // Rate limit or payment issue (likely free credits exhausted)
                setError("ElevenLabs free credits are over. You can use the Voice or Chat tab instead.");
              } else if (response.status === 401) {
                setError("ElevenLabs API key is invalid. You can use the Voice or Chat tab instead.");
              } else {
                setError("ElevenLabs service is unavailable. You can use the Voice or Chat tab instead.");
              }
              resolve();
              return null;
            }
            return response.blob();
          })
          .then((blob) => {
            if (!blob) return;
            // Cancel any browser TTS before playing ElevenLabs audio (browser TTS is ONLY fallback)
            if (synthRef.current) {
              synthRef.current.cancel();
            }
            
            // Mark ElevenLabs as active - this will block browser TTS via the overridden speak method
            elevenLabsActiveRef.current = true;
            // Also continuously cancel browser TTS while ElevenLabs is playing (extra safety)
            browserTTSCancelIntervalRef.current = setInterval(() => {
              if (synthRef.current) {
                synthRef.current.cancel();
              }
            }, 100); // Cancel every 100ms to prevent any browser TTS from starting
            
            const audioUrl = URL.createObjectURL(blob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            setSpeaking(true);

            // Generate viseme sequence based on text
            const visemeSequence = generateVisemeSequence(text);
            
            // Calculate timing: distribute visemes across audio duration
            // Wait for audio metadata to load for accurate duration
            audio.addEventListener('loadedmetadata', () => {
              const duration = audio.duration;
              const visemeCount = visemeSequence.length;
              const visemeDuration = duration / visemeCount; // Time per viseme
              
              let visemeIndex = 0;
              
              // Schedule visemes based on actual audio timing
              const scheduleViseme = () => {
                if (visemeIndex < visemeSequence.length && !audio.paused && !audio.ended) {
                  setViseme(visemeSequence[visemeIndex]);
                  visemeIndex++;
                  
                  // Schedule next viseme
                  if (visemeIndex < visemeSequence.length) {
                    currentVisemeTimeoutRef.current = setTimeout(scheduleViseme, visemeDuration * 1000);
                  }
                }
              };
              
              // Start viseme sequence when audio starts playing
              audio.addEventListener('play', () => {
                scheduleViseme();
              });
            });

            // Fallback: if metadata doesn't load, use estimated timing
            const words = text.split(/\s+/);
            const estimatedDuration = words.length * 0.35; // ~0.35s per word
            const visemeInterval = Math.max(80, (estimatedDuration * 1000) / visemeSequence.length);
            
            let visemeIndex = 0;
            const visemeIntervalId = setInterval(() => {
              if (visemeIndex < visemeSequence.length && !audio.paused && !audio.ended) {
                setViseme(visemeSequence[visemeIndex]);
                visemeIndex++;
              } else if (audio.ended || audio.paused) {
                clearInterval(visemeIntervalId);
              }
            }, visemeInterval);

            audio.onended = () => {
              clearInterval(visemeIntervalId);
              if (currentVisemeTimeoutRef.current) {
                clearTimeout(currentVisemeTimeoutRef.current);
              }
              setViseme(0); // Reset to silence
              
              // Keep blocking browser TTS for 5 seconds after ElevenLabs completes
              // This prevents any browser TTS from triggering after ElevenLabs finishes
              let cancelCount = 0;
              postCancelIntervalRef.current = setInterval(() => {
                if (synthRef.current) {
                  synthRef.current.cancel();
                }
                cancelCount++;
                if (cancelCount >= 50) { // 50 * 100ms = 5 seconds
                  clearInterval(postCancelIntervalRef.current);
                  postCancelIntervalRef.current = null;
                  // Mark ElevenLabs as no longer active
                  // Don't restore browser TTS - keep it blocked permanently in avatar tab
                  elevenLabsActiveRef.current = false;
                }
              }, 100);
              
              // Also cancel immediately
              if (synthRef.current) {
                synthRef.current.cancel();
              }
              
              // Don't restore browser TTS immediately - keep blocking for 5 seconds
              // elevenLabsActiveRef stays true during the blocking period
              
              cleanup();
              URL.revokeObjectURL(audioUrl);
              resolve();
            };

            audio.onerror = () => {
              clearInterval(visemeIntervalId);
              if (currentVisemeTimeoutRef.current) {
                clearTimeout(currentVisemeTimeoutRef.current);
              }
              // Audio error - show user-friendly message
              setError("ElevenLabs audio failed to load. You can use the Voice or Chat tab instead.");
              cleanup();
              URL.revokeObjectURL(audioUrl);
              resolve();
            };

            audio.play().catch((error) => {
              clearInterval(visemeIntervalId);
              if (currentVisemeTimeoutRef.current) {
                clearTimeout(currentVisemeTimeoutRef.current);
              }
              // Play error - show user-friendly message
              setError("ElevenLabs audio failed to play. You can use the Voice or Chat tab instead.");
              cleanup();
              URL.revokeObjectURL(audioUrl);
              resolve();
            });
          })
          .catch((error) => {
            // Fetch error - show user-friendly message
            setError("ElevenLabs service is unavailable. You can use the Voice or Chat tab instead.");
            cleanup();
            resolve();
          });
      }),
    [cleanup, blockBrowserTTS]
  );

  const cancel = useCallback(() => {
    cleanup(true); // Pass true to indicate manual cancellation
  }, [cleanup]);

  useEffect(() => {
    // Initialize browser TTS blocking on mount - keep it blocked permanently in avatar tab
    blockBrowserTTS();
    return () => {
      cleanup();
      // Don't restore browser TTS - keep it blocked
    };
  }, [cleanup, blockBrowserTTS]);

  return { viseme, speaking, speak, cancel, error };
}

// Enhanced phoneme-to-viseme mapping with better accuracy
function generateVisemeSequence(text) {
  const sequence = [];
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  
  words.forEach((word, wordIndex) => {
    if (!word) return;
    
    // Process each character with context
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const nextChar = word[i + 1];
      let visemeId = 0; // sil by default
      let duration = 2; // Default duration in frames
      
      // Vowels (longer duration, more prominent)
      if ('aeiou'.includes(char)) {
        if (char === 'a') visemeId = 10; // aa
        else if (char === 'e') visemeId = 11; // E
        else if (char === 'i' || char === 'y') visemeId = 12; // ih
        else if (char === 'o') visemeId = 13; // oh
        else if (char === 'u') visemeId = 14; // ou
        duration = 4; // Vowels are longer
      }
      // Consonants
      else if ('pb'.includes(char)) {
        visemeId = 1; // PP
        duration = 2;
      }
      else if ('fv'.includes(char)) {
        visemeId = 2; // FF
        duration = 2;
      }
      else if (char === 't' || char === 'd') {
        visemeId = 4; // DD
        duration = 2;
      }
      else if (char === 'k' || char === 'g') {
        visemeId = 5; // kk
        duration = 2;
      }
      else if (char === 'c' || char === 'j' || (char === 'h' && nextChar === 'c')) {
        visemeId = 6; // CH
        duration = 2;
      }
      else if ('sz'.includes(char)) {
        visemeId = 7; // SS
        duration = 3; // S sounds are longer
      }
      else if (char === 'n' || char === 'm') {
        visemeId = 8; // nn
        duration = 2;
      }
      else if (char === 'r' || char === 'l') {
        visemeId = 9; // RR
        duration = 2;
      }
      else if (char === 'w') {
        visemeId = 14; // ou (for 'w' sound)
        duration = 2;
      }
      else if (char === 'h') {
        visemeId = 10; // aa (for 'h' sound)
        duration = 1;
      }
      
      // Add viseme with calculated duration
      for (let j = 0; j < duration; j++) {
        sequence.push(visemeId);
      }
    }
    
    // Add brief silence between words (except last word)
    if (wordIndex < words.length - 1) {
      sequence.push(0);
      sequence.push(0);
    }
  });
  
  // Ensure sequence isn't empty
  if (sequence.length === 0) {
    sequence.push(0);
  }
  
  return sequence;
}

export default useElevenLabsTTS;

