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
    <section className="timelineDock panel" aria-label="Animation timeline">
      <div className="timelineMeta">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>{project.activeAnimation} · frame {project.activeFrame + 1}</h2>
        </div>
        <label className="timelineSelect">
          <span>Animation</span>
          <select value={project.activeAnimation} onChange={(e) => onAnimationChange(e.target.value as AnimationName)}>
            <option value="idle">Idle</option>
            <option value="slash">Slash</option>
            <option value="stab">Stab</option>
            <option value="spell">Spell</option>
          </select>
        </label>
      </div>
      <div className="timelineControls">
        <button onClick={() => onFrameChange(Math.max(0, project.activeFrame - 1))}>◀</button>
        <button className="primary" onClick={onTogglePlayback}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={() => onFrameChange((project.activeFrame + 1) % animation.frames.length)}>▶</button>
        <label className="fpsControl">FPS <input type="number" min={1} max={60} value={project.settings.fps} onChange={(e) => onFpsChange(Number(e.target.value))} /></label>
        <label className="checkControl"><input type="checkbox" checked={project.onionSkin} onChange={(e) => onOnionSkinChange(e.target.checked)} /> Onion</label>
      </div>
      <div className="frames timelineFrames" aria-label="Animation frames">
        {animation.frames.map((frameButton) => (
          <button key={frameButton.index} className={frameButton.index === project.activeFrame ? 'frame active' : 'frame'} onClick={() => onFrameChange(frameButton.index)}>
            {frameButton.index + 1}
          </button>
        ))}
      </div>
      <div className="timelinePresets" aria-label="Animation presets">
        <button onClick={() => onPreset('idle')}>Idle preset</button>
        <button onClick={() => onPreset('slash')}>Slash preset</button>
        <button onClick={() => onPreset('stab')}>Stab preset</button>
      </div>
    </section>
  );
}
