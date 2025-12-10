import { useEffect, useRef, useState } from 'react';
import './TemplateUI.css';

function TemplateUI({ viseme, speaking, onSendMessage, messages, input, setInput, isSending }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [gifSrc, setGifSrc] = useState('/mp.gif');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (speaking) {
      setGifSrc('/sp.gif');
    } else {
      setGifSrc('/mp.gif');
    }
  }, [speaking]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim() && !isSending) {
      onSendMessage(input.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="template-container">
      <div className="template-header">
        <div className="template-header-left">
          <h1>Anant's AI</h1>
          <p className="template-subtitle">Voice and Chat</p>
        </div>
      </div>

      <div className="template-main-content">
        {/* Tabs */}
        <div className="template-tabs">
          <button 
            className={`template-tab ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            Voice
          </button>
          <button 
            className={`template-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
        </div>

        {/* Voice Pane */}
        {activeTab === 'voice' && (
          <div className="template-pane">
            <div className="template-voice-stage">
              <img 
                src={gifSrc}
                alt="voice-state"
                className="template-voice-gif"
              />
            </div>
          </div>
        )}

        {/* Chat Pane */}
        {activeTab === 'chat' && (
          <div className="template-pane">
            <div className="template-chat-container">
              <div className="template-chat-messages" ref={messagesEndRef}>
                {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`template-message ${msg.role === 'user' ? 'user' : 'bot'}`}
                  >
                    <div className="template-message-bubble">
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="template-message bot">
                    <div className="template-message-bubble">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Section */}
            <div className="template-input-section">
              <div className="template-input-container">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question..."
                  className="template-text-input"
                  disabled={isSending}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className="template-send-btn"
                  title="Send message"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplateUI;

