import { drawMatrixLayer, loadLayerImages } from './canvasRender';
import { RigProject } from '../types/rig';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { computeLayerTransforms } from './layerTransforms';

const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const canvasToBlob = (canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> =>
  new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Export failed.'))), type));

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportPngStrip = async (project: RigProject): Promise<Blob> => {
  const animation = project.animations[project.activeAnimation];
  const { frameWidth, frameHeight } = project.settings;
  const canvas = makeCanvas(frameWidth * animation.frames.length, frameHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported.');
  const loadedLayers = await loadLayerImages(project.layers);

  animation.frames.forEach((_frame, frameIndex) => {
    const transforms = computeLayerTransforms(project, frameIndex);
    ctx.save();
    ctx.translate(frameIndex * frameWidth, 0);
    for (const { layer, image } of loadedLayers) {
      const transform = transforms.get(layer.id);
      if (transform) drawMatrixLayer(ctx, image, layer, transform.matrix, transform.opacity);
    }
    ctx.restore();
  });

  return canvasToBlob(canvas, 'image/png');
};

export const exportGifPreview = async (project: RigProject): Promise<Blob> => {
  const animation = project.animations[project.activeAnimation];
  const { frameWidth, frameHeight, fps } = project.settings;
  const canvas = makeCanvas(frameWidth, frameHeight);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas not supported.');
  const loadedLayers = await loadLayerImages(project.layers);
  const gif = GIFEncoder();

  for (let frameIndex = 0; frameIndex < animation.frames.length; frameIndex += 1) {
    const transforms = computeLayerTransforms(project, frameIndex);
    ctx.clearRect(0, 0, frameWidth, frameHeight);
    for (const { layer, image } of loadedLayers) {
      const transform = transforms.get(layer.id);
      if (transform) drawMatrixLayer(ctx, image, layer, transform.matrix, transform.opacity);
    }
    const data = ctx.getImageData(0, 0, frameWidth, frameHeight).data;
    const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true });
    const indexed = applyPalette(data, palette, 'rgba4444');
    const transparentIndex = Math.max(0, palette.findIndex((color) => color[3] === 0));
    gif.writeFrame(indexed, frameWidth, frameHeight, {
      palette,
      delay: Math.round(1000 / fps),
      transparent: transparentIndex >= 0,
      transparentIndex,
    });
  }

  gif.finish();
  const bytes = gif.bytesView();
  return new Blob([bytes.slice().buffer], { type: 'image/gif' });
};
