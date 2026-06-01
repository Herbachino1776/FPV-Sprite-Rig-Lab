import { useEffect, useState } from 'react';
import { AssetUploader } from './components/AssetUploader';
import { CanvasStage } from './components/CanvasStage';
import { ExportPanel } from './components/ExportPanel';
import { LayerPanel } from './components/LayerPanel';
import { Timeline } from './components/Timeline';
import {
  addLayerToProject,
  applyIdlePreset,
  applySlashPreset,
  applyStabPreset,
  removeLayerFromProject,
  setFrameTransform,
  syncLayersToFrame,
} from './lib/animation';
import { downloadBlob, exportGifPreview, exportPngStrip } from './lib/exportStrip';
import { exportProjectJson, importProjectJson } from './lib/projectFile';
import { AnimationName, BackgroundMode, RigLayer, RigProject } from './types/rig';
import { createBlankProject } from './lib/animation';

function App() {
  const [project, setProject] = useState<RigProject>(() => createBlankProject());
  const [selectedLayerId, setSelectedLayerId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [message, setMessage] = useState('Ready. Upload transparent PNG layers to begin.');

  useEffect(() => {
    if (!isPlaying) return;
    const animation = project.animations[project.activeAnimation];
    const interval = window.setInterval(() => {
      setProject((current) => syncLayersToFrame(current, (current.activeFrame + 1) % animation.frames.length));
    }, 1000 / project.settings.fps);
    return () => window.clearInterval(interval);
  }, [isPlaying, project.activeAnimation, project.activeFrame, project.animations, project.settings.fps]);

  const patchLayer = (id: string, patch: Partial<RigLayer>) => {
    setProject((current) => {
      const transformPatch = Object.fromEntries(
        Object.entries(patch).filter(([key]) => ['x', 'y', 'scale', 'rotation', 'opacity'].includes(key)),
      );
      const next = Object.keys(transformPatch).length ? setFrameTransform(current, id, transformPatch) : current;
      return { ...next, layers: next.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) };
    });
  };

  const addLayer = (layer: RigLayer) => {
    setProject((current) => addLayerToProject(current, layer));
    setSelectedLayerId(layer.id);
  };

  const reorderLayer = (id: string, direction: -1 | 1) => {
    setProject((current) => {
      const index = current.layers.findIndex((layer) => layer.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.layers.length) return current;
      const layers = [...current.layers];
      [layers[index], layers[nextIndex]] = [layers[nextIndex], layers[index]];
      return { ...current, layers };
    });
  };

  const changeAnimation = (name: AnimationName) => {
    setProject((current) => syncLayersToFrame({ ...current, activeAnimation: name }, 0));
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

  return (
    <main className="appShell">
      <header className="hero">
        <div>
          <p className="eyebrow">Three.js dungeon crawler tool</p>
          <h1>FPV Sprite Rig Lab</h1>
          <p>Browser-only arm and weapon animation strip generator. No backend, no paid services, transparent exports.</p>
        </div>
        <div className="status">{message}</div>
      </header>
      <div className="workspace">
        <aside className="sidebar left">
          <AssetUploader onAddLayer={addLayer} onBackgroundUpload={(src) => setProject((p) => ({ ...p, backgroundImageSrc: src, backgroundMode: 'screenshot' }))} />
          <LayerPanel
            layers={project.layers}
            selectedLayerId={selectedLayerId}
            onSelect={setSelectedLayerId}
            onPatch={patchLayer}
            onRemove={(id) => setProject((current) => removeLayerFromProject(current, id))}
            onReorder={reorderLayer}
          />
        </aside>
        <CanvasStage
          project={project}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          onMoveLayer={(id, dx, dy) => patchLayer(id, { x: (project.layers.find((layer) => layer.id === id)?.x ?? 0) + dx, y: (project.layers.find((layer) => layer.id === id)?.y ?? 0) + dy })}
        />
        <aside className="sidebar right">
          <ExportPanel
            project={project}
            onBackgroundMode={(backgroundMode: BackgroundMode) => setProject((p) => ({ ...p, backgroundMode }))}
            onProjectImport={importJson}
            onExportStrip={() => exportWithMessage('strip')}
            onExportGif={() => exportWithMessage('gif')}
            onExportJson={() => exportWithMessage('json')}
          />
        </aside>
      </div>
      <Timeline
        project={project}
        isPlaying={isPlaying}
        onAnimationChange={changeAnimation}
        onFrameChange={(frame) => setProject((current) => syncLayersToFrame(current, frame))}
        onFpsChange={(fps) => setProject((current) => ({ ...current, settings: { ...current.settings, fps: Math.max(1, fps || 1) } }))}
        onTogglePlayback={() => setIsPlaying((playing) => !playing)}
        onOnionSkinChange={(onionSkin) => setProject((current) => ({ ...current, onionSkin }))}
        onPreset={(preset) => setProject((current) => preset === 'idle' ? applyIdlePreset(current) : preset === 'slash' ? applySlashPreset(current) : applyStabPreset(current))}
      />
    </main>
  );
}

export default App;
