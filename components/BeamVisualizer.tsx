import React, { useEffect, useRef } from 'react';
import { AppState } from '../types';

interface BeamVisualizerProps {
  state: AppState;
  units: { length: string; force: string };
}

export const BeamVisualizer: React.FC<BeamVisualizerProps> = ({ state, units }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to parent width
    const parent = canvas.parentElement;
    if (parent) {
       canvas.width = parent.clientWidth;
    }
    
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const padding = 40;
    const drawW = W - 2 * padding;
    const scale = drawW / state.beam.length;
    const y0 = H / 2 - 10; // Shift beam up slightly to make room for dimensions

    // Ruler/Dimension line Y positions
    const dimY = y0 + 60;

    // Beam
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#4b5563'; // Tailwind gray-600
    ctx.beginPath();
    ctx.moveTo(padding, y0);
    ctx.lineTo(padding + state.beam.length * scale, y0);
    ctx.stroke();

    // Helper to draw dimension lines
    const drawDimLine = (xVal: number, label: string = "") => {
        const xPos = padding + xVal * scale;
        
        // Vertical dashed drop line
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#9ca3af'; // gray-400
        ctx.beginPath();
        ctx.moveTo(xPos, y0 + 10);
        ctx.lineTo(xPos, dimY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Label
        ctx.fillStyle = '#4b5563';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`${xVal}${units.length}`, xPos, dimY + 12);
        if(label) {
             ctx.font = 'bold 10px Inter';
             ctx.fillText(label, xPos, dimY + 24);
        }
    };

    drawDimLine(0, "Inicio");
    drawDimLine(state.beam.length, "Fin");

    // Supports
    state.supports.forEach((s) => {
      const x = padding + s.x * scale;
      ctx.fillStyle = '#0d9488'; // Tailwind teal-600
      ctx.beginPath();
      ctx.moveTo(x, y0 + 4);
      ctx.lineTo(x - 8, y0 + 18);
      ctx.lineTo(x + 8, y0 + 18);
      ctx.fill();
      
      if (s.type === 'roller') {
        ctx.beginPath();
        ctx.arc(x - 5, y0 + 22, 3, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 5, y0 + 22, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
      if (s.type === 'fixed') {
        ctx.fillStyle = '#1f2937'; // gray-800
        ctx.fillRect(x - 12, y0 - 15, 4, 30);
        // hatches
        ctx.beginPath();
        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 1;
        for (let k = 0; k < 30; k += 5) {
          ctx.moveTo(x - 12, y0 - 15 + k);
          ctx.lineTo(x - 18, y0 - 10 + k);
        }
        ctx.stroke();
      }
      drawDimLine(s.x, s.id);
    });

    // Loads
    const drawArrow = (fx: number, fy: number, tx: number, ty: number) => {
      const head = 8;
      const angle = Math.atan2(ty - fy, tx - fx);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(
        tx - head * Math.cos(angle - Math.PI / 6),
        ty - head * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        tx - head * Math.cos(angle + Math.PI / 6),
        ty - head * Math.sin(angle + Math.PI / 6)
      );
      ctx.fill();
    };

    state.loads.forEach((L) => {
      ctx.fillStyle = '#dc2626'; // red-600
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;

      if (L.type === 'point') {
        const x = padding + (L.x || 0) * scale;
        const isDown = (L.magnitude || 0) < 0;
        
        if (isDown) drawArrow(x, y0 - 40, x, y0 - 5);
        else drawArrow(x, y0 + 5, x, y0 + 40); 

        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`${Math.abs(L.magnitude || 0)}${units.force}`, x + 5, y0 - 25);
        drawDimLine(L.x || 0, L.id);
      }
      
      if (L.type === 'udl') {
        const x1 = padding + (L.x_start || 0) * scale;
        const x2 = padding + (L.x_end || 0) * scale;
        ctx.globalAlpha = 0.2;
        ctx.fillRect(x1, y0 - 25, x2 - x1, 20);
        ctx.globalAlpha = 1.0;
        ctx.strokeRect(x1, y0 - 25, x2 - x1, 20);
        
        // arrows
        const step = Math.max(10, (x2 - x1) / 5);
        for (let i = x1 + step / 2; i < x2; i += step) {
           drawArrow(i, y0 - 25, i, y0 - 5);
        }
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(`w=${Math.abs(L.w || 0)}`, x1 + (x2-x1)/2, y0 - 30);
        
        drawDimLine(L.x_start || 0);
        drawDimLine(L.x_end || 0);
      }

      if (L.type === 'moment') {
          const x = padding + (L.x || 0) * scale;
          ctx.beginPath();
          ctx.arc(x, y0, 15, 0, 1.5 * Math.PI);
          ctx.stroke();
          ctx.font = 'bold 11px Inter';
          ctx.fillText(`M=${L.magnitude}`, x - 20, y0 - 20);
          drawDimLine(L.x || 0, L.id);
      }
    });

  }, [state, units]);

  return <canvas ref={canvasRef} height={180} className="w-full bg-white rounded-lg shadow-sm" />;
};