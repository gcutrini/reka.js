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
  const updatingFromRekaRef = React.useRef(false);
  React.useEffect(() => {
    updatingFromRekaRef.current = true;
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
    updatingFromRekaRef.current = false;
  }, [frame.view]);

  React.useEffect(() => {
    if (!frame) return;
    const disposer = reaction(
      () =>
        store.activePage?.children.map((el) => ({
          id: el.id,
          type: (el as any).type,
          subType: (el as any).subType,
          text: (el as any).text,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation: el.rotation,
          visible: el.visible,
          rekaTplId: (el as any).custom?.rekaTplId,
        })),
      (elements) => {
        if (updatingFromRekaRef.current) return;
        frame.reka.change(() => {
          elements.forEach((el) => {
            let tpl =
              el.rekaTplId &&
              frame.reka.getNodeFromId(el.rekaTplId, t.TagTemplate);
            const appComponent = frame.reka.state.program.components.find(
              (c) => c.name === frame.componentName
            );
            const rootTpl = appComponent?.template as t.TagTemplate | undefined;

            if (!tpl) {
              if (!rootTpl) return;
              if (el.type === 'text') {
                tpl = t.tagTemplate({
                  id: el.rekaTplId,
                  tag: 'text',
                  props: {
                    value: t.literal({ value: el.text ?? '' }),
                  },
                  children: [],
                });
              } else if (el.type === 'figure' && el.subType === 'rect') {
                tpl = t.tagTemplate({
                  id: el.rekaTplId,
                  tag: 'rect',
                  props: {},
                  children: [],
                });
              }

              if (tpl) {
                rootTpl.children.push(tpl);
                (el as any).custom = {
                  ...(el as any).custom,
                  rekaTplId: tpl.id,
                };
              }
            }

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

            if (tpl.tag === 'text') {
              tpl.props = {
                ...tpl.props,
                value: t.literal({ value: el.text ?? '' }),
              };
            }
          });
        });
      },
      { equals: comparer.structural }
    );
    return () => disposer();
  }, [frame]);

  return <Workspace style={{ width: '100%', height: '100%' }} store={store} />;
});
