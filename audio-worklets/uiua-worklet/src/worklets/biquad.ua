# Biquad Filter
#
# Input (bottom to top): state samples param0(cutoff)
# Output (bottom to top): output_samples new_state
#
# ============================================================================
# BIQUAD FILTER THEORY
# ============================================================================
#
# A biquad is a "bi-quadratic" filter - the transfer function has quadratic
# polynomials in both numerator and denominator. It's the building block of
# most audio EQs and filters.
#
# The difference equation (how to compute each output sample):
#
#   y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
#
# Where:
#   x[n]   = current input sample
#   x[n-1] = previous input sample
#   x[n-2] = input sample from 2 steps ago
#   y[n]   = current output sample (what we're computing)
#   y[n-1] = previous output sample
#   y[n-2] = output sample from 2 steps ago
#   b0, b1, b2, a1, a2 = filter coefficients (determine filter behavior)
#
# STATE: We need to remember [x1, x2, y1, y2] between blocks
#   x1 = x[n-1], x2 = x[n-2], y1 = y[n-1], y2 = y[n-2]
#
# ============================================================================
# COEFFICIENT CALCULATION (for lowpass filter)
# ============================================================================
#
# Given:
#   fc = cutoff frequency (Hz)
#   fs = sample rate (Hz)
#   Q  = resonance/quality factor (0.707 = Butterworth, no resonance)
#
# Intermediate values:
#   omega = 2 * pi * fc / fs        (normalized angular frequency)
#   sin_w = sin(omega)
#   cos_w = cos(omega)
#   alpha = sin_w / (2 * Q)
#
# Lowpass coefficients:
#   b0 = (1 - cos_w) / 2
#   b1 = 1 - cos_w
#   b2 = (1 - cos_w) / 2
#   a0 = 1 + alpha
#   a1 = -2 * cos_w
#   a2 = 1 - alpha
#
# Normalize by dividing all by a0:
#   b0 /= a0, b1 /= a0, b2 /= a0, a1 /= a0, a2 /= a0
#
# ============================================================================
# SIMPLER: ONE-POLE LOWPASS
# ============================================================================
#
# If biquad feels complex, start with a one-pole lowpass:
#
#   y[n] = alpha * x[n] + (1 - alpha) * y[n-1]
#
# Where alpha = cutoff (0 to 1)
#   - alpha near 0 = heavy smoothing (low cutoff)
#   - alpha near 1 = minimal smoothing (high cutoff, nearly passthrough)
#
# STATE: Just need [y1] (previous output)
#
# This is an exponential moving average - each output is a weighted blend
# of the new input and the previous output.
#
# ============================================================================
# IMPLEMENTATION CHALLENGE IN UIUA
# ============================================================================
#
# The tricky part: filters are inherently sequential. Each output depends
# on the previous output. You can't just map over the array.
#
# Options:
# 1. Use `fold` or `scan` to process sample-by-sample with accumulator
# 2. Use `reduce` with a function that carries state
#
# For one-pole lowpass with `scan`:
#   - Initial accumulator: y[n-1] from state
#   - For each sample x[n]: compute y[n] = alpha*x[n] + (1-alpha)*acc
#   - `scan` gives you all intermediate results (the output array)
#
# ============================================================================
# YOUR TASK
# ============================================================================
#
# 1. Extract y1 (previous output) from state[0]
# 2. Use the cutoff param as alpha
# 3. Process samples with scan/fold to apply one-pole filter
# 4. Return [output_samples, new_state] where new_state[0] = last output
#
# Hints:
#   - `\` is scan (like fold but keeps intermediates)
#   - `∧` is fold (reduces to single value)
#   - You'll need a function that takes (accumulator, sample) -> new_acc
#   - The formula: new_y = alpha * sample + (1-alpha) * old_y
#
# ============================================================================

# CURRENT: Simple gain passthrough (proof of concept)
# Stack: state samples param0
× # samples × param0 -> output_samples
# Stack: state output_samples
: # flip - swap top two
# Stack: output_samples state
