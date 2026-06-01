import { ChangeEvent, PointerEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  addLayerToProject,
  applyIdlePreset,
  applySlashPreset,
  applyStabPreset,
  combineLayerWithOffset,
  createBlankProject,
  normalizeOffset,
  setActiveFrame,
  setFrameOffset,
} from './lib/animation';
import { drawProjectFrame, hitTestLayer } from './lib/canvasRender';
import { downloadBlob, exportGifPreview, exportPngStrip } from './lib/exportStrip';
import { exportProjectJson, importProjectJson } from './lib/projectFile';
import { AnimationName, BackgroundMode, LayerFrameOffset, RigLayer, RigProject } from './types/rig';

const PRESET_LABELS: Record<AnimationName, string> = {
  idle: 'Idle Bob',
  slash: 'Slash',
  stab: 'Stab',
  spell: 'Spell',
};

const withLayerOrder = (layers: RigLayer[]) => layers.map((layer, index) => ({ ...layer, order: index }));

const readFile = (file: File) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsDataURL(file);
});

const loadDimensions = (src: string) => new Promise<{ width: number; height: number }>((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ width: img.width, height: img.height });
  img.src = src;
});

const svgLayer = (name: string, width: number, height: number, body: string) => ({
  name,
  width,
  height,
  imageSrc: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${body}</svg>`)}`,
});

const DEMO_ASSETS = [
  svgLayer('Right Arm', 380, 170, '<defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#211b19"/><stop offset=".48" stop-color="#8f8171"/><stop offset="1" stop-color="#19191f"/></linearGradient></defs><g transform="rotate(-12 190 85)"><ellipse cx="180" cy="90" rx="150" ry="42" fill="url(#g)" stroke="#d2c2ad" stroke-width="5"/><circle cx="315" cy="86" r="38" fill="#2a2b35" stroke="#a28b72" stroke-width="5"/><path d="M46 80c72 12 168 8 256-18" fill="none" stroke="#fff" stroke-opacity=".26" stroke-width="10"/></g>'),
  svgLayer('Left Arm', 330, 150, '<defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#16171d"/><stop offset=".5" stop-color="#705d4d"/><stop offset="1" stop-color="#16171d"/></linearGradient></defs><g transform="rotate(-18 165 75)"><ellipse cx="160" cy="84" rx="128" ry="34" fill="url(#g)" stroke="#9d8b78" stroke-width="4"/><path d="M42 82c70 8 142 4 222-16" stroke="#f4e6d6" stroke-opacity=".18" stroke-width="8" fill="none"/></g>'),
  svgLayer('Sword', 520, 700, '<defs><linearGradient id="blade" x1="0" x2="1"><stop stop-color="#08172b"/><stop offset=".18" stop-color="#6fbfff"/><stop offset=".5" stop-color="#f9ffff"/><stop offset=".82" stop-color="#386fae"/><stop offset="1" stop-color="#061020"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g transform="translate(250 650) rotate(-25)"><path d="M0 0 L-34 -450 L0 -660 L34 -450 Z" fill="url(#blade)" stroke="#59b8ff" stroke-width="4" filter="url(#glow)"/><path d="M0 0 L0 -605" stroke="#fff" stroke-opacity=".62" stroke-width="5"/><rect x="-120" y="-18" width="240" height="36" rx="18" fill="#87612f" stroke="#e0b879" stroke-width="6"/><rect x="-20" y="-10" width="40" height="120" rx="18" fill="#4b2f20" stroke="#d4b28a" stroke-width="5"/><circle cx="0" cy="0" r="28" fill="#1868b9" stroke="#c5e8ff" stroke-width="5"/></g>'),
  svgLayer('Glow FX', 360, 360, '<defs><radialGradient id="r"><stop stop-color="#7ff7ff"/><stop offset=".35" stop-color="#0d86ff" stop-opacity=".7"/><stop offset="1" stop-color="#03152d" stop-opacity="0"/></radialGradient></defs><circle cx="180" cy="180" r="170" fill="url(#r)"/><path d="M180 42l28 100 98 38-100 28-26 108-34-106-92-34 96-35z" fill="#7df8ff" opacity=".75"/>'),
  svgLayer('Particles', 320, 320, '<g fill="#ff9e45"><circle cx="74" cy="86" r="5"/><circle cx="190" cy="70" r="3"/><circle cx="248" cy="170" r="4"/><circle cx="118" cy="236" r="3"/></g><g fill="#55e6ff"><circle cx="60" cy="180" r="3"/><circle cx="222" cy="250" r="4"/></g>'),
];

