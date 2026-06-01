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
    <details className="panel controlSection timeline" open>
      <summary className="panelSummary"><span>Animation</span><small>{project.activeAnimation} · frame {project.activeFrame + 1}</small></summary>
      <div className="panelBody">
        <div className="timelineTop">
          <label className="fieldLabel">
            Animation preset
            <select value={project.activeAnimation} onChange={(e) => onAnimationChange(e.target.value as AnimationName)}>
              <option value="idle">Idle</option>
              <option value="slash">Slash</option>
              <option value="stab">Stab</option>
              <option value="spell">Spell placeholder</option>
            </select>
          </label>
        </div>
        <div className="buttonRow wrap presetRow">
          <button onClick={() => onPreset('idle')}>6-frame idle bob</button>
          <button onClick={() => onPreset('slash')}>8-frame sword slash</button>
          <button onClick={() => onPreset('stab')}>8-frame stab</button>
        </div>
        <div className="playbackRow">
          <button onClick={() => onFrameChange(Math.max(0, project.activeFrame - 1))}>◀ Step</button>
          <button className="primary" onClick={onTogglePlayback}>{isPlaying ? 'Pause' : 'Play'}</button>
          <button onClick={() => onFrameChange((project.activeFrame + 1) % animation.frames.length)}>Step ▶</button>
          <label className="fpsControl">FPS <input type="number" min={1} max={60} value={project.settings.fps} onChange={(e) => onFpsChange(Number(e.target.value))} /></label>
          <label className="checkControl"><input type="checkbox" checked={project.onionSkin} onChange={(e) => onOnionSkinChange(e.target.checked)} /> Onion skin</label>
        </div>
        <div className="frames" aria-label="Animation frames">
          {animation.frames.map((frameButton) => (
            <button key={frameButton.index} className={frameButton.index === project.activeFrame ? 'frame active' : 'frame'} onClick={() => onFrameChange(frameButton.index)}>
              {frameButton.index + 1}
            </button>
          ))}
        </div>
        <details className="nestedSection frameOffsetPanel" open>
          <summary className="nestedSummary">Current Frame Offset</summary>
          <p className="hint compact">Offsets are relative to the selected layer base pose.</p>
          {selectedLayer && selectedOffset ? (
            <div className="offsetGrid">
              <Range label="dx" value={selectedOffset.dx} min={-512} max={512} step={1} onChange={(dx) => onFrameOffsetPatch(selectedLayer.id, { dx })} />
              <Range label="dy" value={selectedOffset.dy} min={-512} max={512} step={1} onChange={(dy) => onFrameOffsetPatch(selectedLayer.id, { dy })} />
              <Range label="dScale" value={selectedOffset.dScale} min={0.1} max={3} step={0.01} onChange={(dScale) => onFrameOffsetPatch(selectedLayer.id, { dScale })} />
              <Range label="dRotation" value={selectedOffset.dRotation} min={-180} max={180} step={1} onChange={(dRotation) => onFrameOffsetPatch(selectedLayer.id, { dRotation })} />
              <Range label="dOpacity" value={selectedOffset.dOpacity} min={0} max={1} step={0.01} onChange={(dOpacity) => onFrameOffsetPatch(selectedLayer.id, { dOpacity })} />
            </div>
          ) : (
            <p className="hint compact">Select a layer to edit its per-frame animation offset.</p>
          )}
        </details>
      </div>
    </details>
  );
}

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="rangeControl">
      <span>{label}: <b>{Number(value).toFixed(step < 1 ? 2 : 0)}</b></span>
      <input type="range" value={value} min={min} max={max} step={step} onInput={(e) => onChange(Number(e.currentTarget.value))} />
    </label>
  );
}
