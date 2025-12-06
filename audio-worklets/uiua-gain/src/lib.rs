use uiua::{Uiua, Value};
use wasm_bindgen::prelude::*;

// Set up better panic messages in the browser console
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

/// Uiua-powered gain processor for AudioWorklet
///
/// This demonstrates using Uiua (array programming language) for audio processing.
/// The gain operation is: samples × gain
#[wasm_bindgen]
pub struct UiuaGainProcessor {
    gain: f64,
}

#[wasm_bindgen]
impl UiuaGainProcessor {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<UiuaGainProcessor, JsValue> {
        Ok(UiuaGainProcessor { gain: 1.0 })
    }

    /// Set the gain multiplier (0.0 to 2.0)
    pub fn set_gain(&mut self, gain: f64) {
        self.gain = gain.clamp(0.0, 2.0);
    }

    /// Process a block of audio samples using Uiua
    ///
    /// # Arguments
    /// * `samples` - Mutable array of audio samples to process
    /// * `length` - Number of samples to process
    pub fn process(&mut self, samples: &mut [f32], length: usize) -> Result<(), JsValue> {
        let length = length.min(samples.len());

        // Create a new Uiua instance for each process call (stateless)
        let mut uiua = Uiua::with_safe_sys();

        // Convert f32 samples to f64 for Uiua
        let input: Vec<f64> = samples[..length].iter().map(|&s| s as f64).collect();

        // Push the sample array
        uiua.push_all(input);

        // Push the gain value
        uiua.push(self.gain);

        // Run the multiply function (×)
        uiua.run_str("×")
            .map_err(|e| JsValue::from_str(&format!("Uiua execution error: {}", e)))?;

        // Pop the result from the stack
        let result = uiua
            .pop("result")
            .map_err(|e| JsValue::from_str(&format!("Failed to get result: {}", e)))?;

        // Extract numbers - use rows() to iterate over 1D array
        match result {
            Value::Num(arr) => {
                // For a 1D array, rows() gives us individual values as 0D arrays
                // Use .format() to convert to string and parse back as a workaround
                for (i, row) in arr.rows().take(length).enumerate() {
                    // Format the 0D array to string and parse as f64
                    let s = format!("{}", row);
                    if let Ok(value) = s.trim().parse::<f64>() {
                        samples[i] = value as f32;
                    }
                }
            }
            _ => {
                return Err(JsValue::from_str("Result is not a number array"));
            }
        }

        Ok(())
    }
}

impl Default for UiuaGainProcessor {
    fn default() -> Self {
        Self::new().unwrap()
    }
}
