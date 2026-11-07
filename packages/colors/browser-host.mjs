import { projectTheme, themePropertyNames } from './program.mjs';

function pointSignature(points, composites) {
  const paints = points.map(({ slot, sinkOutput, source, opacity }) => [
    slot,
    sinkOutput,
    [...source],
    opacity,
  ]);
  const roots = composites.map(({ root, scenario, source }) => [root, scenario, [...source]]);
  paints.sort((a, b) => a[0] - b[0]);
  roots.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return JSON.stringify([paints, roots]);
}

export function createAtomicHost({ authority, program, selected, overrides }) {
  const names = themePropertyNames(selected);
  const declarations = JSON.stringify(
    overrides.map(({ name, declaration, priority }) => ({ name, declaration, priority })),
  );
  const expectedScope = program.bindings.emissions
    .map(({ sinkOutput }) => sinkOutput)
    .sort((a, b) => a - b);
  const expectedOutputs = new Map(
    program.bindings.emissions.map(({ slot, sinkOutput }) => [slot, sinkOutput]),
  );
  const expectedRoots = new Set(program.bindings.presentations.map(({ root }) => root));
  const masking = new Map(names.map((name) => [name, 'initial']));
  let active = true;
  let epoch = null;
  let sequence = 0n;
  let revision = null;
  let signature = pointSignature([], []);

  const belongs = () => active && authority.isCurrent();
  const inputsCurrent = () => JSON.stringify(authority.inputs()) === declarations;
  authority.acquire();
  return {
    isCurrent() {
      return belongs() && inputsCurrent();
    },
    install(intent) {
      try {
        if (!belongs() || !inputsCurrent()) return false;
        const { operation, bindingEpoch, expectedSequence, desiredSequence } = intent;
        if (
          typeof bindingEpoch !== 'bigint' ||
          bindingEpoch <= 0n ||
          expectedSequence !== sequence ||
          (epoch !== null && bindingEpoch !== epoch) ||
          typeof intent.revision !== 'bigint' ||
          intent.revision <= 0n
        )
          return false;
        if (
          intent.scope.length !== expectedScope.length ||
          [...intent.scope].some((value, index) => value !== expectedScope[index])
        )
          return false;
        const { points, presentationComposites } = intent;
        const desiredSignature = pointSignature(points, presentationComposites);
        if (operation === 'confirmExact') {
          return (
            epoch === bindingEpoch &&
            desiredSequence === sequence &&
            intent.revision === revision &&
            signature === desiredSignature
          );
        }
        if (desiredSequence !== expectedSequence + 1n) return false;
        let values = masking;
        if (operation === 'setAll') {
          const seen = new Set();
          for (const { slot, sinkOutput } of points) {
            if (expectedOutputs.get(slot) !== sinkOutput || seen.has(slot)) return false;
            seen.add(slot);
          }
          if (
            seen.size !== expectedOutputs.size ||
            presentationComposites.length !== expectedRoots.size
          )
            return false;
          const roots = new Set();
          for (const point of presentationComposites) {
            if (point.scenario !== 1 || !expectedRoots.has(point.root) || roots.has(point.root))
              return false;
            roots.add(point.root);
          }
          const { vars } = projectTheme(program, selected, points, presentationComposites);
          if (vars.size !== names.length || names.some((name) => !vars.has(name))) return false;
          values = vars;
        } else if (operation !== 'revokeAll' || points.length || presentationComposites.length) {
          return false;
        }
        authority.publish(values);
        // Публикация всего подготовленного CSS слоя — единственный внешний эффект.
        epoch = bindingEpoch;
        sequence = desiredSequence;
        revision = intent.revision;
        signature = desiredSignature;
        return true;
      } catch (error) {
        // Отказ install отзывается Core; ошибка revoke не подавляется.
        if (error instanceof Error) return false;
        throw error;
      }
    },
    revoke() {
      authority.revoke();
    },
    close() {
      active = false;
    },
  };
}
