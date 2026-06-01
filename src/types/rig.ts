export type AnimationName = 'idle' | 'slash' | 'stab' | 'spell';

export type BackgroundMode = 'transparent' | 'black' | 'gray' | 'checkerboard' | 'screenshot';

export interface TransformState {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface RigLayer extends TransformState {
  id: string;
  name: string;
  imageSrc: string;
  visible: boolean;
  pivotX: number;
  pivotY: number;
  order: number;
  width: number;
  height: number;
}

export interface LayerFrameOffset {
  dx: number;
  dy: number;
  dScale: number;
  dRotation: number;
  dOpacity: number;
}

export interface AnimationFrame {
  index: number;
  layers: Record<string, LayerFrameOffset>;
}

export interface RigAnimation {
  name: AnimationName;
  frames: AnimationFrame[];
}

export interface ExportSettings {
  frameWidth: number;
  frameHeight: number;
  fps: number;
}

export interface RigProject {
  name: string;
  version: 1;
  settings: ExportSettings;
  layers: RigLayer[];
  animations: Record<AnimationName, RigAnimation>;
  activeAnimation: AnimationName;
  activeFrame: number;
  onionSkin: boolean;
  backgroundMode: BackgroundMode;
  backgroundImageSrc?: string;
}

export interface LoadedImage {
  layer: RigLayer;
  image: HTMLImageElement;
}
