import { observer } from '@rekajs/react';
import { Frame } from '@rekajs/core';
import * as t from '@rekajs/types';
import * as React from 'react';
import { reaction, comparer } from 'mobx';
import { createStore } from 'polotno/model/store';
import { Workspace } from 'polotno/canvas/workspace';

// Create a single Polotno store instance for the demo
const store = createStore({ key: 'reka-demo', showCredit: false });

export type PolotnoRendererProps = {
  frame: Frame;
};

// Synchronizes the Polotno store with a Reka Frame.  The mapping between
// elements in both editors is done via the unique view.id which ensures that
// duplicated elements are tracked independently.
export const PolotnoRenderer = observer(({ frame }: PolotnoRendererProps) => {
  const syncingFromReka = React.useRef(false);
  const syncingFromPolotno = React.useRef(false);
  // Maps Polotno element id -> Reka view id
  const viewIdMapRef = React.useRef(new Map<string, string>());

  // ----- Helpers -----

  // Render the Frame view into the Polotno store.  Each TagView with tag
  // "text" or "rect" becomes a Polotno element and stores the view id in the
  // element custom data.
  const syncFromReka = React.useCallback(() => {
    syncingFromReka.current = true;

    const page = store.activePage || store.addPage();

    // Map viewId -> existing Polotno element so we can update instead of
    // recreating them.
    const existing: Record<string, any> = {};
    page.children.forEach((el) => {
      const viewId = (el as any).custom?.rekaViewId;
      if (viewId) {
        existing[viewId] = el;
      }
    });

    const activeViewIds = new Set<string>();

    const renderView = (v: t.View) => {
      if (v.type === 'TagView') {
        const props = (v as any).props || {};
        const viewId = v.id;
        const tplId = v.template.id;

        if (v.tag === 'text' || v.tag === 'rect') {
          activeViewIds.add(viewId);
          let el = existing[viewId];

          if (!el) {
            if (v.tag === 'text') {
              el = page.addElement({
                type: 'text',
                text: String(props.value ?? ''),
                x: props.x ?? 0,
                y: props.y ?? 0,
                fill: props.color ?? 'black',
                fontSize: props.fontSize ?? 16,
                custom: { rekaViewId: viewId, rekaTplId: tplId },
              });
            } else {
              el = page.addElement({
                type: 'figure',
                subType: 'rect',
                x: props.x ?? 0,
                y: props.y ?? 0,
                width: props.width ?? 0,
                height: props.height ?? 0,
                fill: props.color ?? 'black',
                custom: { rekaViewId: viewId, rekaTplId: tplId },
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
            } else {
              el.set({ fill: props.color ?? el.fill });
            }

            el.set({
              custom: { ...(el as any).custom, rekaViewId: viewId, rekaTplId: tplId },
            });
          }

          if (el) {
            viewIdMapRef.current.set(el.id, viewId);
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

    // Remove Polotno elements that no longer have a corresponding view
    page.children.slice().forEach((el) => {
      const viewId = (el as any).custom?.rekaViewId;
      if (viewId && !activeViewIds.has(viewId)) {
        store.deleteElements([el.id]);
        viewIdMapRef.current.delete(el.id);
      }
    });

    syncingFromReka.current = false;
  }, [frame]);

  // ----- Effects -----

  // Whenever the Frame updates (from the Reka editor) we render the updated
  // view tree to Polotno.  We avoid doing this if the update originated from
  // Polotno to prevent infinite loops.
  React.useEffect(() => {
    syncFromReka();

    const unsubscribe = frame.listenToChangeset(() => {
      const fromPolotno = syncingFromPolotno.current;
      frame.compute(true, () => {
        if (!fromPolotno) {
          syncFromReka();
        }
      });
    });

    return () => unsubscribe();
  }, [frame, syncFromReka]);

  // Watch for changes inside the Polotno store and apply them back to the Reka
  // AST.  This reaction only runs when the user edits elements directly within
  // Polotno.
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
            viewId: viewIdMapRef.current.get(el.id) || (el as any).custom?.rekaViewId,
            tplId: (el as any).custom?.rekaTplId,
          },
        })),
      (elements) => {
        if (syncingFromReka.current) return;
        syncingFromPolotno.current = true;

        frame.reka.change(() => {
          const appComponent = frame.reka.state.program.components.find(
            (c) => c.name === frame.componentName
          );
          const rootTpl = appComponent?.template as t.TagTemplate | undefined;

          if (!rootTpl) return;

          const seen = new Set<string>();
          const nextMap = new Map<string, string>();

          elements.forEach(({ el, snapshot }) => {
            let tpl: t.TagTemplate | undefined;
            if (snapshot.viewId) {
              const view = frame.getViewFromId(snapshot.viewId, t.TagView);
              tpl = view?.template as t.TagTemplate | undefined;
            }

            // Reuse the template only once per sync. If the element was
            // duplicated, create a new template for it.
            if (!tpl || seen.has(tpl.id)) {
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
                el.set({ custom: { ...(el as any).custom, rekaTplId: tpl.id } });
              }
            }

            if (!tpl) return;

            seen.add(tpl.id);
            nextMap.set(snapshot.id, tpl.id);

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
                  snapshot.fontSize !== undefined
                    ? t.literal({ value: snapshot.fontSize })
                    : tpl.props?.fontSize,
              } as any;
            }
          });

          // Prune templates that no longer have a backing Polotno element
          const prune = (tpl: t.Template): boolean => {
            if (
              t.TagTemplate.is(tpl) &&
              (tpl.tag === 'text' || tpl.tag === 'rect')
            ) {
              return [...nextMap.values()].includes(tpl.id);
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

          viewIdMapRef.current = nextMap;
        });

        syncingFromPolotno.current = false;
      },
      { fireImmediately: false, equals: comparer.structural }
    );

    return () => disposer();
  }, [frame]);

  return <Workspace style={{ width: '100%', height: '100%' }} store={store} />;
});

