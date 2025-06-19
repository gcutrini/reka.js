import { Reka } from '@rekajs/core';
import { RekaProvider, observer } from '@rekajs/react';
import * as t from '@rekajs/types';
import * as React from 'react';

import { CanvasRenderer } from '@/components/CanvasRenderer';

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

const frame = reka.createFrame({
  id: 'Canvas Demo',
  component: { name: 'App' },
});

const CanvasView = observer(() => {
  return frame.view ? <CanvasRenderer view={frame.view} /> : null;
});

export default function CanvasPage() {
  return (
    <RekaProvider reka={reka}>
      <CanvasView />
    </RekaProvider>
  );
}
