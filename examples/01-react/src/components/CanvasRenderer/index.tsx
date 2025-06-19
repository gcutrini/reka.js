import { observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as React from 'react';
import { autorun } from 'mobx';

export type CanvasRendererProps = {
  view: t.View;
};

export const CanvasRenderer = observer(({ view }: CanvasRendererProps) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const disposer = autorun(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const draw = (v: t.View) => {
        if (v instanceof t.TagView) {
          if (v.tag === 'rect') {
            const { x = 0, y = 0, width = 0, height = 0, color = 'black' } =
              v.props as any;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, width, height);
          } else if (v.tag === 'circle') {
            const { x = 0, y = 0, r = 0, color = 'black' } = v.props as any;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }

          v.children.forEach(draw);
        } else if (
          v instanceof t.RekaComponentView ||
          v instanceof t.FrameView ||
          v instanceof t.SlotView ||
          v instanceof t.FragmentView
        ) {
          v.children.forEach(draw);
        }
      };

      draw(view);
    });

    return () => {
      disposer();
    };
  }, [view]);

  return <canvas ref={canvasRef} width={400} height={300} />;
});
