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
    const activeIds = new Set<string>();

    const renderView = (v: t.View) => {
      if (v.type === 'TagView') {
        const props = (v as any).props || {};
        const tplId = v.template.id;

        if (v.tag === 'text' || v.tag === 'rect') {
          activeIds.add(tplId);
          let el = page.children.find((c) => c.id === tplId);

          if (!el) {
            if (v.tag === 'text') {
              el = page.addElement({
                type: 'text',
                id: tplId,
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
                id: tplId,
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
            } else if (v.tag === 'rect') {
              el.set({
                fill: props.color ?? el.fill,
              });
            }
            el.set({ custom: { ...(el as any).custom, rekaTplId: tplId } });
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
      const tplId = (el as any).custom?.rekaTplId;
      if (tplId && !activeIds.has(tplId)) {
        store.deleteElements([el.id]);
      }
    });

    updatingFromRekaRef.current = false;
  }, [frame]);

  React.useEffect(() => {
    syncFromReka();

    const unsubscribe = frame.listenToChangeset(() => {
      const fromPolotno = updatingFromPolotnoRef.current;
      frame.compute(true, () => {
        if (!fromPolotno) {
          syncFromReka();
        }
      });
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
            fill: (el as any).fill,
            fontSize: (el as any).fontSize,
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

          elements.forEach(({ el, snapshot }) => {
            const tplId = snapshot.id;
            let tpl = frame.reka.getNodeFromId(tplId, t.TagTemplate);

            if (!tpl && rootTpl) {
              if (snapshot.type === 'text') {
                tpl = t.tagTemplate({
                  tag: 'text',
                  props: {
                    value: t.literal({ value: snapshot.text ?? '' }),
                    color: t.literal({ value: snapshot.fill ?? 'black' }),
                    fontSize:
                      snapshot.fontSize !== undefined
                        ? t.literal({ value: snapshot.fontSize })
                        : undefined,
                  },
                  children: [],
                });
              } else if (
                snapshot.type === 'figure' &&
                snapshot.subType === 'rect'
              ) {
                tpl = t.tagTemplate({
                  tag: 'rect',
                  props: {
                    color: t.literal({ value: snapshot.fill ?? 'black' }),
                  },
                  children: [],
                });
              }
              if (tpl) {
                rootTpl.children.push(tpl);
                el.set({
                  custom: { ...(el as any).custom, rekaTplId: tpl.id },
                });
              }
            }

            if (!tpl) return;

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
              color:
                snapshot.fill !== undefined
                  ? t.literal({ value: snapshot.fill })
                  : tpl.props?.color,
            } as any;
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
