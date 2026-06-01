import { LayerFrameOffset, AnimationName, RigProject } from '../types/rig';
import { normalizeOffset } from '../lib/animation';

interface TimelineProps {
  project: RigProject;
  selectedLayerId?: string;
  isPlaying: boolean;
  onAnimationChange: (name: AnimationName) => void;
  onFrameChange: (frame: number) => void;
  onFrameOffsetPatch: (id: string, patch: Partial<LayerFrameOffset>) => void;
  onFpsChange: (fps: number) => void;
  onTogglePlayback: () => void;
  onOnionSkinChange: (enabled: boolean) => void;
  onPreset: (preset: 'idle' | 'slash' | 'stab') => void;
}

export function Timeline({ project, selectedLayerId, isPlaying, onAnimationChange, onFrameChange, onFrameOffsetPatch, onFpsChange, onTogglePlayback, onOnionSkinChange, onPreset }: TimelineProps) {
  const animation = project.animations[project.activeAnimation];
  const frame = animation.frames[project.activeFrame] ?? animation.frames[0];
  const selectedLayer = project.layers.find((layer) => layer.id === selectedLayerId);
  const selectedOffset = selectedLayerId ? normalizeOffset(frame.layers[selectedLayerId]) : undefined;

  return (
    <section className="panel timeline">
      <div className="timelineTop">
        <h2>Animation</h2>
        <select value={project.activeAnimation} onChange={(e) => onAnimationChange(e.target.value as AnimationName)}>
          <option value="idle">Idle</option>
          <option value="slash">Slash</option>
          <option value="stab">Stab</option>
          <option value="spell">Spell placeholder</option>
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
        {animation.frames.map((frameButton) => (
          <button key={frameButton.index} className={frameButton.index === project.activeFrame ? 'frame active' : 'frame'} onClick={() => onFrameChange(frameButton.index)}>
            {frameButton.index + 1}
          </button>
        ))}
      </div>
      <div className="frameOffsetPanel">
        <h3>Current Frame Offset</h3>
        <p className="hint">Offsets are relative to the selected layer base pose. Neutral is dx 0, dy 0, dScale 1, dRotation 0, dOpacity 1.</p>
        {selectedLayer && selectedOffset ? (
          <div className="offsetGrid">
            <Range label="dx" value={selectedOffset.dx} min={-512} max={512} step={1} onChange={(dx) => onFrameOffsetPatch(selectedLayer.id, { dx })} />
            <Range label="dy" value={selectedOffset.dy} min={-512} max={512} step={1} onChange={(dy) => onFrameOffsetPatch(selectedLayer.id, { dy })} />
            <Range label="dScale" value={selectedOffset.dScale} min={0.1} max={3} step={0.01} onChange={(dScale) => onFrameOffsetPatch(selectedLayer.id, { dScale })} />
            <Range label="dRotation" value={selectedOffset.dRotation} min={-180} max={180} step={1} onChange={(dRotation) => onFrameOffsetPatch(selectedLayer.id, { dRotation })} />
            <Range label="dOpacity" value={selectedOffset.dOpacity} min={0} max={1} step={0.01} onChange={(dOpacity) => onFrameOffsetPatch(selectedLayer.id, { dOpacity })} />
          </div>
        ) : (
          <p className="hint">Select a layer to edit its per-frame animation offset.</p>
        )}
      </div>
    </section>
  );
}

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="rangeControl">
      <span>{label}: <b>{Number(value).toFixed(step < 1 ? 2 : 0)}</b></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
