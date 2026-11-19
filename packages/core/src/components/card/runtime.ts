import { mountMaterialRuntime, mountSurfaceShape } from '@labpics/ui-materials';
import { cardProfile } from '@labpics/ui-tokens';

/** The frame clips decoration; its content retains an independent material. */
export function mountCardRuntime(element: HTMLElement) {
  const shape = mountSurfaceShape(element, { smoothing: cardProfile.cornerSmoothing });
  let disposeMaterial: () => void;
  try {
    disposeMaterial = mountMaterialRuntime(element);
  } catch (error) {
    shape.destroy();
    throw error;
  }
  return {
    refresh: () => shape.refresh(),
    dispose() {
      try {
        disposeMaterial();
      } finally {
        shape.destroy();
      }
    },
  };
}
