import { Reka } from '@rekajs/core';
import { RekaProvider, observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as React from 'react';

import { Editor } from '@/components/Editor';

// Use a dynamic import so the renderer only loads on the client.
import dynamic from 'next/dynamic';

// Dynamically import the renderer so it's only executed on the client.
const CanvasRenderer = dynamic(
  () => import('@/components/CanvasRenderer').then((m) => m.CanvasRenderer),
  { ssr: false }
);

const reka = Reka.create();

reka.load(
  t.state({
    program: t.program({
      globals: [
        t.val({ name: 'globalText', init: t.literal({ value: 'Global Text!' }) }),
      ],
      components: [
        t.rekaComponent({
          name: 'App',
          props: [],
          state: [],
          template: t.tagTemplate({
            tag: 'div',
            props: {
              className: t.literal({
                value: 'bg-neutral-100 px-3 py-4 w-full h-full',
              }),
            },
            children: [
              t.tagTemplate({
                tag: 'h4',
                props: { className: t.literal({ value: 'text-lg w-full' }) },
                children: [
                  t.tagTemplate({
                    tag: 'text',
                    props: { value: t.literal({ value: 'Hello World' }) },
                    children: [],
                  }),
                ],
              }),
              t.componentTemplate({
                component: t.identifier({ name: 'Button' }),
                props: {},
                children: [],
              }),
            ],
          }),
        }),
        t.rekaComponent({
          name: 'Button',
          props: [
            t.componentProp({
              name: 'text',
              init: t.literal({ value: 'Click me!' }),
            }),
          ],
          state: [t.val({ name: 'counter', init: t.literal({ value: 0 }) })],
          template: t.tagTemplate({
            tag: 'button',
            props: {
              className: t.literal({ value: 'rounded border-2 px-3 py-2' }),
              onClick: t.func({
                params: [],
                body: t.block({
                  statements: [
                    t.assignment({
                      left: t.identifier({ name: 'counter' }),
                      operator: '+=',
                      right: t.literal({ value: 1 }),
                    }),
                  ],
                }),
              }),
            },
            children: [
              t.tagTemplate({
                tag: 'text',
                props: { value: t.identifier({ name: 'text' }) },
                children: [],
              }),
              t.tagTemplate({
                tag: 'text',
                props: {
                  value: t.binaryExpression({
                    left: t.literal({ value: ' -> ' }),
                    operator: '+',
                    right: t.identifier({ name: 'counter' }),
                  }),
                },
                children: [],
              }),
            ],
          }),
        }),
      ],
    }),
  })
);

console.log('Reka program loaded.');

const frame = reka.createFrame({
  id: 'Canvas Demo',
  component: { name: 'App' },
});
console.log('Frame created:', frame.id);
// Compute immediately so the initial view is ready for the first render
frame.compute(true);
console.log('Initial frame view:', frame.view);

const CanvasView = observer(() => {
  console.log('CanvasView render. frame.view:', frame.view);
  return frame.view ? <CanvasRenderer view={frame.view} /> : null;
});

export default function CanvasPage() {
  React.useEffect(() => {
    console.log('Canvas page mounted. Current frame view:', frame.view);
  }, []);

  return (
    <RekaProvider reka={reka}>
      <div className="flex h-screen">
        <div className="w-3/6 h-full border-r-2">
          <Editor />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <CanvasView />
        </div>
      </div>
    </RekaProvider>
  );
}
