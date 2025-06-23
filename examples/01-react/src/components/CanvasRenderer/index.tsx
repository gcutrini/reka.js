import { Frame } from '@rekajs/core';
import { observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as React from 'react';
import { Stage, Layer, Rect, Circle, Group, Text } from 'react-konva';

const styleCache: Record<string, Partial<{
  fill: string;
  stroke: string;
  strokeWidth: number;
  color: string;
  fontSize: number;
}>> = {};

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

  let yCursor = 0;
  const nextY = () => {
    const y = yCursor;
    yCursor += 20;
    return y;
  };

  const renderView = (v: t.View): React.ReactNode => {
    if (v instanceof t.TagView) {
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
          <Rect
            key={v.id}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={style.fill ?? color}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            onClick={onClick}
          />
        );
      }
      if (v.tag === 'circle') {
        const { x = 0, y = 0, r = 0, color = 'black' } = (v as any).props;
        return (
          <Circle
            key={v.id}
            x={x}
            y={y}
            radius={r}
            fill={style.fill ?? color}
            stroke={style.stroke}
            strokeWidth={style.strokeWidth}
            onClick={onClick}
          />
        );
      }
      if (v.tag === 'text') {
        const { value = '' } = (v as any).props;
        return (
          <Text
            key={v.id}
            x={0}
            y={nextY()}
            text={String(value)}
            onClick={onClick}
            fill={style.color}
            fontSize={style.fontSize}
          />
        );
      }
      return (
        <Group key={v.id} onClick={onClick}>
          {v.children.map((child) => renderView(child))}
        </Group>
      );
    }

    if (v instanceof t.RekaComponentView) {
      return (
        <React.Fragment key={v.id}>
          {v.render.map((r) => renderView(r))}
        </React.Fragment>
      );
    }

    if (v instanceof t.ExternalComponentView) {
      return v.component.render(v.props);
    }

    if (
      v instanceof t.FrameView ||
      v instanceof t.SlotView ||
      v instanceof t.FragmentView
    ) {
      return (
        <React.Fragment key={v.id}>
          {v.children.map((child) => renderView(child))}
        </React.Fragment>
      );
    }
    if (v instanceof t.ErrorSystemView) {
      return (
        <Group key={v.id}>
          <Text text={`Something went wrong. ${v.error}`} />
        </Group>
      );
    }

    return null;
  };

  return (
    <Stage width={400} height={300}>
      <Layer>{renderView(view)}</Layer>
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
