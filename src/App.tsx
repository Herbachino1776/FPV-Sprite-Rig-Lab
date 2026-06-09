import { ChangeEvent, useEffect, useState } from 'react';
import { AssetUploader } from './components/AssetUploader';
import { CanvasStage } from './components/CanvasStage';
import { Timeline } from './components/Timeline';
import {
  addLayerToProject,
  applyIdlePreset,
  applySlashPreset,
  applyStabPreset,
  createBlankProject,
  createNeutralOffset,
  normalizeOffset,
  removeLayerFromProject,
  setActiveFrame,
  setFrameOffset,
} from './lib/animation';
import { downloadBlob, exportGifPreview, exportPngStrip } from './lib/exportStrip';
import { exportProjectJson, importProjectJson } from './lib/projectFile';
import { AnimationName, BackgroundMode, LayerAttachment, LayerFrameOffset, RigLayer, RigProject } from './types/rig';
import { canAttachLayer, createAttachmentFromCurrentPlacement } from './lib/layerTransforms';

const withLayerOrder = (layers: RigLayer[]) => layers.map((layer, index) => ({ ...layer, order: index }));

type InspectorTab = 'assets' | 'base' | 'attachment' | 'offset' | 'animation' | 'export';

const inspectorTabs: Array<{ id: InspectorTab; label: string; shortLabel: string }> = [
  { id: 'assets', label: 'Assets / Layers', shortLabel: 'Assets' },
  { id: 'base', label: 'Base Layer Setup', shortLabel: 'Base' },
  { id: 'attachment', label: 'Attachment', shortLabel: 'Attach' },
  { id: 'offset', label: 'Frame Offset', shortLabel: 'Offset' },
  { id: 'animation', label: 'Animation', shortLabel: 'Anim' },
  { id: 'export', label: 'Export', shortLabel: 'Export' },
];

