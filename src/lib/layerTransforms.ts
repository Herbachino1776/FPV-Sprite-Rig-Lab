import { LayerAttachment, LayerFrameOffset, RigLayer, RigProject } from '../types/rig';
import { normalizeOffset } from './animation';

export interface Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface RenderTransform {
  layer: RigLayer;
  matrix: Matrix2D;
  opacity: number;
  circular: boolean;
}

export const identity = (): Matrix2D => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

export const multiply = (left: Matrix2D, right: Matrix2D): Matrix2D => ({
  a: left.a * right.a + left.c * right.b,
  b: left.b * right.a + left.d * right.b,
  c: left.a * right.c + left.c * right.d,
  d: left.b * right.c + left.d * right.d,
  e: left.a * right.e + left.c * right.f + left.e,
  f: left.b * right.e + left.d * right.f + left.f,
});

export const translate = (x: number, y: number): Matrix2D => ({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });

export const rotate = (degrees: number): Matrix2D => {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
};

export const scale = (value: number): Matrix2D => ({ a: value, b: 0, c: 0, d: value, e: 0, f: 0 });

export const invert = (matrix: Matrix2D): Matrix2D => {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(determinant) < 0.000001) return identity();
  return {
    a: matrix.d / determinant,
    b: -matrix.b / determinant,
    c: -matrix.c / determinant,
    d: matrix.a / determinant,
    e: (matrix.c * matrix.f - matrix.d * matrix.e) / determinant,
    f: (matrix.b * matrix.e - matrix.a * matrix.f) / determinant,
  };
};

export const transformPoint = (matrix: Matrix2D, x: number, y: number) => ({
  x: matrix.a * x + matrix.c * y + matrix.e,
  y: matrix.b * x + matrix.d * y + matrix.f,
});

export const decomposeUniform = (matrix: Matrix2D) => ({
  x: matrix.e,
  y: matrix.f,
  scale: Math.hypot(matrix.a, matrix.b) || 1,
  rotation: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI,
});

export const normalizeAttachment = (attachment: LayerAttachment): LayerAttachment => ({
  parentLayerId: attachment.parentLayerId,
  parentAnchorX: attachment.parentAnchorX ?? 0,
  parentAnchorY: attachment.parentAnchorY ?? 0,
  childAnchorX: attachment.childAnchorX ?? 0,
  childAnchorY: attachment.childAnchorY ?? 0,
  localX: attachment.localX ?? 0,
  localY: attachment.localY ?? 0,
  localScale: attachment.localScale ?? 1,
  localRotation: attachment.localRotation ?? 0,
  inheritPosition: attachment.inheritPosition ?? true,
  inheritRotation: attachment.inheritRotation ?? true,
  inheritScale: attachment.inheritScale ?? true,
  inheritOpacity: attachment.inheritOpacity ?? true,
});

const composeBaseMatrix = (layer: RigLayer, offset?: Partial<LayerFrameOffset>): Matrix2D => {
  const frameOffset = normalizeOffset(offset);
  return multiply(
    multiply(
      multiply(
        multiply(translate(layer.x + frameOffset.dx, layer.y + frameOffset.dy), rotate(layer.rotation + frameOffset.dRotation)),
        scale(layer.scale * frameOffset.dScale),
      ),
      translate(-layer.pivotX, -layer.pivotY),
    ),
    identity(),
  );
};

const composeAttachmentMatrix = (
  layer: RigLayer,
  parentTransform: RenderTransform,
  offset?: Partial<LayerFrameOffset>,
): Matrix2D => {
  const attachment = normalizeAttachment(layer.attachment!);
  const frameOffset = normalizeOffset(offset);
  const parent = parentTransform.layer;
  const parentWorld = decomposeUniform(parentTransform.matrix);
  const inheritedRotation = attachment.inheritRotation ? parentWorld.rotation : 0;
  const inheritedScale = attachment.inheritScale ? parentWorld.scale : 1;
  const parentOrigin = attachment.inheritPosition
    ? transformPoint(parentTransform.matrix, parent.pivotX, parent.pivotY)
    : { x: parent.x, y: parent.y };

  return multiply(
    multiply(
      multiply(
        multiply(
          multiply(
            multiply(
              multiply(
                multiply(
                  multiply(translate(parentOrigin.x, parentOrigin.y), rotate(inheritedRotation)),
                  scale(inheritedScale),
                ),
                translate(attachment.parentAnchorX - parent.pivotX, attachment.parentAnchorY - parent.pivotY),
              ),
              translate(attachment.localX, attachment.localY),
            ),
            rotate(attachment.localRotation),
          ),
          scale(attachment.localScale),
        ),
        translate(frameOffset.dx, frameOffset.dy),
      ),
      rotate(frameOffset.dRotation),
    ),
    multiply(scale(frameOffset.dScale), translate(-attachment.childAnchorX, -attachment.childAnchorY)),
  );
};

