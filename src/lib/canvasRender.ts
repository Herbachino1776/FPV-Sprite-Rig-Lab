import { BackgroundMode, LoadedImage, RigLayer, RigProject } from '../types/rig';
import { applyKeyframeToLayer } from './animation';

export interface RenderOptions {
  includeBackground?: boolean;
  onionSkin?: boolean;
  frameIndex?: number;
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load image asset.'));
    image.src = src;
  });
  imageCache.set(src, promise);
  return promise;
};

export const loadLayerImages = async (layers: RigLayer[]): Promise<LoadedImage[]> => {
  const loaded = await Promise.all(layers.map(async (layer) => ({ layer, image: await loadImage(layer.imageSrc) })));
  return loaded;
};

export const drawBackground = (
  ctx: CanvasRenderingContext2D,
  mode: BackgroundMode,
  width: number,
  height: number,
  screenshot?: HTMLImageElement,
) => {
  if (mode === 'transparent') return;
  if (mode === 'black' || mode === 'gray') {
    ctx.fillStyle = mode === 'black' ? '#050505' : '#777';
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (mode === 'screenshot' && screenshot) {
    ctx.drawImage(screenshot, 0, 0, width, height);
    return;
  }
  const tile = 32;
  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) {
      ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? '#cfd3d7' : '#8f969d';
      ctx.fillRect(x, y, tile, tile);
    }
  }
};

export const drawLayer = (ctx: CanvasRenderingContext2D, image: HTMLImageElement, layer: RigLayer, opacityMultiplier = 1) => {
  if (!layer.visible) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity * opacityMultiplier));
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);
  ctx.drawImage(image, -layer.pivotX, -layer.pivotY, layer.width, layer.height);
  ctx.restore();
};

export const drawProjectFrame = async (
  ctx: CanvasRenderingContext2D,
  project: RigProject,
  options: RenderOptions = {},
) => {
  const width = project.settings.frameWidth;
  const height = project.settings.frameHeight;
  const frameIndex = options.frameIndex ?? project.activeFrame;
  const animation = project.animations[project.activeAnimation];
  const frame = animation.frames[frameIndex] ?? animation.frames[0];
  const loadedLayers = await loadLayerImages(project.layers);
  const screenshot = project.backgroundImageSrc ? await loadImage(project.backgroundImageSrc) : undefined;

  ctx.clearRect(0, 0, width, height);
  if (options.includeBackground) drawBackground(ctx, project.backgroundMode, width, height, screenshot);

  if (options.onionSkin && frameIndex > 0) {
    const previous = animation.frames[frameIndex - 1];
    for (const { layer, image } of loadedLayers) {
      drawLayer(ctx, image, applyKeyframeToLayer(layer, previous.layers[layer.id]), 0.25);
    }
  }

  for (const { layer, image } of loadedLayers) {
    drawLayer(ctx, image, applyKeyframeToLayer(layer, frame.layers[layer.id]));
  }
};

export const hitTestLayer = (layer: RigLayer, pointX: number, pointY: number) => {
  const radians = (-layer.rotation * Math.PI) / 180;
  const dx = pointX - layer.x;
  const dy = pointY - layer.y;
  const localX = (dx * Math.cos(radians) - dy * Math.sin(radians)) / layer.scale + layer.pivotX;
  const localY = (dx * Math.sin(radians) + dy * Math.cos(radians)) / layer.scale + layer.pivotY;
  return localX >= 0 && localX <= layer.width && localY >= 0 && localY <= layer.height;
};
