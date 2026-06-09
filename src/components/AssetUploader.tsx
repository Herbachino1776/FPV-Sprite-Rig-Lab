import { ChangeEvent } from 'react';
import { RigLayer } from '../types/rig';

interface AssetUploaderProps {
  onAddLayer: (layer: RigLayer) => void;
  onBackgroundUpload: (src: string) => void;
}

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

export function AssetUploader({ onAddLayer, onBackgroundUpload }: AssetUploaderProps) {
  const handleLayerFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type === 'image/png');
    for (const file of files) {
      const src = await readFile(file);
      const dimensions = await loadDimensions(src);
      const layer: RigLayer = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.png$/i, ''),
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
      };
      onAddLayer(layer);
    }
    event.target.value = '';
  };

  const handleScreenshot = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onBackgroundUpload(await readFile(file));
    event.target.value = '';
  };

  return (
    <section className="sectionCard assetUploader" aria-label="Asset upload controls">
      <div className="sectionTitle">
        <h3>Assets</h3>
        <small>PNG layers + backdrop</small>
      </div>
      <label className="fileDrop">
        Upload transparent PNG layers
        <input type="file" accept="image/png" multiple onChange={handleLayerFiles} />
      </label>
      <label className="fileDrop secondary">
        Upload screenshot background
        <input type="file" accept="image/*" onChange={handleScreenshot} />
      </label>
      <p className="hint compact">Layer uploads stay in the browser and save into exported project JSON.</p>
    </section>
  );
}
