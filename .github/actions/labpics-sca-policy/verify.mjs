import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE = {
  schema: 'labpics.sca/canonical-source/v1',
  repository: 'Labpics-Team/agents-config',
  commit: 'f5dc418d0da3572ad0a5196848e40cb2e9c48efb',
  files: [
    {
      path: 'architecture/model.mjs',
      blob: 'ce4ca8e8dc93f3773f9171108e27ccf6a7719d11',
      sha256: '14d4b258536cd70b58e90e4694f15f0e466dc2bedb2a3befe5f397c0b406a3ad',
    },
    {
      path: 'architecture/git.mjs',
      blob: 'ba4feb10cf308b94623ef6319e1a49fda0ab7c8f',
      sha256: 'ccc7306589c174c8e063eb3763067be6c0edee572541aecc877a6677e5bc9513',
    },
    {
      path: 'plans/tools/code-admission.mjs',
      blob: 'db81be406edcb130ab8bce2fd369d5ba62796ed4',
      sha256: 'bcc54f285e2bb7ef68acc09111095f24f6cf4090422f05a84cc75b810e46d79a',
    },
    {
      path: 'plans/tools/code-admission/controls.mjs',
      blob: 'dc4a37eb1920a7ff6af6427d81e6bc208a55dd67',
      sha256: '1a8a97b08df238366187ec13f9b789a4c1c8814ed026dfca3a9424f5cde070d0',
    },
    {
      path: 'plans/tools/code-admission/structural.mjs',
      blob: 'df712d276055985ebf3f6186a721b5ac1d1e99d5',
      sha256: '0b69092715ffc3f18817c787694a330e00e9b8a44c482df3c9af66b4e329038d',
    },
    {
      path: 'plans/tools/code-admission/snapshot.mjs',
      blob: '097ab6678f7228176ee3778004e62f047e32af56',
      sha256: '64557aff88d55e7fe6fea620dc42a27673b588f1e263cc60764dd7e5a3fc92c7',
    },
    {
      path: 'plans/tools/code-admission/identity.mjs',
      blob: '33dea8f91ab5d4e3ffc90f4226ad960a5f5f5018',
      sha256: '80e7c4779b0ebca7489e7e911b66edd8fa07ce36686d41791c2b52cb468ce88b',
    },
    {
      path: 'plans/tools/code-admission/trivy.mjs',
      blob: 'f83ac456ce9fe21cff1a0db2e176b93aac344214',
      sha256: 'df1c014840386e98937048ad5fad7f6df8772bec87fe2d4d30ddaa8480e7f17f',
    },
    {
      path: 'plans/tools/code-admission/npm-patch.mjs',
      blob: 'ff7882a5a47ebc401ecb1ac372b54aeef64b6f94',
      sha256: '0c47657f0e6689fdfa02d0b5fb5733e41cab484e119132fab88a2c6cb0b391ba',
    },
    {
      path: 'plans/tools/code-admission/reviewed-npm-patches.mjs',
      blob: '2f569cf845c7669ac433388f528c393f59e6a7df',
      sha256: '54c7b959d8806baa028de47901a8d09bf8d109e8cdb1fec47e203ddaa2d02381',
    },
    {
      path: 'plans/tools/code-admission/go-scope.mjs',
      blob: 'aaef65508b6bbf304c2d3cd088232ed71c343e7c',
      sha256: 'fc3feca81e4a9227cd90a6b3d6a8051e6560cb93472fa9b2771440a7ee4c1871',
    },
    {
      path: 'plans/tools/code-admission/forge-artifact.mjs',
      blob: '66dc697b9aeb651fc77344260c7142160c448363',
      sha256: 'eeeceda4a058a5e76c1bd4844e4a848d4982f65d99e093ed00909df0487deac8',
    },
  ],
};
function files(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name),
      info = lstatSync(path);
    if (info.isSymbolicLink()) throw new Error('Policy carrier rejects symlinks');
    if (info.isDirectory()) return files(root, path);
    if (!info.isFile()) throw new Error('Policy carrier rejects special files');
    return [relative(root, path).replaceAll('\\', '/')];
  });
}
export function verifyCarrier(root) {
  const receipt = JSON.parse(readFileSync(join(root, 'source.json'), 'utf8'));
  if (JSON.stringify(receipt) !== JSON.stringify(SOURCE))
    throw new Error('Policy provenance changed');
  const expected = [...SOURCE.files.map(({ path }) => path), 'source.json', 'verify.mjs'].sort();
  if (JSON.stringify(files(root).sort()) !== JSON.stringify(expected))
    throw new Error('Policy carrier inventory changed');
  for (const item of SOURCE.files) {
    const bytes = readFileSync(join(root, item.path));
    const blob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (blob !== item.blob || createHash('sha256').update(bytes).digest('hex') !== item.sha256)
      throw new Error('Canonical policy bytes changed: ' + item.path);
  }
  return { repository: SOURCE.repository, commit: SOURCE.commit, files: SOURCE.files.length };
}