function App() {
  const [project, setProject] = useState<RigProject>(() => createBlankProject());
  const [selectedLayerId, setSelectedLayerId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<InspectorTab>('assets');
  const [message, setMessage] = useState('Ready. Upload transparent PNG layers to begin.');

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
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)),
    }));
  };

  const patchFrameOffset = (id: string, patch: Partial<LayerFrameOffset>) => {
    setProject((current) => setFrameOffset(current, id, patch));
  };

  const moveBaseLayer = (id: string, dx: number, dy: number) => {
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) => {
        if (layer.id !== id) return layer;
        if (layer.attachment) {
          return { ...layer, attachment: { ...layer.attachment, localX: layer.attachment.localX + dx, localY: layer.attachment.localY + dy } };
        }
        return { ...layer, x: layer.x + dx, y: layer.y + dy };
      }),
    }));
  };

  const attachLayer = (childId: string, parentId: string) => {
    setProject((current) => {
      const attachment = createAttachmentFromCurrentPlacement(current, childId, parentId);
      if (!attachment) return current;
      return {
        ...current,
        layers: current.layers.map((layer) => (layer.id === childId ? { ...layer, attachment } : layer)),
        animations: Object.fromEntries(
          Object.entries(current.animations).map(([name, animation]) => [
            name,
            {
              ...animation,
              frames: animation.frames.map((frame) => ({
                ...frame,
                layers: { ...frame.layers, [childId]: createNeutralOffset() },
              })),
            },
          ]),
        ) as RigProject['animations'],
      };
    });
  };

  const detachLayer = (id: string) => {
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === id ? { ...layer, attachment: undefined } : layer)),
    }));
  };

  const patchAttachment = (id: string, patch: Partial<LayerAttachment>) => {
    setProject((current) => ({
      ...current,
      layers: current.layers.map((layer) => (layer.id === id && layer.attachment ? { ...layer, attachment: { ...layer.attachment, ...patch } } : layer)),
    }));
  };

  const resetAttachmentOffset = (id: string) => {
    patchAttachment(id, { localX: 0, localY: 0, localScale: 1, localRotation: 0 });
  };

  const addLayer = (layer: RigLayer) => {
    setProject((current) => addLayerToProject(current, { ...layer, order: current.layers.length }));
    setSelectedLayerId(layer.id);
    setActiveTab('assets');
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

  const changeAnimation = (name: AnimationName) => {
    setProject((current) => ({ ...current, activeAnimation: name, activeFrame: 0 }));
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

  const selectedLayer = project.layers.find((layer) => layer.id === selectedLayerId);

  return (
    <main className="appShell">
      <TopToolbar
        project={project}
        message={message}
        onNameChange={(name) => setProject((current) => ({ ...current, name }))}
        onAnimationChange={changeAnimation}
        onBackgroundMode={(backgroundMode) => setProject((current) => ({ ...current, backgroundMode }))}
        onProjectImport={importJson}
        onExportStrip={() => exportWithMessage('strip')}
        onExportGif={() => exportWithMessage('gif')}
        onExportJson={() => exportWithMessage('json')}
      />
      <div className="editorLayout" aria-label="Sprite rig editor workspace">
        <section className="centerColumn" aria-label="Centered preview and animation timeline">
          <CanvasStage
            project={project}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onMoveLayer={moveBaseLayer}
          />
          <Timeline
            project={project}
            isPlaying={isPlaying}
            onAnimationChange={changeAnimation}
            onFrameChange={(frame) => setProject((current) => setActiveFrame(current, frame))}
            onFpsChange={(fps) => setProject((current) => ({ ...current, settings: { ...current.settings, fps: Math.max(1, fps || 1) } }))}
            onTogglePlayback={() => setIsPlaying((playing) => !playing)}
            onOnionSkinChange={(onionSkin) => setProject((current) => ({ ...current, onionSkin }))}
            onPreset={(preset) => setProject((current) => preset === 'idle' ? applyIdlePreset(current) : preset === 'slash' ? applySlashPreset(current) : applyStabPreset(current))}
          />
        </section>
        <InspectorPanel
          project={project}
          selectedLayer={selectedLayer}
          selectedLayerId={selectedLayerId}
          activeTab={activeTab}
          isPlaying={isPlaying}
          onTabChange={setActiveTab}
          onAddLayer={addLayer}
          onBackgroundUpload={(src) => setProject((p) => ({ ...p, backgroundImageSrc: src, backgroundMode: 'screenshot' }))}
          onSelectLayer={(id) => {
            setSelectedLayerId(id);
            setActiveTab('base');
          }}
          onPatchLayer={patchLayer}
          onRemoveLayer={(id) => {
            setProject((current) => removeLayerFromProject(current, id));
            if (id === selectedLayerId) setSelectedLayerId(undefined);
          }}
          onReorderLayer={reorderLayer}
          onFrameOffsetPatch={patchFrameOffset}
          onAttachLayer={attachLayer}
          onDetachLayer={detachLayer}
          onAttachmentPatch={patchAttachment}
          onAttachmentReset={resetAttachmentOffset}
          onAnimationChange={changeAnimation}
          onFrameChange={(frame) => setProject((current) => setActiveFrame(current, frame))}
          onFpsChange={(fps) => setProject((current) => ({ ...current, settings: { ...current.settings, fps: Math.max(1, fps || 1) } }))}
          onTogglePlayback={() => setIsPlaying((playing) => !playing)}
          onOnionSkinChange={(onionSkin) => setProject((current) => ({ ...current, onionSkin }))}
          onPreset={(preset) => setProject((current) => preset === 'idle' ? applyIdlePreset(current) : preset === 'slash' ? applySlashPreset(current) : applyStabPreset(current))}
          onBackgroundMode={(backgroundMode) => setProject((current) => ({ ...current, backgroundMode }))}
          onProjectImport={importJson}
          onExportStrip={() => exportWithMessage('strip')}
          onExportGif={() => exportWithMessage('gif')}
          onExportJson={() => exportWithMessage('json')}
        />
      </div>
    </main>
  );
}

interface TopToolbarProps {
  project: RigProject;
  message: string;
  onNameChange: (name: string) => void;
  onAnimationChange: (name: AnimationName) => void;
  onBackgroundMode: (mode: BackgroundMode) => void;
  onProjectImport: (file: File) => void;
  onExportStrip: () => void;
  onExportGif: () => void;
  onExportJson: () => void;
}

function TopToolbar({ project, message, onNameChange, onAnimationChange, onBackgroundMode, onProjectImport, onExportStrip, onExportGif, onExportJson }: TopToolbarProps) {
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onProjectImport(file);
    event.target.value = '';
  };

  return (
    <header className="topToolbar" aria-label="Project toolbar">
      <div className="brandCluster">
        <p className="eyebrow">Browser-only sprite rigging tool</p>
        <h1>FPV Sprite Rig Lab</h1>
      </div>
      <label className="toolbarField projectNameField">
        <span>Project</span>
        <input value={project.name} onChange={(e) => onNameChange(e.target.value)} />
      </label>
      <label className="toolbarField compactField">
        <span>Animation</span>
        <select value={project.activeAnimation} onChange={(e) => onAnimationChange(e.target.value as AnimationName)}>
          <option value="idle">Idle</option>
          <option value="slash">Slash</option>
          <option value="stab">Stab</option>
          <option value="spell">Spell</option>
        </select>
      </label>
      <label className="toolbarField compactField">
        <span>Background</span>
        <select value={project.backgroundMode} onChange={(e) => onBackgroundMode(e.target.value as BackgroundMode)}>
          <option value="transparent">Transparent</option>
          <option value="black">Black</option>
          <option value="gray">Gray</option>
          <option value="checkerboard">Checker</option>
          <option value="screenshot">Screenshot</option>
        </select>
      </label>
      <div className="toolbarActions" aria-label="Project actions">
        <button onClick={onExportJson}>Save project</button>
        <label className="toolbarImport">Import<input type="file" accept="application/json" onChange={handleImport} /></label>
        <button className="primary" onClick={onExportStrip}>Export PNG</button>
        <button onClick={onExportGif}>Export GIF</button>
      </div>
      <div className="status" aria-live="polite">{message}</div>
    </header>
  );
}

