function ChatMessage({ role, text }) {
  const isUser = role === 'user';
  return (
    <div className={`message ${isUser ? 'user' : 'bot'}`}>
      <div className="bubble">
        <p>{text}</p>
      </div>
      <span className="label">{isUser ? 'You' : 'Anant AI'}</span>
    </div>
  );
}

export default ChatMessage;

