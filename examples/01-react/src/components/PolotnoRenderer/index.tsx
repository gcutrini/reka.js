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
      const viewKey = (el as any).custom?.rekaViewKey;
      if (viewKey) {
        existing[viewKey] = el;
      }
    });

    const activeViewKeys = new Set<string>();

    const renderView = (v: t.View) => {
      if (v.type === 'TagView') {
        const props = (v as any).props || {};
        const tplId = v.template.id;
        const viewKey = (v as any).key ?? tplId;

        if (v.tag === 'text' || v.tag === 'rect') {
          activeViewKeys.add(viewKey);
          let el = existing[viewKey];

          if (!el) {
            if (v.tag === 'text') {
              el = page.addElement({
                type: 'text',
                text: String(props.value ?? ''),
                x: props.x ?? 0,
                y: props.y ?? 0,
                fill: props.color ?? 'black',
                fontSize: props.fontSize ?? 16,
                custom: { rekaTplId: tplId, rekaViewKey: viewKey },
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
                custom: { rekaTplId: tplId, rekaViewKey: viewKey },
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
            el.set({
              custom: {
                ...(el as any).custom,
                rekaTplId: tplId,
                rekaViewKey: viewKey,
              },
            });
          }
        } else {
          (v as any).children?.forEach(renderView);
        }
      } else if (
        v.type === 'RekaComponentView' ||
        v.type === 'ExternalComponentView'
      ) {
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

    // remove elements that no longer exist
    page.children.slice().forEach((el) => {
      const viewKey = (el as any).custom?.rekaViewKey;
      if (viewKey && !activeViewKeys.has(viewKey)) {
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
          el,
          snapshot: {
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
          },
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

          const usedTplIds = new Set<string>();

          elements.forEach(({ el, snapshot }) => {
            let tpl =
              snapshot.rekaTplId &&
              !usedTplIds.has(snapshot.rekaTplId) &&
              frame.reka.getNodeFromId(snapshot.rekaTplId, t.TagTemplate);

            if (!tpl && rootTpl) {
              if (snapshot.type === 'text') {
                tpl = t.tagTemplate({
                  tag: 'text',
                  props: { value: t.literal({ value: snapshot.text ?? '' }) },
                  children: [],
                });
              } else if (
                snapshot.type === 'figure' &&
                snapshot.subType === 'rect'
              ) {
                tpl = t.tagTemplate({ tag: 'rect', props: {}, children: [] });
              }
              if (tpl) {
                rootTpl.children.push(tpl);
                el.set({
                  custom: { ...(el as any).custom, rekaTplId: tpl.id },
                });
              }
            }

            if (!tpl) return;

            usedTplIds.add(tpl.id);

            tpl.props = {
              ...tpl.props,
              x: t.literal({ value: snapshot.x }),
              y: t.literal({ value: snapshot.y }),
              width:
                snapshot.width !== undefined
                  ? t.literal({ value: snapshot.width })
                  : tpl.props?.width,
              height:
                snapshot.height !== undefined
                  ? t.literal({ value: snapshot.height })
                  : tpl.props?.height,
              rotation:
                snapshot.rotation !== undefined
                  ? t.literal({ value: snapshot.rotation })
                  : tpl.props?.rotation,
              visible:
                snapshot.visible !== undefined
                  ? t.literal({ value: snapshot.visible })
                  : tpl.props?.visible,
            };
            if (tpl.tag === 'text') {
              tpl.props = {
                ...tpl.props,
                value: t.literal({ value: snapshot.text ?? '' }),
                fontSize:
                  (snapshot as any).fontSize !== undefined
                    ? t.literal({ value: (snapshot as any).fontSize })
                    : tpl.props?.fontSize,
              } as any;
            }
            seen.add(tpl.id);
          });

          if (rootTpl) {
            const prune = (tpl: t.Template): boolean => {
              if (
                t.TagTemplate.is(tpl) &&
                (tpl.tag === 'text' || tpl.tag === 'rect')
              ) {
                return seen.has(tpl.id);
              }

              if (t.SlottableTemplate.is(tpl)) {
                tpl.children = tpl.children.filter(prune);

                Object.keys(tpl.slots).forEach((slot) => {
                  tpl.slots[slot] = tpl.slots[slot].filter(prune);
                });
              }

              return true;
            };

            rootTpl.children = rootTpl.children.filter(prune);
            Object.keys(rootTpl.slots).forEach((slot) => {
              rootTpl.slots[slot] = rootTpl.slots[slot].filter(prune);
            });
          }
        });
        updatingFromPolotnoRef.current = false;
      },
      { fireImmediately: false, equals: comparer.structural }
    );
    return () => disposer();
  }, [frame]);

  return <Workspace style={{ width: '100%', height: '100%' }} store={store} />;
});