interface InspectorPanelProps {
  project: RigProject;
  selectedLayer?: RigLayer;
  selectedLayerId?: string;
  activeTab: InspectorTab;
  isPlaying: boolean;
  onTabChange: (tab: InspectorTab) => void;
  onAddLayer: (layer: RigLayer) => void;
  onBackgroundUpload: (src: string) => void;
  onSelectLayer: (id: string) => void;
  onPatchLayer: (id: string, patch: Partial<RigLayer>) => void;
  onRemoveLayer: (id: string) => void;
  onReorderLayer: (id: string, direction: -1 | 1) => void;
  onFrameOffsetPatch: (id: string, patch: Partial<LayerFrameOffset>) => void;
  onAttachLayer: (childId: string, parentId: string) => void;
  onDetachLayer: (id: string) => void;
  onAttachmentPatch: (id: string, patch: Partial<LayerAttachment>) => void;
  onAttachmentReset: (id: string) => void;
  onAnimationChange: (name: AnimationName) => void;
  onFrameChange: (frame: number) => void;
  onFpsChange: (fps: number) => void;
  onTogglePlayback: () => void;
  onOnionSkinChange: (enabled: boolean) => void;
  onPreset: (preset: 'idle' | 'slash' | 'stab') => void;
  onBackgroundMode: (mode: BackgroundMode) => void;
  onProjectImport: (file: File) => void;
  onExportStrip: () => void;
  onExportGif: () => void;
  onExportJson: () => void;
}

