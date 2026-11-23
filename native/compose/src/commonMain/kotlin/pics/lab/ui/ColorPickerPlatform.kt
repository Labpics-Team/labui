package pics.lab.ui

/**
 * Supported platform effect. Return null on cancellation. The panel checks current
 * editability and lifetime before applying the result. The application supplies
 * supported platform screen sampling; this package does not bundle an OS sampler.
 * The sampled coordinates replace the color while the latest accepted alpha is retained.
 */
public typealias LabPickScreenColor = suspend () -> LabColorValue?
