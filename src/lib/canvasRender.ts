import { BackgroundMode, LoadedImage, RigLayer, RigProject } from '../types/rig';
import { Matrix2D, computeLayerTransforms, invert, transformPoint } from './layerTransforms';

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
  const loaded = await Promise.all([...layers].sort((a, b) => a.order - b.order).map(async (layer) => ({ layer, image: await loadImage(layer.imageSrc) })));
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

export const drawMatrixLayer = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  layer: RigLayer,
  matrix: Matrix2D,
  opacity: number,
  opacityMultiplier = 1,
) => {
  if (!layer.visible) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity * opacityMultiplier));
  ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  ctx.drawImage(image, 0, 0, layer.width, layer.height);
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
  const loadedLayers = await loadLayerImages(project.layers);
  const screenshot = project.backgroundImageSrc ? await loadImage(project.backgroundImageSrc) : undefined;

  ctx.clearRect(0, 0, width, height);
  if (options.includeBackground) drawBackground(ctx, project.backgroundMode, width, height, screenshot);

  if (options.onionSkin && frameIndex > 0) {
    const previousTransforms = computeLayerTransforms(project, frameIndex - 1);
    for (const { layer, image } of loadedLayers) {
      const transform = previousTransforms.get(layer.id);
      if (transform) drawMatrixLayer(ctx, image, layer, transform.matrix, transform.opacity, 0.25);
    }
  }

  const transforms = computeLayerTransforms(project, frameIndex);
  for (const { layer, image } of loadedLayers) {
    const transform = transforms.get(layer.id);
    if (transform) drawMatrixLayer(ctx, image, layer, transform.matrix, transform.opacity);
  }
};

export const hitTestLayer = (layer: RigLayer, pointX: number, pointY: number, matrix: Matrix2D) => {
  const local = transformPoint(invert(matrix), pointX, pointY);
  return local.x >= 0 && local.x <= layer.width && local.y >= 0 && local.y <= layer.height;
};
