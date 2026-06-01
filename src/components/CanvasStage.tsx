import { PointerEvent, useEffect, useRef, useState } from 'react';
import { RigProject } from '../types/rig';
import { drawProjectFrame, hitTestLayer } from '../lib/canvasRender';

interface CanvasStageProps {
  project: RigProject;
  selectedLayerId?: string;
  onSelectLayer: (id: string) => void;
  onMoveLayer: (id: string, dx: number, dy: number) => void;
}

export function CanvasStage({ project, selectedLayerId, onSelectLayer, onMoveLayer }: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);

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
    const point = canvasPoint(event);
    const hit = [...project.layers].reverse().find((layer) => hitTestLayer(layer, point.x, point.y));
    if (!hit) return;
    onSelectLayer(hit.id);
    setDrag({ id: hit.id, x: point.x, y: point.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drag) return;
    const point = canvasPoint(event);
    onMoveLayer(drag.id, point.x - drag.x, point.y - drag.y);
    setDrag({ ...drag, x: point.x, y: point.y });
  };

  return (
    <section className="stageWrap">
      <div className="stageHeader">
        <h2>1024×1024 Stage</h2>
        <span>{selectedLayerId ? 'Drag selected artwork. Use layer controls for pivot, scale, rotation, and opacity.' : 'Upload and select a layer.'}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="stageCanvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      />
    </section>
  );
}
