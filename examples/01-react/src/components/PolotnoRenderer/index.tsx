import { observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as React from 'react';
import { Frame } from '@rekajs/core';
import { reaction, comparer } from 'mobx';
import { createStore } from 'polotno/model/store';
import { Workspace } from 'polotno/canvas/workspace';

const store = createStore({ key: 'reka-demo', showCredit: false });

export type PolotnoRendererProps = {
  frame: Frame;
};

export const PolotnoRenderer = observer(({ frame }: PolotnoRendererProps) => {
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
            custom: { rekaTplId: v.template.id },
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
            custom: { rekaTplId: v.template.id },
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

    if (frame.view) {
      renderView(frame.view);
    }
  }, [frame.view]);

  React.useEffect(() => {
    if (!frame) return;
    const disposer = reaction(
      () =>
        store.activePage?.children.map((el) => ({
          id: el.id,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          visible: el.visible,
          rekaTplId: (el as any).custom?.rekaTplId,
        })),
      (elements) => {
        frame.reka.change(() => {
          elements.forEach((el) => {
            if (!el.rekaTplId) return;
            const tpl = frame.reka.getNodeFromId(el.rekaTplId, t.TagTemplate);
            if (!tpl) return;
            tpl.props = {
              ...tpl.props,
              x: t.literal({ value: el.x }),
              y: t.literal({ value: el.y }),
              width:
                el.width !== undefined
                  ? t.literal({ value: el.width })
                  : tpl.props?.width,
              height:
                el.height !== undefined
                  ? t.literal({ value: el.height })
                  : tpl.props?.height,
              rotation:
                el.rotation !== undefined
                  ? t.literal({ value: el.rotation })
                  : tpl.props?.rotation,
              visible:
                el.visible !== undefined
                  ? t.literal({ value: el.visible })
                  : tpl.props?.visible,
            };
          });
        });
      },
      { equals: comparer.structural }
    );
    return () => disposer();
  }, [frame]);

  return <Workspace store={store} />;
});
