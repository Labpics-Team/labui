// Vite-плагин core устанавливает hydration hook до импорта компонентов.
import '@labpics/ui-core/switch';
import '@labpics/ui-core/checkbox';
import '@labpics/ui-core/progress';
import '@labpics/ui-core/number-input';
import '@labpics/ui-core/tooltip';
import { registerBooleanExtensions } from '../../../../packages/core/test/fixtures/boolean-extensions';

registerBooleanExtensions();
