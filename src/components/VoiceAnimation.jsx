import './VoiceAnimation.css';

function VoiceAnimation({ isListening, isSpeaking }) {
  const isActive = isListening || isSpeaking;
  const animationClass = isActive 
    ? (isListening ? 'active listening' : 'active speaking')
    : '';

  return (
    <div className="voice-animation-container">
      <div className={`voice-animation ${animationClass}`}>
        {/* Concentric circles */}
        <div className={`circle circle-1 ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}></div>
        <div className={`circle circle-2 ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}></div>
        <div className={`circle circle-3 ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}></div>
        <div className={`circle circle-4 ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}></div>
        <div className={`circle circle-5 ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}></div>
        <div className={`circle circle-6 ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}></div>
        <div className={`circle circle-7 ${isListening ? 'listening' : ''} ${isSpeaking ? 'speaking' : ''}`}></div>
        
        {/* Microphone icon in center */}
        <div className="mic-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default VoiceAnimation;