const createDemoProject = () => {
  let project = { ...createBlankProject(), name: 'Knight Slash', activeAnimation: 'slash' as AnimationName };
  const placements = [
    { x: 430, y: 665, scale: 1, rotation: -14, opacity: 1, pivotX: 250, pivotY: 85 },
    { x: 380, y: 690, scale: 0.92, rotation: -24, opacity: 1, pivotX: 245, pivotY: 82 },
    { x: 625, y: 545, scale: 0.86, rotation: 0, opacity: 1, pivotX: 250, pivotY: 650 },
    { x: 655, y: 300, scale: 0.62, rotation: 0, opacity: 0.6, pivotX: 180, pivotY: 180 },
    { x: 700, y: 410, scale: 0.7, rotation: 0, opacity: 0.9, pivotX: 160, pivotY: 160 },
  ];
  DEMO_ASSETS.forEach((asset, index) => {
    project = addLayerToProject(project, {
      id: crypto.randomUUID(),
      visible: true,
      order: index,
      ...asset,
      ...placements[index],
    });
  });
  return applySlashPreset(project);
};

function App() {
  const [project, setProject] = useState<RigProject>(() => createDemoProject());
  const [selectedLayerId, setSelectedLayerId] = useState<string | undefined>(() => undefined);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [message, setMessage] = useState('All changes saved');

  useEffect(() => {
    if (!selectedLayerId && project.layers[0]) setSelectedLayerId(project.layers[0].id);
  }, [project.layers, selectedLayerId]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = window.setInterval(() => {
      setProject((current) => {
        const animation = current.animations[current.activeAnimation];
        return setActiveFrame(current, (current.activeFrame + 1) % animation.frames.length);
      });
    }, 1000 / project.settings.fps);
    return () => window.clearInterval(interval);
  }, [isPlaying, project.settings.fps]);

  const patchLayer = (id: string, patch: Partial<RigLayer>) => {
    setProject((current) => ({ ...current, layers: current.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) }));
  };

  const patchFrameOffset = (id: string, patch: Partial<LayerFrameOffset>) => {
    setProject((current) => setFrameOffset(current, id, patch));
  };

  const moveBaseLayer = (id: string, dx: number, dy: number) => {
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === id ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer)),
    }));
  };

  const addLayer = (layer: RigLayer) => {
    setProject((current) => addLayerToProject(current, { ...layer, order: current.layers.length }));
    setSelectedLayerId(layer.id);
    setMessage(`Added ${layer.name}`);
  };

  const handleLayerFiles = async (files: FileList | null) => {
    const accepted = Array.from(files ?? []).filter((file) => file.type === 'image/png' || file.type === 'image/webp');
    for (const file of accepted) {
      const src = await readFile(file);
      const dimensions = await loadDimensions(src);
      addLayer({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.(png|webp)$/i, ''),
        imageSrc: src,
        visible: true,
        x: 512,
        y: 620,
        scale: 1,
        rotation: 0,
        opacity: 1,
        pivotX: dimensions.width / 2,
        pivotY: dimensions.height / 2,
        order: 0,
        width: dimensions.width,
        height: dimensions.height,
      });
    }
  };

  const reorderLayer = (id: string, direction: -1 | 1) => {
    setProject((current) => {
      const index = current.layers.findIndex((layer) => layer.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.layers.length) return current;
      const layers = [...current.layers];
      [layers[index], layers[nextIndex]] = [layers[nextIndex], layers[index]];
      return { ...current, layers: withLayerOrder(layers) };
    });
  };

  const changeAnimation = (name: AnimationName) => setProject((current) => ({ ...current, activeAnimation: name, activeFrame: 0 }));

  const applyPreset = (preset: 'idle' | 'slash' | 'stab') => {
    setProject((current) => {
      if (preset === 'idle') return applyIdlePreset(current);
      if (preset === 'slash') return applySlashPreset(current);
      return applyStabPreset(current);
    });
    setMessage(`${PRESET_LABELS[preset]} preset applied`);
  };

  const exportWithMessage = async (kind: 'strip' | 'gif' | 'json') => {
    try {
      if (kind === 'strip') downloadBlob(await exportPngStrip(project), `${project.activeAnimation}-strip.png`);
      if (kind === 'gif') downloadBlob(await exportGifPreview(project), `${project.activeAnimation}-preview.gif`);
      if (kind === 'json') downloadBlob(exportProjectJson(project), `${project.name}.json`);
      setMessage(`Exported ${kind}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.');
    }
  };

  const importJson = async (file: File) => {
    try {
      const imported = await importProjectJson(file);
      setProject(imported);
      setSelectedLayerId(imported.layers[0]?.id);
      setMessage(`Imported ${file.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    }
  };

  const animation = project.animations[project.activeAnimation];
  const durationSeconds = animation.frames.length / project.settings.fps;

  return (
    <main className="appShell">
      <TopToolbar
        project={project}
        message={message}
        onNameChange={(name) => setProject((current) => ({ ...current, name }))}
        onSave={() => exportWithMessage('json')}
        onImport={importJson}
        onExportStrip={() => exportWithMessage('strip')}
        onExportGif={() => exportWithMessage('gif')}
      />
      <div className="editorGrid" aria-label="Sprite rig editor workspace">
        <LeftSidebar
          layers={project.layers}
          selectedLayerId={selectedLayerId}
          onFiles={handleLayerFiles}
          onSelect={setSelectedLayerId}
          onPatch={patchLayer}
          onReorder={reorderLayer}
        />
        <PreviewWorkspace
          project={project}
          selectedLayerId={selectedLayerId}
          zoom={zoom}
          onZoom={setZoom}
          onSelectLayer={setSelectedLayerId}
          onMoveLayer={moveBaseLayer}
          onBackgroundMode={(backgroundMode) => setProject((current) => ({ ...current, backgroundMode }))}
        />
        <RightInspector
          project={project}
          selectedLayerId={selectedLayerId}
          onPatchLayer={patchLayer}
          onFrameOffsetPatch={patchFrameOffset}
          onFpsChange={(fps) => setProject((current) => ({ ...current, settings: { ...current.settings, fps: Math.max(1, fps || 1) } }))}
          onExportStrip={() => exportWithMessage('strip')}
        />
        <TimelineDock
          project={project}
          isPlaying={isPlaying}
          onTogglePlayback={() => setIsPlaying((playing) => !playing)}
          onFrameChange={(frame) => setProject((current) => setActiveFrame(current, frame))}
          onFpsChange={(fps) => setProject((current) => ({ ...current, settings: { ...current.settings, fps: Math.max(1, fps || 1) } }))}
          onOnionSkinChange={(onionSkin) => setProject((current) => ({ ...current, onionSkin }))}
          onPreset={applyPreset}
          onAnimationChange={changeAnimation}
          durationSeconds={durationSeconds}
        />
      </div>
    </main>
  );
}

function TopToolbar({ project, message, onNameChange, onSave, onImport, onExportStrip, onExportGif }: {
  project: RigProject;
  message: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onImport: (file: File) => void;
  onExportStrip: () => void;
  onExportGif: () => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onImport(file);
    event.target.value = '';
  };
  return (
    <header className="topToolbar">
      <div className="brand"><div className="brandMark">FPV</div><strong>FPV Sprite Rig Lab</strong></div>
      <label className="projectName"><span>Project</span><input value={project.name} onChange={(event) => onNameChange(event.target.value)} aria-label="Project name" /><span className="editIcon">✎</span></label>
      <div className="savedStatus">✓ <span>{message || 'All changes saved'}</span></div>
      <div className="toolbarActions">
        <button className="toolbarButton save" onClick={onSave}>▣ Save Project</button>
        <button className="toolbarButton" onClick={() => importRef.current?.click()}>↥ Import</button>
        <input ref={importRef} type="file" accept="application/json" onChange={handleImport} />
        <button className="toolbarButton" onClick={onExportStrip}>▧ Export PNG Strip</button>
        <button className="toolbarButton gif" onClick={onExportGif}><span>GIF</span> Export GIF</button>
        <button className="iconButton" aria-label="More options">⋮</button>
      </div>
    </header>
  );
}

function LeftSidebar({ layers, selectedLayerId, onFiles, onSelect, onPatch, onReorder }: {
  layers: RigLayer[];
  selectedLayerId?: string;
  onFiles: (files: FileList | null) => void;
  onSelect: (id: string) => void;
  onPatch: (id: string, patch: Partial<RigLayer>) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <aside className="leftSidebar editorPanel" aria-label="Assets and layers">
      <div className="panelTitle"><span>ASSETS &amp; LAYERS</span><div><button className="textIcon" onClick={() => fileRef.current?.click()}>＋</button><button className="textIcon">▱</button></div></div>
      <label className="uploadDrop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onFiles(event.dataTransfer.files); }}>
        <span className="uploadIcon">☁</span>
        <strong>Upload Assets</strong>
        <small>PNG / WebP / ZIP</small>
        <em>or drag and drop</em>
        <input ref={fileRef} type="file" accept="image/png,image/webp" multiple onChange={(event) => { onFiles(event.target.files); event.target.value = ''; }} />
      </label>
      <div className="layerHeader">LAYERS</div>
      <div className="premiumLayerList">
        {[...layers].reverse().map((layer) => (
          <div key={layer.id} className={layer.id === selectedLayerId ? 'premiumLayer active' : 'premiumLayer'} onClick={() => onSelect(layer.id)} role="button" tabIndex={0}>
            <button className="eyeButton" onClick={(event) => { event.stopPropagation(); onPatch(layer.id, { visible: !layer.visible }); }}>{layer.visible ? '◉' : '○'}</button>
            <img src={layer.imageSrc} alt="" />
            <span>{layer.name}</span>
            <div className="layerTools">
              <button onClick={(event) => { event.stopPropagation(); onReorder(layer.id, 1); }}>⌃</button>
              <button onClick={(event) => { event.stopPropagation(); onReorder(layer.id, -1); }}>⌄</button>
              <span>⋮⋮</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function PreviewWorkspace({ project, selectedLayerId, zoom, onZoom, onSelectLayer, onMoveLayer, onBackgroundMode }: {
  project: RigProject;
  selectedLayerId?: string;
  zoom: number;
  onZoom: (value: number) => void;
  onSelectLayer: (id: string) => void;
  onMoveLayer: (id: string, dx: number, dy: number) => void;
  onBackgroundMode: (mode: BackgroundMode) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; pointerId: number } | null>(null);
  const animation = project.animations[project.activeAnimation];
  const time = `${(project.activeFrame / project.settings.fps).toFixed(2)}s`;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = project.settings.frameWidth;
    canvas.height = project.settings.frameHeight;
    drawProjectFrame(ctx, project, { includeBackground: true, onionSkin: project.onionSkin }).catch(console.error);
  }, [project]);

  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * project.settings.frameWidth,
      y: ((event.clientY - rect.top) / rect.height) * project.settings.frameHeight,
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = canvasPoint(event);
    const frame = animation.frames[project.activeFrame];
    const hit = [...project.layers]
      .sort((a, b) => b.order - a.order)
      .find((layer) => hitTestLayer(combineLayerWithOffset(layer, frame?.layers[layer.id]), point.x, point.y));
    if (!hit) return;
    onSelectLayer(hit.id);
    setDrag({ id: hit.id, x: point.x, y: point.y, pointerId: event.pointerId });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const point = canvasPoint(event);
    onMoveLayer(drag.id, point.x - drag.x, point.y - drag.y);
    setDrag({ ...drag, x: point.x, y: point.y });
  };

  const finishDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
  };

  return (
    <section className="previewWorkspace editorPanel" aria-label="Live preview workspace">
      <div className="previewToggle">
        <button className="active" onClick={() => onBackgroundMode(project.backgroundMode === 'screenshot' ? 'checkerboard' : project.backgroundMode)}>▧ Preview</button>
        <button onClick={() => onBackgroundMode('checkerboard')}>▦ Checker</button>
      </div>
      <div className="previewUtilities"><button className="iconButton">⛶</button><button className="iconButton">↗</button></div>
      <div className="canvasFrame" style={{ width: `${Math.min(100, zoom)}%` }}>
        <canvas
          ref={canvasRef}
          className="stageCanvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          aria-label={selectedLayerId ? 'Drag selected artwork' : 'Sprite preview'}
        />
      </div>
      <div className="zoomDock"><button onClick={() => onZoom(Math.max(50, zoom - 10))}>−</button><span>{zoom}%</span><button onClick={() => onZoom(Math.min(100, zoom + 10))}>＋</button><button onClick={() => onZoom(100)}>⛶</button></div>
      <div className="frameReadout"><strong>Frame {project.activeFrame + 1} / {animation.frames.length}</strong><span>{time} / 00:{String(Math.floor(animation.frames.length / project.settings.fps)).padStart(2, '0')}.{String(Math.round(((animation.frames.length / project.settings.fps) % 1) * 100)).padStart(2, '0')}</span></div>
    </section>
  );
}

function RightInspector({ project, selectedLayerId, onPatchLayer, onFrameOffsetPatch, onFpsChange, onExportStrip }: {
  project: RigProject;
  selectedLayerId?: string;
  onPatchLayer: (id: string, patch: Partial<RigLayer>) => void;
  onFrameOffsetPatch: (id: string, patch: Partial<LayerFrameOffset>) => void;
  onFpsChange: (fps: number) => void;
  onExportStrip: () => void;
}) {
  const selected = project.layers.find((layer) => layer.id === selectedLayerId);
  const frame = project.animations[project.activeAnimation].frames[project.activeFrame];
  const offset = selectedLayerId ? normalizeOffset(frame.layers[selectedLayerId]) : undefined;
  return (
    <aside className="rightInspector" aria-label="Layer inspector">
      <InspectorCard title="BASE LAYER SETUP" icon="⌁">
        {selected ? (
          <>
            <SliderRow label="Pivot X" value={selected.pivotX} min={0} max={selected.width} step={1} display={(v) => (v / selected.width).toFixed(2)} onChange={(pivotX) => onPatchLayer(selected.id, { pivotX })} />
            <SliderRow label="Pivot Y" value={selected.pivotY} min={0} max={selected.height} step={1} display={(v) => (v / selected.height).toFixed(2)} onChange={(pivotY) => onPatchLayer(selected.id, { pivotY })} />
          </>
        ) : <p className="emptyHint">Select a layer to edit its pivot.</p>}
      </InspectorCard>
      <InspectorCard title="CURRENT FRAME OFFSET" icon="✣" accent="warm">
        {selected && offset ? (
          <>
            <SliderRow label="X" value={offset.dx} min={-512} max={512} step={1} unit=" px" onChange={(dx) => onFrameOffsetPatch(selected.id, { dx })} />
            <SliderRow label="Y" value={offset.dy} min={-512} max={512} step={1} unit=" px" onChange={(dy) => onFrameOffsetPatch(selected.id, { dy })} />
            <SliderRow label="Scale" value={offset.dScale} min={0.1} max={3} step={0.01} display={(v) => v.toFixed(2)} onChange={(dScale) => onFrameOffsetPatch(selected.id, { dScale })} />
            <SliderRow label="Rotation" value={offset.dRotation} min={-180} max={180} step={0.5} unit="°" onChange={(dRotation) => onFrameOffsetPatch(selected.id, { dRotation })} />
            <SliderRow label="Opacity" value={offset.dOpacity} min={0} max={1} step={0.01} display={(v) => `${Math.round(v * 100)} %`} onChange={(dOpacity) => onFrameOffsetPatch(selected.id, { dOpacity })} />
          </>
        ) : <p className="emptyHint">Select a layer to edit frame offsets.</p>}
      </InspectorCard>
      <InspectorCard title="ANIMATION" icon="❧">
        <div className="threeFields">
          <label>FPS<select value={project.settings.fps} onChange={(event) => onFpsChange(Number(event.target.value))}><option>8</option><option>12</option><option>24</option><option>30</option></select></label>
          <label>Loop<select><option>Loop</option><option>Once</option></select></label>
          <label>Play Mode<select><option>Forward</option><option>Ping Pong</option></select></label>
        </div>
      </InspectorCard>
      <InspectorCard title="EXPORT" icon="▧">
        <label className="fullField">Output Size<select><option>Automatic (Canvas)</option><option>1024 × 1024</option><option>512 × 512</option></select></label>
        <SliderRow label="Padding" value={2} min={0} max={32} step={1} unit=" px" onChange={() => undefined} />
        <label className="checkLine"><input type="checkbox" defaultChecked /> Trim Transparent Pixels</label>
        <div className="exportRow"><button className="primaryExport" onClick={onExportStrip}>▧ Export PNG Strip (1x)</button><button className="iconButton">⚙</button></div>
      </InspectorCard>
    </aside>
  );
}

function InspectorCard({ title, icon, accent, children }: { title: string; icon: string; accent?: 'warm'; children: ReactNode }) {
  return <section className={accent === 'warm' ? 'inspectorCard warm' : 'inspectorCard'}><h2><span>{icon}</span>{title}<button>⌃</button></h2><div className="cardBody">{children}</div></section>;
}

function SliderRow({ label, value, min, max, step, unit = '', display, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; display?: (value: number) => string; onChange: (value: number) => void }) {
  const shown = display ? display(value) : `${Number(value).toFixed(step < 1 ? 1 : 0)}${unit}`;
  return (
    <label className="sliderRow"><span>{label}</span><input type="range" value={value} min={min} max={max} step={step} onInput={(event) => onChange(Number(event.currentTarget.value))} /><input className="numberPill" value={shown} onChange={(event) => onChange(Number(event.currentTarget.value.replace(/[^\d.-]/g, '')))} /></label>
  );
}

function TimelineDock({ project, isPlaying, onTogglePlayback, onFrameChange, onFpsChange, onOnionSkinChange, onPreset, onAnimationChange, durationSeconds }: {
  project: RigProject;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onFrameChange: (frame: number) => void;
  onFpsChange: (fps: number) => void;
  onOnionSkinChange: (enabled: boolean) => void;
  onPreset: (preset: 'idle' | 'slash' | 'stab') => void;
  onAnimationChange: (name: AnimationName) => void;
  durationSeconds: number;
}) {
  const animation = project.animations[project.activeAnimation];
  return (
    <section className="timelineDock editorPanel" aria-label="Animation timeline">
      <div className="timelineBar">
        <strong>ANIMATION TIMELINE</strong>
        <button className="playButton" onClick={onTogglePlayback}>{isPlaying ? '❚❚' : '▶'}</button>
        <button className="iconButton" onClick={() => onFrameChange(0)}>↻</button>
        <label className="compactSelect">FPS<select value={project.settings.fps} onChange={(event) => onFpsChange(Number(event.target.value))}><option>8</option><option>12</option><option>24</option><option>30</option></select></label>
        <label className="toggleLabel">Onion Skin<input type="checkbox" checked={project.onionSkin} onChange={(event) => onOnionSkinChange(event.target.checked)} /><span /></label>
        <button className="iconButton">⚙</button>
        <div className="presetGroup"><span>PRESETS</span><button onClick={() => { onAnimationChange('idle'); onPreset('idle'); }}>Idle Bob</button><button className={project.activeAnimation === 'slash' ? 'active' : ''} onClick={() => { onAnimationChange('slash'); onPreset('slash'); }}>Slash</button><button onClick={() => { onAnimationChange('stab'); onPreset('stab'); }}>Stab</button><button>＋</button><button>⋮</button></div>
      </div>
      <div className="frameStrip"><button className="stripArrow">‹</button>{animation.frames.map((frame) => <FrameThumb key={frame.index} project={project} index={frame.index} active={frame.index === project.activeFrame} onClick={() => onFrameChange(frame.index)} />)}<button className="stripArrow">›</button></div>
      <div className="scrubTrack"><span style={{ width: `${((project.activeFrame + 1) / animation.frames.length) * 100}%` }} /></div>
      <div className="timelineStatus"><span>Canvas: {project.settings.frameWidth} x {project.settings.frameHeight}</span><span>Total Frames: {animation.frames.length}</span><span>Duration: 00:00.{String(Math.round(durationSeconds * 100)).padStart(2, '0')}</span></div>
    </section>
  );
}

function FrameThumb({ project, index, active, onClick }: { project: RigProject; index: number; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = project.settings.frameWidth;
    canvas.height = project.settings.frameHeight;
    drawProjectFrame(ctx, project, { includeBackground: true, frameIndex: index }).catch(console.error);
  }, [project, index]);
  return <button className={active ? 'frameCard active' : 'frameCard'} onClick={onClick}><span className="frameNumber">{index + 1}</span>{active && <span className="frameDots">⋮</span>}<canvas ref={ref} /><small>{Math.round(1000 / project.settings.fps)}ms</small></button>;
}

export default App;
