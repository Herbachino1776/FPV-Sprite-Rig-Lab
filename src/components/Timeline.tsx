import { AnimationName, RigProject } from '../types/rig';

interface TimelineProps {
  project: RigProject;
  isPlaying: boolean;
  onAnimationChange: (name: AnimationName) => void;
  onFrameChange: (frame: number) => void;
  onFpsChange: (fps: number) => void;
  onTogglePlayback: () => void;
  onOnionSkinChange: (enabled: boolean) => void;
  onPreset: (preset: 'idle' | 'slash' | 'stab') => void;
}

export function Timeline({ project, isPlaying, onAnimationChange, onFrameChange, onFpsChange, onTogglePlayback, onOnionSkinChange, onPreset }: TimelineProps) {
  const animation = project.animations[project.activeAnimation];
  return (
    <section className="panel timeline">
      <div className="timelineTop">
        <h2>Animation</h2>
        <select value={project.activeAnimation} onChange={(e) => onAnimationChange(e.target.value as AnimationName)}>
          <option value="idle">idle</option>
          <option value="attack">attack</option>
          <option value="spell">spell placeholder</option>
        </select>
      </div>
      <div className="buttonRow wrap">
        <button onClick={() => onPreset('idle')}>6-frame idle bob</button>
        <button onClick={() => onPreset('slash')}>8-frame sword slash</button>
        <button onClick={() => onPreset('stab')}>8-frame stab</button>
      </div>
      <div className="playbackRow">
        <button onClick={() => onFrameChange(Math.max(0, project.activeFrame - 1))}>◀ Step</button>
        <button className="primary" onClick={onTogglePlayback}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={() => onFrameChange((project.activeFrame + 1) % animation.frames.length)}>Step ▶</button>
        <label>FPS <input type="number" min={1} max={60} value={project.settings.fps} onChange={(e) => onFpsChange(Number(e.target.value))} /></label>
        <label><input type="checkbox" checked={project.onionSkin} onChange={(e) => onOnionSkinChange(e.target.checked)} /> Onion skin</label>
      </div>
      <div className="frames">
        {animation.frames.map((frame) => (
          <button key={frame.index} className={frame.index === project.activeFrame ? 'frame active' : 'frame'} onClick={() => onFrameChange(frame.index)}>
            {frame.index + 1}
          </button>
        ))}
      </div>
    </section>
  );
}
