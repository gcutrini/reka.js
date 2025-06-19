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
    if (!canvas) {
      console.warn('Canvas element not found');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Could not get 2d context');
      return;
    }

    console.log('CanvasRenderer mounted. Drawing view:', view);

    const disposer = autorun(() => {
      console.log('View changed, redrawing');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const draw = (v: t.View) => {
        if (v instanceof t.TagView) {
          if (v.tag === 'rect') {
            const { x = 0, y = 0, width = 0, height = 0, color = 'black' } =
              v.props as any;
            console.log('Drawing rect', { x, y, width, height, color });
            ctx.fillStyle = color;
            ctx.fillRect(x, y, width, height);
          } else if (v.tag === 'circle') {
            const { x = 0, y = 0, r = 0, color = 'black' } = v.props as any;
            console.log('Drawing circle', { x, y, r, color });
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
      console.log('CanvasRenderer cleanup');
      disposer();
    };
  }, [view]);

  return <canvas ref={canvasRef} width={400} height={300} />;
});
