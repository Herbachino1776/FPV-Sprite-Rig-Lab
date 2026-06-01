import { ChangeEvent } from 'react';
import { BackgroundMode, RigProject } from '../types/rig';

interface ExportPanelProps {
  project: RigProject;
  onBackgroundMode: (mode: BackgroundMode) => void;
  onProjectImport: (file: File) => void;
  onExportStrip: () => void;
  onExportGif: () => void;
  onExportJson: () => void;
}

export function ExportPanel({ project, onBackgroundMode, onProjectImport, onExportStrip, onExportGif, onExportJson }: ExportPanelProps) {
  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onProjectImport(file);
    event.target.value = '';
  };

  return (
    <section className="panel">
      <h2>Preview & Export</h2>
      <label>
        Background preview
        <select value={project.backgroundMode} onChange={(e) => onBackgroundMode(e.target.value as BackgroundMode)}>
          <option value="transparent">transparent</option>
          <option value="black">black</option>
          <option value="gray">gray</option>
          <option value="checkerboard">checkerboard</option>
          <option value="screenshot">uploaded screenshot</option>
        </select>
      </label>
      <p className="hint">Preview backgrounds are ignored by PNG strip and GIF exporters.</p>
      <div className="buttonGrid">
        <button className="primary" onClick={onExportStrip}>Export transparent PNG strip</button>
        <button onClick={onExportGif}>Export GIF preview</button>
        <button onClick={onExportJson}>Export project JSON</button>
        <label className="importButton">Import project JSON<input type="file" accept="application/json" onChange={handleImport} /></label>
      </div>
      <dl className="settingsList">
        <div><dt>Frame</dt><dd>{project.settings.frameWidth}×{project.settings.frameHeight}</dd></div>
        <div><dt>Animation</dt><dd>{project.activeAnimation}</dd></div>
        <div><dt>Frames</dt><dd>{project.animations[project.activeAnimation].frames.length}</dd></div>
      </dl>
    </section>
  );
}
