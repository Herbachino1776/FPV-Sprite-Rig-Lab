import { PointerEvent, useEffect, useRef, useState } from 'react';
import { RigProject } from '../types/rig';
import { drawProjectFrame, hitTestLayer } from '../lib/canvasRender';
import { computeLayerTransforms } from '../lib/layerTransforms';

interface CanvasStageProps {
  project: RigProject;
  selectedLayerId?: string;
  onSelectLayer: (id: string) => void;
  onMoveLayer: (id: string, dx: number, dy: number) => void;
}

export function CanvasStage({ project, selectedLayerId, onSelectLayer, onMoveLayer }: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; pointerId: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = project.settings.frameWidth;
    canvas.height = project.settings.frameHeight;
    drawProjectFrame(ctx, project, { includeBackground: true, onionSkin: project.onionSkin }).catch(console.error);
  }, [project]);

  const canvasPoint = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * project.settings.frameWidth,
      y: ((event.clientY - rect.top) / rect.height) * project.settings.frameHeight,
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const point = canvasPoint(event);
    const transforms = computeLayerTransforms(project);
    const hit = [...project.layers]
      .sort((a, b) => b.order - a.order)
      .find((layer) => {
        const transform = transforms.get(layer.id);
        return transform ? hitTestLayer(layer, point.x, point.y, transform.matrix) : false;
      });
    if (!hit) return;
    onSelectLayer(hit.id);
    setDrag({ id: hit.id, x: point.x, y: point.y, pointerId: event.pointerId });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const point = canvasPoint(event);
    onMoveLayer(drag.id, point.x - drag.x, point.y - drag.y);
    setDrag({ ...drag, x: point.x, y: point.y });
  };

  const finishDrag = (event: PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDrag(null);
  };

  return (
    <section className="stageWrap canvasStage">
      <div className="stageHeader">
        <h2>1024×1024 Stage</h2>
        <span>{selectedLayerId ? 'Drag selected artwork. Attached layers move by local hand offset.' : 'Upload and select a layer.'}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="stageCanvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      />
    </section>
  );
}
