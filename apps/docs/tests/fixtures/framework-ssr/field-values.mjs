// Mixed HTML newlines exercise parser normalization without deriving the expected
// DOM value from the production normalizer.
export const serverFieldValue = 'Server\r\nfield\rwith\nbreaks';
export const normalizedServerFieldValue = 'Server\nfield\nwith\nbreaks';
export const externalFieldValue = 'External\r\nupdate';
export const normalizedExternalFieldValue = 'External\nupdate';
