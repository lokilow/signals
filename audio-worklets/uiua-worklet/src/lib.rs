use uiua::Uiua;
use wasm_bindgen::prelude::*;

// Set up better panic messages in the browser console
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

/// Macro to define a Uiua worklet from an embedded .ua file
macro_rules! define_worklet {
    ($name:ident, $ua_file:expr, $doc:expr) => {
        #[doc = $doc]
        #[wasm_bindgen]
        pub struct $name {
            gain: f64, // Generic parameter - worklets can define their own params
        }

        #[wasm_bindgen]
        impl $name {
            #[wasm_bindgen(constructor)]
            pub fn new() -> Result<$name, JsValue> {
                Ok($name { gain: 1.0 })
            }

            /// Set the gain parameter (0.0 to 2.0)
            pub fn set_gain(&mut self, gain: f64) {
                self.gain = gain.clamp(0.0, 2.0);
            }

            /// Process audio samples using the embedded Uiua code
            pub fn process(&mut self, samples: &mut [f32], length: usize) -> Result<(), JsValue> {
                let length = length.min(samples.len());

                // Create a new Uiua instance (stateless per process call)
                let mut uiua = Uiua::with_safe_sys();

                // Convert f32 samples to f64 for Uiua
                let input: Vec<f64> = samples[..length].iter().map(|&s| s as f64).collect();

                // Push the sample array
                uiua.push_all(input);

                // Push the gain parameter
                uiua.push(self.gain);

                // Run the embedded Uiua code
                const UA_CODE: &str = include_str!($ua_file);
                uiua.run_str(UA_CODE)
                    .map_err(|e| JsValue::from_str(&format!("Uiua execution error: {}", e)))?;

                // Pop the result from the stack
                let result = uiua
                    .pop("result")
                    .map_err(|e| JsValue::from_str(&format!("Failed to get result: {}", e)))?;

                // Extract numbers using rows() iterator
                use uiua::Value;
                match result {
                    Value::Num(arr) => {
                        for (i, row) in arr.rows().take(length).enumerate() {
                            // Format and parse as workaround for private API
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

        impl Default for $name {
            fn default() -> Self {
                Self::new().unwrap()
            }
        }
    };
}

// Define worklets by embedding .ua files
define_worklet!(
    UiuaGainWorklet,
    "worklets/gain.ua",
    "Gain worklet using Uiua - multiplies samples by gain value"
);

// Future worklets can be added here:
// define_worklet!(
//     UiuaReverbWorklet,
//     "worklets/reverb.ua",
//     "Reverb worklet using Uiua"
// );
