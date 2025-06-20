import { observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as React from 'react';
import { Stage, Layer, Rect, Circle, Group, Text } from 'react-konva';

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
            key={index}
            x={x}
            y={y}
            width={width}
            height={height}
            fill={color}
            onClick={onClick}
          />
        );
      }
      if (v.tag === 'circle') {
        const { x = 0, y = 0, r = 0, color = 'black' } = (v as any).props;
        return (
          <Circle
            key={index}
            x={x}
            y={y}
            radius={r}
            fill={color}
            onClick={onClick}
          />
        );
      }
      if (v.tag === 'text') {
        const { value = '' } = (v as any).props;
        return (
          <Text key={index} x={0} y={nextY()} text={String(value)} onClick={onClick} />
        );
      }
      return (
        <Group key={index} onClick={onClick}>
          {(v as any).children.map(renderView)}
        </Group>
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
      <Layer>{renderView(view, 0)}</Layer>
    </Stage>
  );
});
