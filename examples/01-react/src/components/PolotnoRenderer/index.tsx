import { observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as React from 'react';
import { createStore } from 'polotno/model/store';
import { Workspace } from 'polotno/canvas/workspace';

const store = createStore({ key: 'reka-demo', showCredit: false });

export type PolotnoRendererProps = {
  view: t.View;
};

export const PolotnoRenderer = observer(({ view }: PolotnoRendererProps) => {
  React.useEffect(() => {
    store.clear();
    const page = store.addPage();

    let yCursor = 0;
    const nextY = () => {
      const y = yCursor;
      yCursor += 20;
      return y;
    };

    const renderView = (v: t.View) => {
      if (v.type === 'TagView') {
        const props = (v as any).props || {};
        if (v.tag === 'text') {
          page.addElement({
            type: 'text',
            text: String(props.value ?? ''),
            x: 0,
            y: nextY(),
            fill: props.color ?? 'black',
            fontSize: props.fontSize ?? 16,
          });
        } else if (v.tag === 'rect') {
          page.addElement({
            type: 'figure',
            subType: 'rect',
            x: props.x ?? 0,
            y: props.y ?? 0,
            width: props.width ?? 0,
            height: props.height ?? 0,
            fill: props.color ?? 'black',
          });
        } else {
          (v as any).children?.forEach(renderView);
        }
      } else if (v.type === 'RekaComponentView' || v.type === 'ExternalComponentView') {
        (v as any).render.forEach(renderView);
      } else if (
        v.type === 'FrameView' ||
        v.type === 'SlotView' ||
        v.type === 'FragmentView'
      ) {
        (v as any).children.forEach(renderView);
      }
    };

    renderView(view);
  }, [view]);

  return <Workspace store={store} />;
});
