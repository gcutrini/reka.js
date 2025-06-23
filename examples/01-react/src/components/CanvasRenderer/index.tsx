import { Frame } from '@rekajs/core';
import { observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as React from 'react';
import { Stage, Layer, Rect, Circle, Group, Text } from 'react-konva';

const STAGE_WIDTH = 400;
const STAGE_HEIGHT = 300;

type StyleInfo = {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  color?: string;
  fontSize?: number;
  width?: number;
  height?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  marginTop?: number;
  marginBottom?: number;
};

const styleCache: Record<string, Partial<StyleInfo>> = {};

function parseTailwindStyles(className: string): Partial<StyleInfo> {
  const style: Partial<StyleInfo> = {};
  for (const cls of className.split(/\s+/)) {
    if (cls === 'w-full') {
      style.width = STAGE_WIDTH;
    } else if (cls === 'h-full') {
      style.height = STAGE_HEIGHT;
    } else if (/^w-(\d+)$/.test(cls)) {
      style.width = parseInt(cls.slice(2)) * 4;
    } else if (/^h-(\d+)$/.test(cls)) {
      style.height = parseInt(cls.slice(2)) * 4;
    } else if (/^px-(\d+)$/.test(cls)) {
      const v = parseInt(cls.slice(3)) * 4;
      style.paddingLeft = v;
      style.paddingRight = v;
    } else if (/^py-(\d+)$/.test(cls)) {
      const v = parseInt(cls.slice(3)) * 4;
      style.paddingTop = v;
      style.paddingBottom = v;
    } else if (/^mt-(\d+)$/.test(cls)) {
      style.marginTop = parseInt(cls.slice(3)) * 4;
    } else if (/^mb-(\d+)$/.test(cls)) {
      style.marginBottom = parseInt(cls.slice(3)) * 4;
    } else if (cls === 'text-lg') {
      style.fontSize = 18;
    } else if (cls === 'border-2') {
      style.strokeWidth = 2;
    }
  }
  return style;
}

function styleForClassName(className?: string): Partial<StyleInfo> {
  if (!className) return {};
  if (styleCache[className]) return styleCache[className]!;

  const tailwind = parseTailwindStyles(className);

  const el = document.createElement('div');
  el.className = className;
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  document.body.appendChild(el);
  const computed = window.getComputedStyle(el);
  const borderWidth = parseFloat(computed.borderWidth);
  const fontSize = parseFloat(computed.fontSize);
  const style: Partial<StyleInfo> = {
    fill:
      computed.backgroundColor &&
      computed.backgroundColor !== 'rgba(0, 0, 0, 0)'
        ? computed.backgroundColor
        : undefined,
    stroke:
      computed.borderStyle !== 'none' && computed.borderColor
        ? computed.borderColor
        : undefined,
    strokeWidth:
      tailwind.strokeWidth ?? (!isNaN(borderWidth) ? borderWidth : undefined),
    color: computed.color || undefined,
    fontSize: tailwind.fontSize ?? (!isNaN(fontSize) ? fontSize : undefined),
  };

  Object.assign(style, tailwind);

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

  type RenderResult = { node: React.ReactNode; width: number; height: number };

  const renderView = (v: t.View, x: number, y: number): RenderResult => {
    if (v instanceof t.TagView) {
      const onClick = (v as any).props?.onClick;
      const className = (v as any).props?.className as string | undefined;
      const style = styleForClassName(className);

      const propX = (v as any).props?.x;
      const propY = (v as any).props?.y;

      let localX = x + (typeof propX === 'number' ? propX : parseFloat(propX) || 0);
      let localY = y + (typeof propY === 'number' ? propY : parseFloat(propY) || 0);

      if (style.paddingLeft) localX += style.paddingLeft;
      if (style.paddingTop) localY += style.paddingTop;

      if (v.tag === 'rect') {
        const {
          width = style.width ?? 0,
          height = style.height ?? 0,
          color = 'black',
        } = (v as any).props;

        return {
          node: (
            <Rect
              key={v.id}
              x={localX}
              y={localY}
              width={width}
              height={height}
              fill={style.fill ?? color}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              onClick={onClick}
            />
          ),
          width,
          height,
        };
      }

      if (v.tag === 'circle') {
        const { r = 0, color = 'black' } = (v as any).props;
        const radius = r;
        return {
          node: (
            <Circle
              key={v.id}
              x={localX}
              y={localY}
              radius={radius}
              fill={style.fill ?? color}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              onClick={onClick}
            />
          ),
          width: radius * 2,
          height: radius * 2,
        };
      }

      if (v.tag === 'text') {
        const { value = '' } = (v as any).props;
        const fontSize = style.fontSize || 14;
        return {
          node: (
            <Text
              key={v.id}
              x={localX}
              y={localY}
              text={String(value)}
              onClick={onClick}
              fill={style.color}
              fontSize={fontSize}
            />
          ),
          width: 0,
          height: fontSize,
        };
      }

      let childY = localY;
      const childrenNodes: React.ReactNode[] = [];
      let maxWidth = 0;
      for (const child of v.children) {
        const res = renderView(child, localX, childY);
        childY += res.height + (style.marginBottom ?? 0);
        maxWidth = Math.max(maxWidth, res.width);
        childrenNodes.push(res.node);
      }
      const totalHeight = childY - y;

      return {
        node: (
          <Group key={v.id} onClick={onClick}>
            {childrenNodes}
          </Group>
        ),
        width: maxWidth,
        height: totalHeight,
      };
    }

    if (v instanceof t.RekaComponentView) {
      const results = v.render.map((r) => renderView(r, x, y));
      return {
        node: (
          <React.Fragment key={v.id}>
            {results.map((r) => r.node)}
          </React.Fragment>
        ),
        width: Math.max(...results.map((r) => r.width)),
        height: results.reduce((sum, r) => sum + r.height, 0),
      };
    }

    if (v instanceof t.ExternalComponentView) {
      return {
        node: v.component.render(v.props),
        width: 0,
        height: 0,
      };
    }

    if (
      v instanceof t.FrameView ||
      v instanceof t.SlotView ||
      v instanceof t.FragmentView
    ) {
      const results = v.children.map((child) => renderView(child, x, y));
      return {
        node: (
          <React.Fragment key={v.id}>
            {results.map((r) => r.node)}
          </React.Fragment>
        ),
        width: Math.max(...results.map((r) => r.width)),
        height: results.reduce((sum, r) => sum + r.height, 0),
      };
    }

    if (v instanceof t.ErrorSystemView) {
      const fontSize = 14;
      return {
        node: (
          <Group key={v.id}>
            <Text text={`Something went wrong. ${v.error}`} fontSize={fontSize} />
          </Group>
        ),
        width: 0,
        height: fontSize,
      };
    }

    return { node: null, width: 0, height: 0 };
  };

  const { node } = renderView(view, 0, 0);

  return (
    <Stage width={STAGE_WIDTH} height={STAGE_HEIGHT}>
      <Layer>{node}</Layer>
    </Stage>
  );
});

export type RenderFrameProps = {
  frame: Frame;
};

export const RenderFrame = observer((props: RenderFrameProps) => {
  if (!props.frame.view) {
    return null;
  }

  return <CanvasRenderer view={props.frame.view} />;
});