function InspectorPanel(props: InspectorPanelProps) {
  const { selectedLayer, activeTab, onTabChange } = props;
  const activeLabel = inspectorTabs.find((tab) => tab.id === activeTab)?.label;

  return (
    <aside className="inspectorPanel panel" aria-label="Tabbed editor inspector">
      <div className="inspectorHeader">
        <div>
          <p className="eyebrow">Inspector</p>
          <h2>{activeLabel}</h2>
        </div>
        <span>{selectedLayer ? selectedLayer.name : 'No layer selected'}</span>
      </div>
      <nav className="inspectorTabs" aria-label="Inspector sections">
        {inspectorTabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'tabButton active' : 'tabButton'}
            onClick={() => onTabChange(tab.id)}
            aria-pressed={activeTab === tab.id}
          >
            <span className="wideLabel">{tab.label}</span>
            <span className="shortLabel">{tab.shortLabel}</span>
          </button>
        ))}
      </nav>
      <div className="inspectorBody">
        {activeTab === 'assets' && <AssetsSection {...props} />}
        {activeTab === 'base' && <BaseLayerSection {...props} />}
        {activeTab === 'attachment' && <AttachmentSection {...props} />}
        {activeTab === 'offset' && <FrameOffsetSection {...props} />}
        {activeTab === 'animation' && <AnimationSection {...props} />}
        {activeTab === 'export' && <ExportSection {...props} />}
      </div>
    </aside>
  );
}

function AssetsSection({ project, selectedLayerId, onAddLayer, onBackgroundUpload, onSelectLayer, onPatchLayer, onRemoveLayer, onReorderLayer }: InspectorPanelProps) {
  const selected = project.layers.find((layer) => layer.id === selectedLayerId);

  return (
    <section className="tabSection" aria-label="Assets and layers">
      <AssetUploader onAddLayer={onAddLayer} onBackgroundUpload={onBackgroundUpload} />
      <div className="sectionCard">
        <div className="sectionTitle">
          <h3>Layer stack</h3>
          <small>{project.layers.length || 'No'} active layer{project.layers.length === 1 ? '' : 's'}</small>
        </div>
        <div className="layerList">
          {[...project.layers].reverse().map((layer) => (
            <button
              key={layer.id}
              className={layer.id === selectedLayerId ? 'layerItem active' : 'layerItem'}
              onClick={() => onSelectLayer(layer.id)}
            >
              <span>{layer.visible ? '👁' : '🙈'} {layer.name}</span>
              <small>{Math.round(layer.x)}, {Math.round(layer.y)}</small>
            </button>
          ))}
        </div>
        {selected ? (
          <div className="quickLayerActions">
            <label className="checkControl"><input type="checkbox" checked={selected.visible} onChange={(e) => onPatchLayer(selected.id, { visible: e.target.checked })} /> Visible</label>
            <button onClick={() => onReorderLayer(selected.id, 1)}>Move Up</button>
            <button onClick={() => onReorderLayer(selected.id, -1)}>Move Down</button>
            <button className="danger" onClick={() => onRemoveLayer(selected.id)}>Remove</button>
          </div>
        ) : (
          <p className="hint compact">Upload or select a PNG layer to edit the rig.</p>
        )}
      </div>
    </section>
  );
}

