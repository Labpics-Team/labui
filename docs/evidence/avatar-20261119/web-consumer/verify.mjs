import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { avatarInitials } from '@labpics/ui-core/avatar/contract';
import { Avatar } from '@labpics/ui-react/avatar';
import { renderAvatar } from '@labpics/ui-vue/ssr';
const require = createRequire(import.meta.url);
assert.equal(avatarInitials('Anna Karenina'), 'AK');
assert.equal(require('@labpics/ui-core/avatar/contract').avatarInitials('Anna Karenina'), 'AK');
assert.ok(Avatar && require('@labpics/ui-react/avatar').Avatar);
assert.match(
  renderAvatar({ name: 'Anna', initials: 'A', fallback: 'texture' }),
  /shadowrootmode="open"/,
);
assert.match(
  readFileSync(require.resolve('@labpics/ui-core/avatar.css'), 'utf8'),
  /lab-avatar-initials/,
);
assert.ok(
  readFileSync(require.resolve('@labpics/fonts/fonts/SunghyunSans-ExtraBold.woff2')).length > 10000,
);
process.stdout.write('Packed ESM, CJS, SSR, CSS and font imports passed\n');
