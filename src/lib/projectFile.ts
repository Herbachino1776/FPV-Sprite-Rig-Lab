import { AnimationName, LayerFrameOffset, RigAnimation, RigLayer, RigProject } from '../types/rig';
import { ANIMATION_FRAME_COUNTS, DEFAULT_FPS, DEFAULT_FRAME_HEIGHT, DEFAULT_FRAME_WIDTH, createAnimation, normalizeOffset } from './animation';

type LegacyLayerFrame = Partial<LayerFrameOffset> & {
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
};

type ImportedAnimation = Partial<RigAnimation> & {
  name?: AnimationName | 'attack';
  frames?: Array<{ index: number; layers: Record<string, LegacyLayerFrame> }>;
};

type ImportedProject = Omit<Partial<RigProject>, 'animations' | 'layers' | 'activeAnimation'> & {
  layers?: Array<Partial<RigLayer> & Pick<RigLayer, 'id' | 'name' | 'imageSrc' | 'width' | 'height'>>;
  animations?: Partial<Record<AnimationName | 'attack', ImportedAnimation>>;
  activeAnimation?: AnimationName | 'attack';
};

export const exportProjectJson = (project: RigProject) => {
  const json = JSON.stringify(project, null, 2);
  return new Blob([json], { type: 'application/json' });
};

export const importProjectJson = async (file: File): Promise<RigProject> => {
  const text = await file.text();
  const project = JSON.parse(text) as ImportedProject;
  if (!project.version || !project.settings || !project.animations || !Array.isArray(project.layers)) {
    throw new Error('This does not look like an FPV Sprite Rig Lab project file.');
  }
  return normalizeProject(project);
};

const normalizeProject = (project: ImportedProject): RigProject => {
  const layers: RigLayer[] = (project.layers ?? []).map((layer, index) => ({
    id: layer.id,
    name: layer.name,
    imageSrc: layer.imageSrc,
    width: layer.width,
    height: layer.height,
    visible: layer.visible ?? true,
    x: layer.x ?? 512,
    y: layer.y ?? 620,
    scale: layer.scale ?? 1,
    rotation: layer.rotation ?? 0,
    opacity: layer.opacity ?? 1,
    pivotX: layer.pivotX ?? layer.width / 2,
    pivotY: layer.pivotY ?? layer.height / 2,
    order: layer.order ?? index,
  }));

  const animations = Object.fromEntries(
    (['idle', 'slash', 'stab', 'spell'] as AnimationName[]).map((name) => {
      const sourceName = name === 'slash' || name === 'stab' ? name : name;
      const source = project.animations?.[sourceName] ?? (name === 'slash' || name === 'stab' ? project.animations?.attack : undefined);
      return [name, normalizeAnimation(name, source, layers)];
    }),
  ) as RigProject['animations'];

  const activeAnimation = project.activeAnimation === 'attack' ? 'slash' : (project.activeAnimation ?? 'idle');
  const activeFrame = Math.min(project.activeFrame ?? 0, animations[activeAnimation].frames.length - 1);

  return {
    name: project.name ?? 'fpv-sprite-rig-lab',
    version: 1,
    settings: project.settings ?? { frameWidth: DEFAULT_FRAME_WIDTH, frameHeight: DEFAULT_FRAME_HEIGHT, fps: DEFAULT_FPS },
    layers,
    animations,
    activeAnimation,
    activeFrame: Math.max(0, activeFrame),
    onionSkin: project.onionSkin ?? false,
    backgroundMode: project.backgroundMode ?? 'checkerboard',
    backgroundImageSrc: project.backgroundImageSrc,
  };
};

const normalizeAnimation = (name: AnimationName, animation: ImportedAnimation | undefined, layers: RigLayer[]): RigAnimation => {
  if (!animation?.frames?.length) return createAnimation(name, ANIMATION_FRAME_COUNTS[name], layers);
  return {
    name,
    frames: animation.frames.map((frame, index) => ({
      index: frame.index ?? index,
      layers: Object.fromEntries(layers.map((layer) => [layer.id, normalizeImportedOffset(frame.layers?.[layer.id], layer)])),
    })),
  };
};

const normalizeImportedOffset = (frame: LegacyLayerFrame | undefined, baseLayer: RigLayer): LayerFrameOffset => {
  if (!frame) return normalizeOffset();
  if ('dx' in frame || 'dy' in frame || 'dScale' in frame || 'dRotation' in frame || 'dOpacity' in frame) {
    return normalizeOffset(frame);
  }
  return {
    dx: (frame.x ?? baseLayer.x) - baseLayer.x,
    dy: (frame.y ?? baseLayer.y) - baseLayer.y,
    dScale: baseLayer.scale === 0 ? 1 : (frame.scale ?? baseLayer.scale) / baseLayer.scale,
    dRotation: (frame.rotation ?? baseLayer.rotation) - baseLayer.rotation,
    dOpacity: baseLayer.opacity === 0 ? 1 : (frame.opacity ?? baseLayer.opacity) / baseLayer.opacity,
  };
};