function BaseLayerSection({ selectedLayer, onPatchLayer, onReorderLayer, onRemoveLayer }: InspectorPanelProps) {
  if (!selectedLayer) {
    return <EmptyState title="Select a layer" copy="Choose a layer from Assets / Layers to edit persistent base transforms shared by every animation." />;
  }

  return (
    <section className="tabSection" aria-label="Persistent base layer setup">
      <div className="sectionCard">
        <div className="sectionTitle">
          <h3>Persistent base pose</h3>
          <small>Shared across animations</small>
        </div>
        <p className="hint compact">These values are the stable rig pose. Animation offsets stay relative to this base so switching animations does not destroy positioning work.</p>
        <input aria-label="Layer name" value={selectedLayer.name} onChange={(e) => onPatchLayer(selectedLayer.id, { name: e.target.value })} />
        <label className="checkControl"><input type="checkbox" checked={selectedLayer.visible} onChange={(e) => onPatchLayer(selectedLayer.id, { visible: e.target.checked })} /> Visible</label>
        {selectedLayer.attachment && <p className="hint compact lockHint">Locked to a parent layer. Base transform stays available, but stage dragging and Attachment Offset controls adjust the held weapon placement.</p>}
        <div className="rangeGrid">
          <Range label="X" value={selectedLayer.x} min={-512} max={1536} step={1} onChange={(x) => onPatchLayer(selectedLayer.id, { x })} />
          <Range label="Y" value={selectedLayer.y} min={-512} max={1536} step={1} onChange={(y) => onPatchLayer(selectedLayer.id, { y })} />
          <Range label="Scale" value={selectedLayer.scale} min={0.05} max={4} step={0.01} onChange={(scale) => onPatchLayer(selectedLayer.id, { scale })} />
          <Range label="Rotation" value={selectedLayer.rotation} min={-180} max={180} step={1} onChange={(rotation) => onPatchLayer(selectedLayer.id, { rotation })} />
          <Range label="Opacity" value={selectedLayer.opacity} min={0} max={1} step={0.01} onChange={(opacity) => onPatchLayer(selectedLayer.id, { opacity })} />
          <Range label="Pivot X" value={selectedLayer.pivotX} min={0} max={selectedLayer.width} step={1} onChange={(pivotX) => onPatchLayer(selectedLayer.id, { pivotX })} />
          <Range label="Pivot Y" value={selectedLayer.pivotY} min={0} max={selectedLayer.height} step={1} onChange={(pivotY) => onPatchLayer(selectedLayer.id, { pivotY })} />
        </div>
        <div className="buttonRow wrap">
          <button onClick={() => onReorderLayer(selectedLayer.id, 1)}>Move Up</button>
          <button onClick={() => onReorderLayer(selectedLayer.id, -1)}>Move Down</button>
          <button className="danger" onClick={() => onRemoveLayer(selectedLayer.id)}>Remove</button>
        </div>
      </div>
    </section>
  );
}


