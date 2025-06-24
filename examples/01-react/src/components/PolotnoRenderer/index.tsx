import { observer } from '@rekajs/react';
import { Frame } from '@rekajs/core';
import * as t from '@rekajs/types';
import * as React from 'react';
import { reaction, comparer } from 'mobx';
import { createStore } from 'polotno/model/store';
import { Workspace } from 'polotno/canvas/workspace';

const store = createStore({ key: 'reka-demo', showCredit: false });

export type PolotnoRendererProps = {
  frame: Frame;
};

export const PolotnoRenderer = observer(({ frame }: PolotnoRendererProps) => {
  const updatingFromRekaRef = React.useRef(false);
  const updatingFromPolotnoRef = React.useRef(false);

  const syncFromReka = React.useCallback(() => {
    updatingFromRekaRef.current = true;

    const page = store.activePage || store.addPage();
    const existing: Record<string, any> = {};
    page.children.forEach((el) => {
      const tplId = (el as any).custom?.rekaTplId;
      if (tplId) {
        existing[tplId] = el;
      }
    });

    const activeTplIds = new Set<string>();

    const renderView = (v: t.View) => {
      if (v.type === 'TagView') {
        const props = (v as any).props || {};
        const tplId = v.template.id;
        activeTplIds.add(tplId);
        let el = existing[tplId];

        if (!el) {
          if (v.tag === 'text') {
            el = page.addElement({
              type: 'text',
              text: String(props.value ?? ''),
              x: props.x ?? 0,
              y: props.y ?? 0,
              fill: props.color ?? 'black',
              fontSize: props.fontSize ?? 16,
              custom: { rekaTplId: tplId },
            });
          } else if (v.tag === 'rect') {
            el = page.addElement({
              type: 'figure',
              subType: 'rect',
              x: props.x ?? 0,
              y: props.y ?? 0,
              width: props.width ?? 0,
              height: props.height ?? 0,
              fill: props.color ?? 'black',
              custom: { rekaTplId: tplId },
            });
          }
        } else {
          el.set({
            x: props.x ?? el.x,
            y: props.y ?? el.y,
            width: props.width ?? el.width,
            height: props.height ?? el.height,
            rotation: props.rotation ?? el.rotation,
            visible: props.visible ?? el.visible,
          });
          if (v.tag === 'text') {
            el.set({
              text: String(props.value ?? ''),
              fontSize: props.fontSize ?? el.fontSize,
              fill: props.color ?? el.fill,
            });
          }
        }
      } else if (v.type === 'RekaComponentView' || v.type === 'ExternalComponentView') {
        (v as any).render.forEach(renderView);
      } else if (v.type === 'FrameView' || v.type === 'SlotView' || v.type === 'FragmentView') {
        (v as any).children.forEach(renderView);
      }
    };

    if (frame.view) {
      renderView(frame.view);
    }

    // remove elements that no longer exist
    page.children.slice().forEach((el) => {
      const tplId = (el as any).custom?.rekaTplId;
      if (tplId && !activeTplIds.has(tplId)) {
        page.removeElement(el.id);
      }
    });

    updatingFromRekaRef.current = false;
  }, [frame]);

  React.useEffect(() => {
    syncFromReka();

    const unsubscribe = frame.listenToChangeset(() => {
      if (updatingFromPolotnoRef.current) return;
      syncFromReka();
    });

    return () => {
      unsubscribe();
    };
  }, [frame, syncFromReka]);

  React.useEffect(() => {
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
        updatingFromPolotnoRef.current = true;
        frame.reka.change(() => {
          const appComponent = frame.reka.state.program.components.find(
            (c) => c.name === frame.componentName
          );
          const rootTpl = appComponent?.template as t.TagTemplate | undefined;
          const seen = new Set<string>();

          elements.forEach((el) => {
            let tpl =
              el.rekaTplId && frame.reka.getNodeFromId(el.rekaTplId, t.TagTemplate);

            if (!tpl && rootTpl) {
              if (el.type === 'text') {
                tpl = t.tagTemplate({
                  tag: 'text',
                  props: { value: t.literal({ value: el.text ?? '' }) },
                  children: [],
                });
              } else if (el.type === 'figure' && el.subType === 'rect') {
                tpl = t.tagTemplate({ tag: 'rect', props: {}, children: [] });
              }
              if (tpl) {
                rootTpl.children.push(tpl);
                (el as any).custom = { ...(el as any).custom, rekaTplId: tpl.id };
              }
            }

            if (!tpl) return;

            tpl.props = {
              ...tpl.props,
              x: t.literal({ value: el.x }),
              y: t.literal({ value: el.y }),
              width: el.width !== undefined ? t.literal({ value: el.width }) : tpl.props?.width,
              height: el.height !== undefined ? t.literal({ value: el.height }) : tpl.props?.height,
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
                fontSize:
                  el.fontSize !== undefined ? t.literal({ value: el.fontSize }) : tpl.props?.fontSize,
              } as any;
            }
            seen.add(tpl.id);
          });

          if (rootTpl) {
            rootTpl.children = rootTpl.children.filter((child) => seen.has(child.id));
          }
        });
        updatingFromPolotnoRef.current = false;
      },
      { fireImmediately: true, equals: comparer.structural }
    );
    return () => disposer();
  }, [frame]);

  return <Workspace style={{ width: '100%', height: '100%' }} store={store} />;
});
