use wasm_bindgen::prelude::*;

/// Simple gain processor for AudioWorklet
///
/// This is a minimal WASM-based audio processor that multiplies
/// input samples by a gain value. It serves as the foundation
/// for future Uiua-based audio processors.
#[wasm_bindgen]
pub struct WasmGainProcessor {
    gain: f32,
}

#[wasm_bindgen]
impl WasmGainProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self { gain: 1.0 }
    }

    /// Set the gain multiplier (0.0 to 2.0)
    pub fn set_gain(&mut self, gain: f32) {
        self.gain = gain.clamp(0.0, 2.0);
    }

    /// Process a block of audio samples in-place
    ///
    /// # Arguments
    /// * `samples` - Mutable array of audio samples to process
    /// * `length` - Number of samples to process
    pub fn process(&self, samples: &mut [f32], length: usize) {
        for i in 0..length.min(samples.len()) {
            samples[i] *= self.gain;
        }
    }
}

impl Default for WasmGainProcessor {
    fn default() -> Self {
        Self::new()
    }
}