function AttachmentSection({ project, selectedLayer, onAttachLayer, onDetachLayer, onAttachmentPatch, onAttachmentReset }: InspectorPanelProps) {
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    if (selectedLayer?.attachment?.parentLayerId) {
      setParentId(selectedLayer.attachment.parentLayerId);
      return;
    }
    setParentId('');
  }, [selectedLayer?.id, selectedLayer?.attachment?.parentLayerId]);

  if (!selectedLayer) {
    return <EmptyState title="Select a layer" copy="Choose a weapon or hand layer before creating a parent/child attachment." />;
  }

  const attachedParent = project.layers.find((layer) => layer.id === selectedLayer.attachment?.parentLayerId);
  const parentOptions = project.layers
    .filter((layer) => layer.visible && canAttachLayer(project.layers, selectedLayer.id, layer.id))
    .sort((a, b) => {
      const priority = (name: string) => {
        const normalized = name.toLowerCase();
        if (normalized.includes('right hand')) return 0;
        if (normalized.includes('left hand')) return 1;
        if (normalized.includes('right arm')) return 2;
        if (normalized.includes('left arm')) return 3;
        return 4;
      };
      return priority(a.name) - priority(b.name) || a.order - b.order;
    });
  const effectiveParentId = parentId || selectedLayer.attachment?.parentLayerId || '';

  return (
    <section className="tabSection" aria-label="Layer attachment controls">
      <div className="sectionCard">
        <div className="sectionTitle">
          <h3>Attachment</h3>
          <small>{selectedLayer.attachment && attachedParent ? `Attached to: ${attachedParent.name}` : 'No parent'}</small>
        </div>
        <p className="hint compact">Lock weapons to a hand or arm. Use “Set Grip From Current Placement” after positioning the weapon so its current grip becomes the local hand offset.</p>
        <label className="fieldLabel">
          Attach To
          <select value={effectiveParentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">None</option>
            {parentOptions.map((layer) => (
              <option key={layer.id} value={layer.id}>{layer.name}</option>
            ))}
          </select>
        </label>
        {selectedLayer.attachment && attachedParent && <p className="attachedBadge">Attached to: {attachedParent.name}</p>}
        <div className="buttonRow wrap">
          <button className="primary" disabled={!effectiveParentId} onClick={() => effectiveParentId && onAttachLayer(selectedLayer.id, effectiveParentId)}>Attach to Selected Parent</button>
          <button disabled={!effectiveParentId} onClick={() => effectiveParentId && onAttachLayer(selectedLayer.id, effectiveParentId)}>Set Grip From Current Placement</button>
          <button onClick={() => onAttachmentReset(selectedLayer.id)} disabled={!selectedLayer.attachment}>Reset Local Offset</button>
          <button className="danger" onClick={() => onDetachLayer(selectedLayer.id)} disabled={!selectedLayer.attachment}>Detach</button>
        </div>
        {selectedLayer.attachment ? (
          <>
            <div className="rangeGrid">
              <Range label="Local X" value={selectedLayer.attachment.localX} min={-512} max={512} step={1} onChange={(localX) => onAttachmentPatch(selectedLayer.id, { localX })} />
              <Range label="Local Y" value={selectedLayer.attachment.localY} min={-512} max={512} step={1} onChange={(localY) => onAttachmentPatch(selectedLayer.id, { localY })} />
              <Range label="Local Scale" value={selectedLayer.attachment.localScale} min={0.05} max={4} step={0.01} onChange={(localScale) => onAttachmentPatch(selectedLayer.id, { localScale })} />
              <Range label="Local Rotation" value={selectedLayer.attachment.localRotation} min={-180} max={180} step={1} onChange={(localRotation) => onAttachmentPatch(selectedLayer.id, { localRotation })} />
            </div>
            <div className="inheritGrid">
              <label className="checkControl"><input type="checkbox" checked={selectedLayer.attachment.inheritPosition} onChange={(e) => onAttachmentPatch(selectedLayer.id, { inheritPosition: e.target.checked })} /> Inherit position</label>
              <label className="checkControl"><input type="checkbox" checked={selectedLayer.attachment.inheritRotation} onChange={(e) => onAttachmentPatch(selectedLayer.id, { inheritRotation: e.target.checked })} /> Inherit rotation</label>
              <label className="checkControl"><input type="checkbox" checked={selectedLayer.attachment.inheritScale} onChange={(e) => onAttachmentPatch(selectedLayer.id, { inheritScale: e.target.checked })} /> Inherit scale</label>
              <label className="checkControl"><input type="checkbox" checked={selectedLayer.attachment.inheritOpacity} onChange={(e) => onAttachmentPatch(selectedLayer.id, { inheritOpacity: e.target.checked })} /> Inherit opacity</label>
            </div>
          </>
        ) : (
          <p className="hint compact">Unattached layers use normal world/canvas X, Y, Scale, and Rotation controls.</p>
        )}
      </div>
    </section>
  );
}

function FrameOffsetSection({ project, selectedLayer, selectedLayerId, onFrameOffsetPatch }: InspectorPanelProps) {
  const animation = project.animations[project.activeAnimation];
  const frame = animation.frames[project.activeFrame] ?? animation.frames[0];
  const selectedOffset = selectedLayerId ? normalizeOffset(frame.layers[selectedLayerId]) : undefined;

  if (!selectedLayer || !selectedOffset) {
    return <EmptyState title="Select a layer" copy="Choose artwork before editing the selected frame offset. Offsets are stored per animation frame." />;
  }

  return (
    <section className="tabSection" aria-label="Current frame offset">
      <div className="sectionCard">
        <div className="sectionTitle">
          <h3>{project.activeAnimation} · frame {project.activeFrame + 1}</h3>
          <small>{selectedLayer.name}</small>
        </div>
        <p className="hint compact">Frame offsets are relative to the persistent base pose and only affect the current animation frame.</p>
        <div className="rangeGrid">
          <Range label="dx" value={selectedOffset.dx} min={-512} max={512} step={1} onChange={(dx) => onFrameOffsetPatch(selectedLayer.id, { dx })} />
          <Range label="dy" value={selectedOffset.dy} min={-512} max={512} step={1} onChange={(dy) => onFrameOffsetPatch(selectedLayer.id, { dy })} />
          <Range label="dScale" value={selectedOffset.dScale} min={0.1} max={3} step={0.01} onChange={(dScale) => onFrameOffsetPatch(selectedLayer.id, { dScale })} />
          <Range label="dRotation" value={selectedOffset.dRotation} min={-180} max={180} step={1} onChange={(dRotation) => onFrameOffsetPatch(selectedLayer.id, { dRotation })} />
          <Range label="dOpacity" value={selectedOffset.dOpacity} min={0} max={1} step={0.01} onChange={(dOpacity) => onFrameOffsetPatch(selectedLayer.id, { dOpacity })} />
        </div>
      </div>
    </section>
  );
}

