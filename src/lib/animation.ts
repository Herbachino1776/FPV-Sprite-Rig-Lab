import { AnimationName, LayerFrameOffset, RigAnimation, RigLayer, RigProject } from '../types/rig';

export const DEFAULT_FRAME_WIDTH = 1024;
export const DEFAULT_FRAME_HEIGHT = 1024;
export const DEFAULT_FPS = 8;

export const ANIMATION_FRAME_COUNTS: Record<AnimationName, number> = {
  idle: 6,
  slash: 8,
  stab: 8,
  spell: 8,
};

export const NEUTRAL_FRAME_OFFSET: LayerFrameOffset = {
  dx: 0,
  dy: 0,
  dScale: 1,
  dRotation: 0,
  dOpacity: 1,
};

export const createNeutralOffset = (): LayerFrameOffset => ({ ...NEUTRAL_FRAME_OFFSET });

export const normalizeOffset = (offset?: Partial<LayerFrameOffset>): LayerFrameOffset => ({
  dx: offset?.dx ?? 0,
  dy: offset?.dy ?? 0,
  dScale: offset?.dScale ?? 1,
  dRotation: offset?.dRotation ?? 0,
  dOpacity: offset?.dOpacity ?? 1,
});

export const combineLayerWithOffset = (layer: RigLayer, offset?: Partial<LayerFrameOffset>): RigLayer => {
  const frameOffset = normalizeOffset(offset);
  return {
    ...layer,
    x: layer.x + frameOffset.dx,
    y: layer.y + frameOffset.dy,
    scale: layer.scale * frameOffset.dScale,
    rotation: layer.rotation + frameOffset.dRotation,
    opacity: layer.opacity * frameOffset.dOpacity,
  };
};

export const createEmptyFrame = (index: number, layers: RigLayer[]) => ({
  index,
  layers: Object.fromEntries(layers.map((layer) => [layer.id, createNeutralOffset()])),
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
      slash: createAnimation('slash', ANIMATION_FRAME_COUNTS.slash, layers),
      stab: createAnimation('stab', ANIMATION_FRAME_COUNTS.stab, layers),
      spell: createAnimation('spell', ANIMATION_FRAME_COUNTS.spell, layers),
    },
    activeAnimation: 'idle',
    activeFrame: 0,
    onionSkin: false,
    backgroundMode: 'checkerboard',
  };
};

export const ensureLayerOffsets = (project: RigProject, layer: RigLayer): RigProject => ({
  ...project,
  animations: Object.fromEntries(
    Object.entries(project.animations).map(([name, animation]) => [
      name,
      {
        ...animation,
        frames: animation.frames.map((frame) => ({
          ...frame,
          layers: { ...frame.layers, [layer.id]: normalizeOffset(frame.layers[layer.id]) },
        })),
      },
    ]),
  ) as RigProject['animations'],
});

export const setFrameOffset = (
  project: RigProject,
  layerId: string,
  patch: Partial<LayerFrameOffset>,
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
              [layerId]: { ...normalizeOffset(frame.layers[layerId]), ...patch },
            },
          };
        }),
      },
    },
  };
};

export const setActiveFrame = (project: RigProject, frameIndex = project.activeFrame): RigProject => ({
  ...project,
  activeFrame: frameIndex,
});

export const addLayerToProject = (project: RigProject, layer: RigLayer): RigProject => {
  const withLayer = { ...project, layers: [...project.layers, layer] };
  return ensureLayerOffsets(withLayer, layer);
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

export const applyIdlePreset = (project: RigProject): RigProject => applyPreset(project, 'idle', ANIMATION_FRAME_COUNTS.idle, (index) => {
  const t = (Math.PI * 2 * index) / ANIMATION_FRAME_COUNTS.idle;
  return { dx: 0, dy: Math.sin(t) * 18, dScale: 1, dRotation: Math.sin(t) * 1.5, dOpacity: 1 };
});

export const applySlashPreset = (project: RigProject): RigProject => applyPreset(project, 'slash', ANIMATION_FRAME_COUNTS.slash, (index) => {
  const progress = index / (ANIMATION_FRAME_COUNTS.slash - 1);
  const swing = Math.sin(progress * Math.PI);
  return {
    dx: (progress - 0.5) * 180,
    dy: swing * 90,
    dScale: 1 + swing * 0.08,
    dRotation: -42 + progress * 96,
    dOpacity: 1,
  };
});

export const applyStabPreset = (project: RigProject): RigProject => applyPreset(project, 'stab', ANIMATION_FRAME_COUNTS.stab, (index) => {
  const progress = index / (ANIMATION_FRAME_COUNTS.stab - 1);
  const thrust = Math.sin(progress * Math.PI);
  return {
    dx: 0,
    dy: -thrust * 180,
    dScale: 1 + thrust * 0.22,
    dRotation: (progress - 0.5) * 8,
    dOpacity: 1,
  };
});

const applyPreset = (
  project: RigProject,
  name: AnimationName,
  frameCount: number,
  offset: (frameIndex: number) => LayerFrameOffset,
): RigProject => {
  const animation: RigAnimation = {
    name,
    frames: Array.from({ length: frameCount }, (_, index) => ({
      index,
      layers: Object.fromEntries(project.layers.map((layer) => [layer.id, offset(index)])),
    })),
  };
  return {
    ...project,
    activeAnimation: name,
    activeFrame: 0,
    animations: { ...project.animations, [name]: animation },
  };
};
