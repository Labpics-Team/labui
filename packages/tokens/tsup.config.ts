import { libraryPreset } from '../../tsup.config.base';

export default libraryPreset({ entry: ['src/index.ts', 'src/generated/motion.ts'] });
