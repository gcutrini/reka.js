import { Reka } from '@rekajs/core';
import { RekaProvider, observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as React from 'react';

import dynamic from 'next/dynamic';

// react-konva relies on the browser DOM APIs. Disable SSR for the renderer.
// The component is a named export, so we must resolve it from the module.
const CanvasRenderer = dynamic(
  () => import('@/components/CanvasRenderer').then((m) => m.CanvasRenderer),
  {
    ssr: false,
  }
);
import { Editor } from '@/components/Editor';

const reka = Reka.create();

reka.load(
  t.state({
    program: t.program({
      components: [
        t.rekaComponent({
          name: 'App',
          props: [],
          state: [],
          template: t.tagTemplate({
            tag: 'div',
            props: {},
            children: [
              t.tagTemplate({
                tag: 'rect',
                props: {
                  x: t.literal({ value: 20 }),
                  y: t.literal({ value: 30 }),
                  width: t.literal({ value: 120 }),
                  height: t.literal({ value: 60 }),
                  color: t.literal({ value: 'red' }),
                },
                children: [],
              }),
              t.tagTemplate({
                tag: 'circle',
                props: {
                  x: t.literal({ value: 200 }),
                  y: t.literal({ value: 80 }),
                  r: t.literal({ value: 40 }),
                  color: t.literal({ value: 'blue' }),
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
