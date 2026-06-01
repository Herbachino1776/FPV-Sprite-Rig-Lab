import { AnimationName, RigAnimation, RigLayer, RigProject, TransformState } from '../types/rig';

export const DEFAULT_FRAME_WIDTH = 1024;
export const DEFAULT_FRAME_HEIGHT = 1024;
export const DEFAULT_FPS = 8;

export const ANIMATION_FRAME_COUNTS: Record<AnimationName, number> = {
  idle: 6,
  attack: 8,
  spell: 8,
};

export const createEmptyFrame = (index: number, layers: RigLayer[]) => ({
  index,
  layers: Object.fromEntries(layers.map((layer) => [layer.id, layerToKeyframe(layer)])),
});

export const createAnimation = (name: AnimationName, frameCount: number, layers: RigLayer[]): RigAnimation => ({
  name,
  frames: Array.from({ length: frameCount }, (_, index) => createEmptyFrame(index, layers)),
});

export const createBlankProject = (): RigProject => {
  const layers: RigLayer[] = [];
  return {
    name: 'fpv-sprite-rig-lab',
    version: 1,
    settings: {
      frameWidth: DEFAULT_FRAME_WIDTH,
      frameHeight: DEFAULT_FRAME_HEIGHT,
      fps: DEFAULT_FPS,
    },
    layers,
    animations: {
      idle: createAnimation('idle', ANIMATION_FRAME_COUNTS.idle, layers),
      attack: createAnimation('attack', ANIMATION_FRAME_COUNTS.attack, layers),
      spell: createAnimation('spell', ANIMATION_FRAME_COUNTS.spell, layers),
    },
    activeAnimation: 'idle',
    activeFrame: 0,
    onionSkin: false,
    backgroundMode: 'checkerboard',
  };
};

export const layerToKeyframe = (layer: RigLayer): TransformState => ({
  x: layer.x,
  y: layer.y,
  scale: layer.scale,
  rotation: layer.rotation,
  opacity: layer.opacity,
});

export const applyKeyframeToLayer = (layer: RigLayer, keyframe?: TransformState): RigLayer => {
  if (!keyframe) return layer;
  return { ...layer, ...keyframe };
};

export const ensureLayerKeyframes = (project: RigProject, layer: RigLayer): RigProject => ({
  ...project,
  animations: Object.fromEntries(
    Object.entries(project.animations).map(([name, animation]) => [
      name,
      {
        ...animation,
        frames: animation.frames.map((frame) => ({
          ...frame,
          layers: { ...frame.layers, [layer.id]: layerToKeyframe(layer) },
        })),
      },
    ]),
  ) as RigProject['animations'],
});

export const setFrameTransform = (
  project: RigProject,
  layerId: string,
  patch: Partial<TransformState>,
): RigProject => {
  const animation = project.animations[project.activeAnimation];
  return {
    ...project,
    animations: {
      ...project.animations,
      [project.activeAnimation]: {
        ...animation,
        frames: animation.frames.map((frame, index) => {
          if (index !== project.activeFrame) return frame;
          return {
            ...frame,
            layers: {
              ...frame.layers,
              [layerId]: { ...frame.layers[layerId], ...patch },
            },
          };
        }),
      },
    },
    layers: project.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
  };
};

export const syncLayersToFrame = (project: RigProject, frameIndex = project.activeFrame): RigProject => {
  const frame = project.animations[project.activeAnimation].frames[frameIndex];
  return {
    ...project,
    activeFrame: frameIndex,
    layers: project.layers.map((layer) => applyKeyframeToLayer(layer, frame?.layers[layer.id])),
  };
};

export const addLayerToProject = (project: RigProject, layer: RigLayer): RigProject => {
  const withLayer = { ...project, layers: [...project.layers, layer] };
  return ensureLayerKeyframes(withLayer, layer);
};

export const removeLayerFromProject = (project: RigProject, layerId: string): RigProject => ({
  ...project,
  layers: project.layers.filter((layer) => layer.id !== layerId),
  animations: Object.fromEntries(
    Object.entries(project.animations).map(([name, animation]) => [
      name,
      {
        ...animation,
        frames: animation.frames.map((frame) => {
          const { [layerId]: _removed, ...layers } = frame.layers;
          return { ...frame, layers };
        }),
      },
    ]),
  ) as RigProject['animations'],
});

export const applyIdlePreset = (project: RigProject): RigProject => applyPreset(project, 'idle', ANIMATION_FRAME_COUNTS.idle, (layer, index) => {
  const t = (Math.PI * 2 * index) / ANIMATION_FRAME_COUNTS.idle;
  return { x: layer.x, y: layer.y + Math.sin(t) * 18, scale: layer.scale, rotation: layer.rotation + Math.sin(t) * 1.5, opacity: layer.opacity };
});

export const applySlashPreset = (project: RigProject): RigProject => applyPreset(project, 'attack', ANIMATION_FRAME_COUNTS.attack, (layer, index) => {
  const progress = index / (ANIMATION_FRAME_COUNTS.attack - 1);
  const swing = Math.sin(progress * Math.PI);
  return {
    x: layer.x + (progress - 0.5) * 180,
    y: layer.y + swing * 90,
    scale: layer.scale * (1 + swing * 0.08),
    rotation: layer.rotation - 42 + progress * 96,
    opacity: layer.opacity,
  };
});

export const applyStabPreset = (project: RigProject): RigProject => applyPreset(project, 'attack', ANIMATION_FRAME_COUNTS.attack, (layer, index) => {
  const progress = index / (ANIMATION_FRAME_COUNTS.attack - 1);
  const thrust = Math.sin(progress * Math.PI);
  return {
    x: layer.x,
    y: layer.y - thrust * 180,
    scale: layer.scale * (1 + thrust * 0.22),
    rotation: layer.rotation + (progress - 0.5) * 8,
    opacity: layer.opacity,
  };
});

const applyPreset = (
  project: RigProject,
  name: AnimationName,
  frameCount: number,
  transform: (layer: RigLayer, frameIndex: number) => TransformState,
): RigProject => {
  const animation: RigAnimation = {
    name,
    frames: Array.from({ length: frameCount }, (_, index) => ({
      index,
      layers: Object.fromEntries(project.layers.map((layer) => [layer.id, transform(layer, index)])),
    })),
  };
  return syncLayersToFrame({
    ...project,
    activeAnimation: name,
    activeFrame: 0,
    animations: { ...project.animations, [name]: animation },
  }, 0);
};
