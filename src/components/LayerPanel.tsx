import { RigLayer } from '../types/rig';

interface LayerPanelProps {
  layers: RigLayer[];
  selectedLayerId?: string;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<RigLayer>) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
}

export function LayerPanel({ layers, selectedLayerId, onSelect, onPatch, onRemove, onReorder }: LayerPanelProps) {
  const selected = layers.find((layer) => layer.id === selectedLayerId);
  return (
    <section className="panel layerPanel">
      <h2>Layers</h2>
      <div className="layerList">
        {[...layers].reverse().map((layer) => (
          <button
            key={layer.id}
            className={layer.id === selectedLayerId ? 'layerItem active' : 'layerItem'}
            onClick={() => onSelect(layer.id)}
          >
            <span>{layer.visible ? '👁' : '🙈'} {layer.name}</span>
            <small>{Math.round(layer.x)}, {Math.round(layer.y)}</small>
          </button>
        ))}
      </div>
      {selected && (
        <div className="controls">
          <h3>Base Layer Setup</h3>
          <p className="hint">These persistent values are shared by idle, slash, stab, spell, and future animations.</p>
          <input value={selected.name} onChange={(e) => onPatch(selected.id, { name: e.target.value })} />
          <label><input type="checkbox" checked={selected.visible} onChange={(e) => onPatch(selected.id, { visible: e.target.checked })} /> Visible</label>
          <Range label="X" value={selected.x} min={-512} max={1536} step={1} onChange={(x) => onPatch(selected.id, { x })} />
          <Range label="Y" value={selected.y} min={-512} max={1536} step={1} onChange={(y) => onPatch(selected.id, { y })} />
          <Range label="Scale" value={selected.scale} min={0.05} max={4} step={0.01} onChange={(scale) => onPatch(selected.id, { scale })} />
          <Range label="Rotation" value={selected.rotation} min={-180} max={180} step={1} onChange={(rotation) => onPatch(selected.id, { rotation })} />
          <Range label="Opacity" value={selected.opacity} min={0} max={1} step={0.01} onChange={(opacity) => onPatch(selected.id, { opacity })} />
          <Range label="Pivot X" value={selected.pivotX} min={0} max={selected.width} step={1} onChange={(pivotX) => onPatch(selected.id, { pivotX })} />
          <Range label="Pivot Y" value={selected.pivotY} min={0} max={selected.height} step={1} onChange={(pivotY) => onPatch(selected.id, { pivotY })} />
          <div className="buttonRow">
            <button onClick={() => onReorder(selected.id, 1)}>Move Up</button>
            <button onClick={() => onReorder(selected.id, -1)}>Move Down</button>
            <button className="danger" onClick={() => onRemove(selected.id)}>Remove</button>
          </div>
        </div>
      )}
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
