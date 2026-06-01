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
  createBlankProject,
  removeLayerFromProject,
  setActiveFrame,
  setFrameOffset,
} from './lib/animation';
import { downloadBlob, exportGifPreview, exportPngStrip } from './lib/exportStrip';
import { exportProjectJson, importProjectJson } from './lib/projectFile';
import { AnimationName, BackgroundMode, LayerFrameOffset, RigLayer, RigProject } from './types/rig';

const withLayerOrder = (layers: RigLayer[]) => layers.map((layer, index) => ({ ...layer, order: index }));

function App() {
  const [project, setProject] = useState<RigProject>(() => createBlankProject());
  const [selectedLayerId, setSelectedLayerId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
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
      layers: current.layers.map((layer) => (layer.id === id ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer)),
    }));
  };

  const addLayer = (layer: RigLayer) => {
    setProject((current) => addLayerToProject(current, { ...layer, order: current.layers.length }));
    setSelectedLayerId(layer.id);
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
          onMoveLayer={moveBaseLayer}
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
        selectedLayerId={selectedLayerId}
        isPlaying={isPlaying}
        onAnimationChange={changeAnimation}
        onFrameChange={(frame) => setProject((current) => setActiveFrame(current, frame))}
        onFrameOffsetPatch={patchFrameOffset}
        onFpsChange={(fps) => setProject((current) => ({ ...current, settings: { ...current.settings, fps: Math.max(1, fps || 1) } }))}
        onTogglePlayback={() => setIsPlaying((playing) => !playing)}
        onOnionSkinChange={(onionSkin) => setProject((current) => ({ ...current, onionSkin }))}
        onPreset={(preset) => setProject((current) => preset === 'idle' ? applyIdlePreset(current) : preset === 'slash' ? applySlashPreset(current) : applyStabPreset(current))}
      />
    </main>
  );
}

export default App;
