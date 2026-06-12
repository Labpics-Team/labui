// Solid SSR fixture for the WC-SSR falsifier.
//  (1) NATIVE path: <lab-button> as an unknown element — Solid SSR emits the
//      tag shallowly, no Lit SSR runs (mirrors Next 15 shallow result).
//  (2) LIT-SSR path: @lit-labs/ssr declarative-shadow-DOM string via innerHTML.
import type { JSX } from 'solid-js';

export function App(props: { litSsrHtml: string }): JSX.Element {
  return (
    <>
      <section data-path="native">
        <h2>Solid native custom-element path</h2>
        {/* @ts-expect-error - lab-button is a custom element, not in Solid's JSX intrinsics */}
        <lab-button type="accent" kind="fill" data-testid="solid-native-accent">
          Accent fill
        </lab-button>
      </section>
      <section data-path="lit-ssr" innerHTML={props.litSsrHtml} />
    </>
  );
}
