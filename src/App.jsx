import { useEffect, useMemo, useRef, useState } from 'react';
import SyntheticAvatar from './components/SyntheticAvatar.jsx';
import ChatMessage from './components/ChatMessage.jsx';
import VoiceAnimation from './components/VoiceAnimation.jsx';
import useElevenLabsTTS from './hooks/useElevenLabsTTS.js';
import useVoiceConversation from './hooks/useVoiceConversation.js';
import useLLM from './hooks/useLLM.js';
import './styles.css';

function App() {
  const [activeTab, setActiveTab] = useState('avatar'); // 'avatar', 'voice', or 'chat'
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hey, I'm Anant's AI—ask me anything.",
      id: 'welcome',
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);

  const { viseme, speaking, speak, cancel, error: elevenLabsError } = useElevenLabsTTS();
  const {
    isListening: voiceListening,
    isSpeaking: voiceSpeaking,
    voiceSessionActive,
    toggleVoiceSession,
    skipSpeech,
  } = useVoiceConversation();
  const { callLLM, isLoading: llmLoading } = useLLM();

  

  const canSend = useMemo(
    () => input.trim().length > 0 && !isSending,
    [input, isSending]
  );

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Show ElevenLabs error messages in avatar tab
  useEffect(() => {
    if (elevenLabsError && activeTab === 'avatar') {
      const errorMessage = {
        role: 'assistant',
        text: elevenLabsError,
        id: `${Date.now()}-elevenlabs-error`,
      };
      setMessages((prev) => {
        // Check if this error message already exists to avoid duplicates
        const exists = prev.some(msg => msg.id === errorMessage.id || 
          (msg.role === 'assistant' && msg.text === elevenLabsError));
        if (!exists) {
          return [...prev, errorMessage];
        }
        return prev;
      });
    }
  }, [elevenLabsError, activeTab]);

  const handleSend = async () => {
    if (!canSend) return;
    const question = input.trim();
    setInput('');
    setError('');

    const userMessage = { role: 'user', text: question, id: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);

    try {
      cancel(); 
      
      
      const rawBotText = await callLLM(question);
      const botText =
        rawBotText && rawBotText.trim().length > 0
          ? rawBotText
          : "I didn’t get a full answer, but I’m here—want to ask that another way?";
      
      const botMessage = {
        role: 'assistant',
        text: botText,
        id: `${Date.now()}-bot`,
      };

      setMessages((prev) => [...prev, botMessage]);
      setIsSending(false); // stop showing sending state as soon as text is ready
      if (activeTab !== 'chat') {
        // Fire-and-forget TTS to avoid blocking UI; red stop can still cancel
        speak(botText).catch(() => {});
      }
    } catch (err) {
      const fallbackText =
        "I’m having a hiccup answering that right now, but I’m still here—want to try a shorter version or a different question?";
      const botMessage = {
        role: 'assistant',
        text: fallbackText,
        id: `${Date.now()}-bot-fallback`,
      };
      setMessages((prev) => [...prev, botMessage]);
      setError('');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <div className="dot" />
          <div>
            <h1>Anant's AI</h1>
            <p className="subtitle">Voice and Chat</p>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'avatar' ? 'active' : ''}`}
            onClick={() => setActiveTab('avatar')}
          >
            Avatar
          </button>
          <button
            className={`tab ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            Voice
          </button>
          <button
            className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
        </div>

        {/* Avatar Tab */}
        {activeTab === 'avatar' && (
          <div className="tab-content avatar-tab-content">
            {/* Avatar Display */}
            <div className="avatar-container">
              <SyntheticAvatar viseme={viseme} speaking={speaking} />
              {/* Status indicator */}
              <div className="avatar-status">
                {llmLoading ? (
                  <div className="status-badge loading">
                    <div className="spinner"></div>
                    <span>Thinking...</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Chat Messages */}
            <div className="avatar-chat-messages">
              <div className="messages" ref={listRef}>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} text={msg.text} />
                ))}
              </div>
            </div>

            {/* Input Section */}
            <div className="input-section avatar-input-section">
              <div className="input-container">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question..."
                  className="text-input"
                  disabled={isSending}
                />
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="send-btn"
                >
                  Send
                </button>
                {speaking && (
                  <button
                    onClick={cancel}
                    className="stop-btn"
                    title="Stop audio"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                    </svg>
                  </button>
                )}
              </div>
              {error && <span className="error-message">{error}</span>}
            </div>
          </div>
        )}

        {/* Voice Tab */}
        {activeTab === 'voice' && (
          <div className="tab-content voice-tab-content">
            {/* Voice Animation */}
            <div className="voice-stage">
              <VoiceAnimation 
                isListening={voiceListening} 
                isSpeaking={voiceSpeaking}
              />
            </div>
            
            {/* Voice Controls */}
            <div className="voice-controls">
              <button
                className={`voice-btn ${voiceListening ? 'listening' : ''} ${voiceSessionActive ? 'active' : ''}`}
                onClick={toggleVoiceSession}
                title={voiceSessionActive ? 'Stop conversation' : 'Click to speak'}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              </button>
              
              {voiceSpeaking && (
                <button
                  className="control-btn skip-btn"
                  onClick={skipSpeech}
                  title="Skip and ask next"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="5 4 15 12 5 20 5 4"></polygon>
                    <line x1="19" y1="5" x2="19" y2="19"></line>
                  </svg>
                </button>
              )}
            </div>
            
            {/* Status */}
            <div className="voice-status">
              {voiceSessionActive ? (
                voiceListening ? (
                  <p className="status-text"></p>
                ) : voiceSpeaking ? (
                  <p className="status-text"></p>
                ) : (
                  <p className="status-text"></p>
                )
              ) : (
                <p className="status-text">Click the microphone to start a voice conversation</p>
              )}
            </div>
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="tab-content">
            <div className="chat-container">
              <div className="messages" ref={listRef}>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} role={msg.role} text={msg.text} />
                ))}
              </div>
            </div>
            <div className="input-section">
              <div className="input-container">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question..."
                  className="text-input"
                  disabled={isSending}
                />
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="send-btn"
                >
                  Send
                </button>
              </div>
              {error && <span className="error-message">{error}</span>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