export const getAttachmentDescendants = (layers: RigLayer[], layerId: string): Set<string> => {
  const descendants = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const layer of layers) {
      const parentId = layer.attachment?.parentLayerId;
      if (parentId && (parentId === layerId || descendants.has(parentId)) && !descendants.has(layer.id)) {
        descendants.add(layer.id);
        changed = true;
      }
    }
  }
  return descendants;
};

export const canAttachLayer = (layers: RigLayer[], childId: string, parentId: string) => {
  if (!childId || !parentId || childId === parentId) return false;
  return !getAttachmentDescendants(layers, childId).has(parentId);
};

export const computeLayerTransforms = (project: RigProject, frameIndex = project.activeFrame): Map<string, RenderTransform> => {
  const animation = project.animations[project.activeAnimation];
  const frame = animation.frames[frameIndex] ?? animation.frames[0];
  const layersById = new Map(project.layers.map((layer) => [layer.id, layer]));
  const transforms = new Map<string, RenderTransform>();
  const visiting = new Set<string>();

  const compute = (layer: RigLayer): RenderTransform => {
    const cached = transforms.get(layer.id);
    if (cached) return cached;
    if (visiting.has(layer.id)) {
      const fallback: RenderTransform = {
        layer,
        matrix: composeBaseMatrix(layer, frame?.layers[layer.id]),
        opacity: layer.opacity * normalizeOffset(frame?.layers[layer.id]).dOpacity,
        circular: true,
      };
      transforms.set(layer.id, fallback);
      return fallback;
    }

    visiting.add(layer.id);
    const attachment = layer.attachment ? normalizeAttachment(layer.attachment) : undefined;
    const parent = attachment ? layersById.get(attachment.parentLayerId) : undefined;
    const parentTransform = parent ? compute(parent) : undefined;
    const offset = normalizeOffset(frame?.layers[layer.id]);
    const transform: RenderTransform = attachment && parentTransform && !parentTransform.circular
      ? {
          layer,
          matrix: composeAttachmentMatrix({ ...layer, attachment }, parentTransform, offset),
          opacity: layer.opacity * offset.dOpacity * (attachment.inheritOpacity ? parentTransform.opacity : 1),
          circular: false,
        }
      : {
          layer,
          matrix: composeBaseMatrix(layer, offset),
          opacity: layer.opacity * offset.dOpacity,
          circular: Boolean(attachment && !parentTransform),
        };
    visiting.delete(layer.id);
    transforms.set(layer.id, transform);
    return transform;
  };

  project.layers.forEach(compute);
  return transforms;
};

export const createAttachmentFromCurrentPlacement = (
  project: RigProject,
  childId: string,
  parentId: string,
): LayerAttachment | undefined => {
  if (!canAttachLayer(project.layers, childId, parentId)) return undefined;
  const child = project.layers.find((layer) => layer.id === childId);
  const parent = project.layers.find((layer) => layer.id === parentId);
  if (!child || !parent) return undefined;

  const transforms = computeLayerTransforms(project);
  const childTransform = transforms.get(childId);
  const parentTransform = transforms.get(parentId);
  if (!childTransform || !parentTransform) return undefined;

  const parentAnchorX = parent.pivotX;
  const parentAnchorY = parent.pivotY;
  const childAnchorX = child.pivotX;
  const childAnchorY = child.pivotY;
  const parentSocket = multiply(parentTransform.matrix, translate(parentAnchorX, parentAnchorY));
  const localMatrix = multiply(multiply(invert(parentSocket), childTransform.matrix), translate(childAnchorX, childAnchorY));
  const local = decomposeUniform(localMatrix);

  return {
    parentLayerId: parentId,
    parentAnchorX,
    parentAnchorY,
    childAnchorX,
    childAnchorY,
    localX: local.x,
    localY: local.y,
    localScale: local.scale,
    localRotation: local.rotation,
    inheritPosition: true,
    inheritRotation: true,
    inheritScale: true,
    inheritOpacity: true,
  };
};
