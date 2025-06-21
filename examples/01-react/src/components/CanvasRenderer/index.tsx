import { Stage, Container, Graphics, Text } from '@pixi/react';
import { observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as PIXI from 'pixi.js';
import * as React from 'react';

const styleCache: Record<
  string,
  Partial<{
    fill: string;
    stroke: string;
    strokeWidth: number;
    color: string;
    fontSize: number;
  }>
> = {};

function styleForClassName(className?: string) {
  if (!className) return {};
  if (styleCache[className]) return styleCache[className]!;
  const el = document.createElement('div');
  el.className = className;
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  document.body.appendChild(el);
  const computed = window.getComputedStyle(el);
  const style = {
    fill:
      computed.backgroundColor &&
      computed.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? computed.backgroundColor
        : undefined,
    stroke:
      computed.borderStyle !== 'none' && computed.borderColor
        ? computed.borderColor
        : undefined,
    strokeWidth: parseFloat(computed.borderWidth) || undefined,
    color: computed.color || undefined,
    fontSize: parseFloat(computed.fontSize) || undefined,
  };
  document.body.removeChild(el);
  styleCache[className] = style;
  return style;
}

export type CanvasRendererProps = {
  view: t.View;
};

export const CanvasRenderer = observer(({ view }: CanvasRendererProps) => {
  if (typeof window === 'undefined') {
    // Avoid rendering on the server to prevent useLayoutEffect warnings
    return null;
  }
  React.useEffect(() => {
    console.log('CanvasRenderer mounted. root view:', view);
    return () => console.log('CanvasRenderer unmounted');
  }, [view]);

  let yCursor = 0;
  const nextY = () => {
    const y = yCursor;
    yCursor += 20;
    return y;
  };

  const renderView = (v: t.View, index: number): React.ReactNode => {
    console.log('Rendering node', v);
    if (v.type === 'TagView') {
      const onClick = (v as any).props?.onClick;
      const className = (v as any).props?.className as string | undefined;
      const style = styleForClassName(className);
      if (v.tag === 'rect') {
        const {
          x = 0,
          y = 0,
          width = 0,
          height = 0,
          color = 'black',
        } = (v as any).props;

        const draw = (g: PIXI.Graphics) => {
          g.clear();
          if (style.fill ?? color) {
            g.beginFill(PIXI.utils.string2hex(style.fill ?? color));
          }
          if (style.stroke) {
            g.lineStyle(
              style.strokeWidth ?? 1,
              PIXI.utils.string2hex(style.stroke)
            );
          }
          g.drawRect(x, y, width, height);
          g.endFill();
        };

        return (
          <Graphics
            key={index}
            draw={draw}
            interactive={!!onClick}
            pointertap={onClick}
          />
        );
      }
      if (v.tag === 'circle') {
        const { x = 0, y = 0, r = 0, color = 'black' } = (v as any).props;

        const draw = (g: PIXI.Graphics) => {
          g.clear();
          if (style.fill ?? color) {
            g.beginFill(PIXI.utils.string2hex(style.fill ?? color));
          }
          if (style.stroke) {
            g.lineStyle(
              style.strokeWidth ?? 1,
              PIXI.utils.string2hex(style.stroke)
            );
          }
          g.drawCircle(x, y, r);
          g.endFill();
        };

        return (
          <Graphics
            key={index}
            draw={draw}
            interactive={!!onClick}
            pointertap={onClick}
          />
        );
      }
      if (v.tag === 'text') {
        const { value = '' } = (v as any).props;
        return (
          <Text
            key={index}
            x={0}
            y={nextY()}
            text={String(value)}
            interactive={!!onClick}
            pointertap={onClick}
            style={{ fill: style.color, fontSize: style.fontSize }}
          />
        );
      }
      return (
        <Container key={index} interactive={!!onClick} pointertap={onClick}>
          {(v as any).children.map(renderView)}
        </Container>
      );
    }

    if (v.type === 'RekaComponentView' || v.type === 'ExternalComponentView') {
      return (
        <React.Fragment key={index}>
          {(v as any).render.map(renderView)}
        </React.Fragment>
      );
    }

    if (
      v.type === 'FrameView' ||
      v.type === 'SlotView' ||
      v.type === 'FragmentView'
    ) {
      return (
        <React.Fragment key={index}>
          {(v as any).children.map(renderView)}
        </React.Fragment>
      );
    }

    return null;
  };

  return (
    <Stage width={400} height={300}>
      <Container>{renderView(view, 0)}</Container>
    </Stage>
  );
});
