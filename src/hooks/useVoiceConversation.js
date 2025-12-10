import { useCallback, useEffect, useRef, useState } from 'react';
import useLLM from './useLLM.js';

function useVoiceConversation() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSessionActive, setVoiceSessionActive] = useState(false);
  
  const { callLLM } = useLLM();
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);
  const currentUtteranceRef = useRef(null);
  const handleUserSpeechRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        // Interrupt bot if speaking
        if (synthRef.current) {
          synthRef.current.cancel();
          setIsSpeaking(false);
        }
      };

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          }
        }
        if (finalTranscript.trim()) {
          recognitionRef.current.stop();
          // Use a ref to access the latest handleUserSpeech
          handleUserSpeechRef.current(finalTranscript.trim());
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        // Don't auto-restart on errors, let user click again
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    synthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  // Speak text using browser TTS
  const speakText = useCallback((text) => {
    return new Promise((resolve) => {
      if (!synthRef.current) {
        resolve();
        return;
      }

      // Cancel any ongoing speech
      synthRef.current.cancel();
      setIsSpeaking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      utterance.lang = 'en-US';

      utterance.onend = () => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        
        // Auto-restart listening if session is active (smooth transition)
        const checkAndRestart = () => {
          if (voiceSessionActive && recognitionRef.current && !isListening) {
            try {
              // Small delay to ensure speech is fully finished
              setTimeout(() => {
                if (voiceSessionActive && recognitionRef.current && !isListening) {
                  recognitionRef.current.start();
                }
              }, 800);
            } catch (e) {
              // Recognition might already be starting, ignore
            }
          }
        };
        
        checkAndRestart();
        resolve();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        resolve();
      };

      currentUtteranceRef.current = utterance;
      synthRef.current.speak(utterance);
    });
  }, [voiceSessionActive]);

  // Handle user speech
  const handleUserSpeech = useCallback(async (transcript) => {
    console.log('User said:', transcript);

    // Check for exit commands
    if (['exit', 'quit', 'goodbye', 'bye', 'stop'].some(word => transcript.toLowerCase().includes(word))) {
      await speakText("Goodbye! It was nice talking with you.");
      setVoiceSessionActive(false);
      return;
    }

    try {
      // Get response from LLM
      const response = await callLLM(transcript);
      
      // Speak the response
      if (response) {
        await speakText(response);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "I'm sorry, I encountered an error. Could you try again?";
      await speakText(errorMsg);
    }
  }, [callLLM, speakText]);

  // Keep ref updated
  useEffect(() => {
    handleUserSpeechRef.current = handleUserSpeech;
  }, [handleUserSpeech]);

  // Start listening
  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Might already be starting, ignore
        console.warn('Recognition start:', e.message);
      }
    }
  }, []);

  // Toggle voice session
  const toggleVoiceSession = useCallback(() => {
    setVoiceSessionActive((prevActive) => {
      if (prevActive) {
        // Stop session
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {}
        }
        if (synthRef.current) {
          synthRef.current.cancel();
        }
        setIsSpeaking(false);
        setIsListening(false);
        return false;
      } else {
        // Start session
        // Prime TTS (unlock audio on mobile)
        if (synthRef.current) {
          const primeUtterance = new SpeechSynthesisUtterance('');
          synthRef.current.speak(primeUtterance);
          synthRef.current.cancel();
        }
        // Start listening
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.warn('Failed to start recognition:', e);
            }
          }
        }, 100);
        return true;
      }
    });
  }, []);

  // Skip current speech
  const skipSpeech = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
    // Restart listening if session is active
    if (voiceSessionActive && recognitionRef.current) {
      setTimeout(() => {
        if (voiceSessionActive && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Might already be starting
          }
        }
      }, 300);
    }
  }, [voiceSessionActive]);

  return {
    isListening,
    isSpeaking,
    voiceSessionActive,
    toggleVoiceSession,
    skipSpeech,
    startListening,
  };
}

export default useVoiceConversation;

