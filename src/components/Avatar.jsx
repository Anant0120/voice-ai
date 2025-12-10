function Avatar({ mouthOpen, speaking }) {
  return (
    <div className="avatar">
      <div className="face">
        <div className="eye left" />
        <div className="eye right" />
        <div className={`mouth ${mouthOpen ? 'open' : ''}`} />
        <div className={`cheek left ${speaking ? 'pulse' : ''}`} />
        <div className={`cheek right ${speaking ? 'pulse' : ''}`} />
      </div>
      <div className="shadow" />
    </div>
  );
}

export default Avatar;

