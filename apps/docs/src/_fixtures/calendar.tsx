import '../foundation.css';
import '@labpics/ui-core/calendar';
import type { LabCalendar } from '@labpics/ui-core/calendar';
import { Calendar, type CalendarProps } from '@labpics/ui-react/calendar';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

const dates = ['2024-05-15'];
const lit = document.createElement('lab-calendar');
lit.name = 'dates';
lit.today = '2024-05-15';
lit.defaultMonth = '2024-05-01';
lit.defaultValue = dates;
lit.events = { '2024-05-15': 7, '2024-05-16': 2, '2024-05-17': 5 };
document.querySelector('#lit')?.append(lit);
const reset = document.createElement('button');
reset.type = 'reset';
reset.textContent = 'Reset';
document.querySelector('#lit')?.append(reset);
const root = createRoot(document.querySelector('#react') as HTMLElement);
let props: CalendarProps = {
  name: 'dates',
  today: '2024-05-15',
  defaultMonth: '2024-05-01',
  defaultValue: dates,
  events: lit.events,
};
const render = () =>
  root.render(
    <form id="react-form">
      <h2>React</h2>
      <Calendar {...props} />
      <button type="reset">Reset</button>
    </form>,
  );
render();
const requests: unknown[] = [];
lit.addEventListener('value-change', (event) => requests.push((event as CustomEvent).detail.value));
lit.addEventListener('month-change', (event) => requests.push((event as CustomEvent).detail.month));

function Controlled({ accept, delay = 0 }: { accept: boolean; delay?: number }) {
  const [value, setValue] = useState(['2024-05-15']);
  const [month, setMonth] = useState('2024-05-01');
  return (
    <form id="react-form">
      <Calendar
        {...props}
        value={value}
        month={month}
        onValueChange={(next) => {
          requests.push(next);
          if (accept) setValue(next);
        }}
        onMonthChange={(next) => {
          requests.push(next);
          if (accept) {
            if (delay) setTimeout(() => setMonth(next), delay);
            else setMonth(next);
          }
        }}
      />
      <button type="reset">Reset</button>
    </form>
  );
}
Object.assign(window, {
  calendarFixture: {
    lit,
    set(next: Partial<CalendarProps>) {
      props = { ...props, ...next };
      render();
      for (const [key, value] of Object.entries(next)) if (key in lit) Reflect.set(lit, key, value);
      if ('readOnly' in next) lit.readonly = !!next.readOnly;
    },
    controlled(accept: boolean, delay = 0) {
      lit.value = ['2024-05-15'];
      lit.month = '2024-05-01';
      if (accept) {
        lit.addEventListener('value-change', (event) => {
          lit.value = (event as CustomEvent).detail.value;
        });
        lit.addEventListener('month-change', (event) => {
          const month = (event as CustomEvent).detail.month;
          if (delay)
            setTimeout(() => {
              lit.month = month;
            }, delay);
          else lit.month = month;
        });
      }
      root.render(<Controlled accept={accept} delay={delay} />);
    },
    requests,
  },
});
declare global {
  interface Window {
    calendarFixture: {
      lit: LabCalendar;
      set(props: Partial<CalendarProps>): void;
      controlled(accept: boolean, delay?: number): void;
      requests: unknown[];
    };
  }
}
