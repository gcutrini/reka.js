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

function cssColorToHex(color: string): number {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 0xffffff;
  ctx.fillStyle = color;
  const hex = ctx.fillStyle;
  return PIXI.utils.string2hex(hex);
}

type ShapeStyle = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

type RectProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  style: ShapeStyle;
  onClick?: () => void;
};

const RectGraphic = ({ x, y, width, height, style, onClick }: RectProps) => {
  const draw = React.useCallback(
    (g: PIXI.Graphics) => {
      console.log('draw rect', { x, y, width, height, style });
      g.clear();
      if (style.fill) {
        g.beginFill(cssColorToHex(style.fill));
      }
      if (style.stroke) {
        g.lineStyle(style.strokeWidth ?? 1, cssColorToHex(style.stroke));
      }
      g.drawRect(0, 0, width, height);
      g.endFill();
    },
    [style.fill, style.stroke, style.strokeWidth, width, height, x, y]
  );

  return (
    <Graphics
      x={x}
      y={y}
      draw={draw}
      interactive={!!onClick}
      pointertap={onClick}
    />
  );
};

type CircleProps = {
  x: number;
  y: number;
  r: number;
  style: ShapeStyle;
  onClick?: () => void;
};

const CircleGraphic = ({ x, y, r, style, onClick }: CircleProps) => {
  const draw = React.useCallback(
    (g: PIXI.Graphics) => {
      console.log('draw circle', { x, y, r, style });
      g.clear();
      if (style.fill) {
        g.beginFill(cssColorToHex(style.fill));
      }
      if (style.stroke) {
        g.lineStyle(style.strokeWidth ?? 1, cssColorToHex(style.stroke));
      }
      g.drawCircle(0, 0, r);
      g.endFill();
    },
    [style.fill, style.stroke, style.strokeWidth, r, x, y]
  );

  return (
    <Graphics
      x={x}
      y={y}
      draw={draw}
      interactive={!!onClick}
      pointertap={onClick}
    />
  );
};

export type CanvasRendererProps = {
  view: t.View;
};

export const CanvasRenderer = observer(({ view }: CanvasRendererProps) => {
  if (typeof window === 'undefined') {
    // Avoid rendering on the server to prevent useLayoutEffect warnings
    return null;
  }
  console.log('CanvasRenderer rendering', view);
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

        return (
          <RectGraphic
            key={index}
            x={x}
            y={y}
            width={width}
            height={height}
            style={{
              fill: style.fill ?? color,
              stroke: style.stroke,
              strokeWidth: style.strokeWidth,
            }}
            onClick={onClick}
          />
        );
      }
      if (v.tag === 'circle') {
        const { x = 0, y = 0, r = 0, color = 'black' } = (v as any).props;

        return (
          <CircleGraphic
            key={index}
            x={x}
            y={y}
            r={r}
            style={{
              fill: style.fill ?? color,
              stroke: style.stroke,
              strokeWidth: style.strokeWidth,
            }}
            onClick={onClick}
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
            style={{ fill: style.color ?? '#000000', fontSize: style.fontSize }}
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
    <Stage width={400} height={300} options={{ backgroundColor: 0xffffff }}>
      <Container>{renderView(view, 0)}</Container>
    </Stage>
  );
});
