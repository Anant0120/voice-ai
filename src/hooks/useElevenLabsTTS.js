import { useCallback, useEffect, useRef, useState } from 'react';

const ELEVENLABS_API_KEY =
  import.meta.env.VITE_ELEVENLABS_API_KEY || 'sk_8d7d1ffa5c095d927021459abf1ae59ae66367acc25a85bf';
const ELEVENLABS_VOICE_ID =
  import.meta.env.VITE_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; 

function useElevenLabsTTS() {
  const [viseme, setViseme] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);
  const visemeQueueRef = useRef([]);
  const currentVisemeTimeoutRef = useRef(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (currentVisemeTimeoutRef.current) {
      clearTimeout(currentVisemeTimeoutRef.current);
      currentVisemeTimeoutRef.current = null;
    }
    visemeQueueRef.current = [];
    setViseme(null);
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text) =>
      new Promise((resolve, reject) => {
        if (!text || !text.trim()) {
          resolve();
          return;
        }

        cleanup();

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
          console.error('❌ ElevenLabs API key is missing or invalid!');
          console.error('Please create a .env file with: VITE_ELEVENLABS_API_KEY=your_key_here');
          reject(new Error('ElevenLabs API key not configured. Please check your .env file.'));
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
              let errorMessage = `ElevenLabs API error: ${response.status}`;
              try {
                const errorData = await response.json();
                if (errorData.detail?.message) {
                  errorMessage += ` - ${errorData.detail.message}`;
                }
              } catch (e) {
                // Ignore JSON parse errors
              }
              
              if (response.status === 401) {
                errorMessage += '\n\n💡 401 Unauthorized - How to fix:\n';
                
                // Check if it's a permission issue
                if (errorMessage.includes('missing the permission text_to_speech')) {
                  errorMessage += '   ⚠️  Your API key is missing the "text_to_speech" permission!\n';
                  errorMessage += '   📝 Steps to fix:\n';
                  errorMessage += '      1. Go to: https://elevenlabs.io/app/settings/api-keys\n';
                  errorMessage += '      2. Find your API key (or create a new one)\n';
                  errorMessage += '      3. Make sure "Text to Speech" permission is ENABLED\n';
                  errorMessage += '      4. Save and restart your dev server\n';
                } else {
                  errorMessage += '   • Your API key is invalid or expired\n';
                  errorMessage += '   • The API key doesn\'t have access to this voice\n';
                  errorMessage += '   • Check your .env file: VITE_ELEVENLABS_API_KEY=your_key\n';
                  errorMessage += '   • Get a new key from: https://elevenlabs.io/app/settings/api-keys';
                }
              }
              
              throw new Error(errorMessage);
            }
            return response.blob();
          })
          .then((blob) => {
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
              cleanup();
              URL.revokeObjectURL(audioUrl);
              resolve();
            };

            audio.onerror = (error) => {
              clearInterval(visemeIntervalId);
              if (currentVisemeTimeoutRef.current) {
                clearTimeout(currentVisemeTimeoutRef.current);
              }
              cleanup();
              URL.revokeObjectURL(audioUrl);
              reject(error);
            };

            audio.play().catch((error) => {
              clearInterval(visemeIntervalId);
              if (currentVisemeTimeoutRef.current) {
                clearTimeout(currentVisemeTimeoutRef.current);
              }
              cleanup();
              URL.revokeObjectURL(audioUrl);
              reject(error);
            });
          })
          .catch((error) => {
            cleanup();
            reject(error);
          });
      }),
    [cleanup]
  );

  const cancel = useCallback(() => {
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { viseme, speaking, speak, cancel };
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