function AnimationSection({ project, isPlaying, onAnimationChange, onFrameChange, onFpsChange, onTogglePlayback, onOnionSkinChange, onPreset }: InspectorPanelProps) {
  const animation = project.animations[project.activeAnimation];

  return (
    <section className="tabSection" aria-label="Animation controls">
      <div className="sectionCard">
        <div className="sectionTitle">
          <h3>Animation setup</h3>
          <small>{animation.frames.length} frames</small>
        </div>
        <label className="fieldLabel">
          Active animation
          <select value={project.activeAnimation} onChange={(e) => onAnimationChange(e.target.value as AnimationName)}>
            <option value="idle">Idle</option>
            <option value="slash">Slash</option>
            <option value="stab">Stab</option>
            <option value="spell">Spell placeholder</option>
          </select>
        </label>
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
      </div>
      <div className="sectionCard">
        <div className="sectionTitle">
          <h3>Presets</h3>
          <small>Apply motion keys</small>
        </div>
        <div className="buttonRow wrap presetRow">
          <button onClick={() => onPreset('idle')}>6-frame idle bob</button>
          <button onClick={() => onPreset('slash')}>8-frame sword slash</button>
          <button onClick={() => onPreset('stab')}>8-frame stab</button>
        </div>
      </div>
    </section>
  );
}

function ExportSection({ project, onBackgroundMode, onProjectImport, onExportStrip, onExportGif, onExportJson }: InspectorPanelProps) {
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onProjectImport(file);
    event.target.value = '';
  };

  return (
    <section className="tabSection" aria-label="Export controls">
      <div className="sectionCard">
        <div className="sectionTitle">
          <h3>Output</h3>
          <small>PNG strip, GIF, JSON</small>
        </div>
        <label className="fieldLabel">
          Background preview
          <select value={project.backgroundMode} onChange={(e) => onBackgroundMode(e.target.value as BackgroundMode)}>
            <option value="transparent">transparent</option>
            <option value="black">black</option>
            <option value="gray">gray</option>
            <option value="checkerboard">checkerboard</option>
            <option value="screenshot">uploaded screenshot</option>
          </select>
        </label>
        <p className="hint compact">Preview backgrounds are ignored by PNG strip and GIF exporters.</p>
        <div className="buttonGrid">
          <button className="primary" onClick={onExportStrip}>Export transparent PNG strip</button>
          <button onClick={onExportGif}>Export GIF preview</button>
          <button onClick={onExportJson}>Save project JSON</button>
          <label className="importButton">Import project JSON<input type="file" accept="application/json" onChange={handleImport} /></label>
        </div>
        <dl className="settingsList">
          <div><dt>Frame</dt><dd>{project.settings.frameWidth}×{project.settings.frameHeight}</dd></div>
          <div><dt>Animation</dt><dd>{project.activeAnimation}</dd></div>
          <div><dt>Frames</dt><dd>{project.animations[project.activeAnimation].frames.length}</dd></div>
        </dl>
      </div>
    </section>
  );
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <section className="emptyState" aria-label={title}>
      <strong>{title}</strong>
      <p>{copy}</p>
    </section>
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

export default App;
