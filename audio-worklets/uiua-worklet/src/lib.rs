use uiua::{Compiler, Node, Uiua, Value};
use wasm_bindgen::prelude::*;
use web_sys::console;

const MAX_BLOCK_SIZE: usize = 128;

fn js_error(err: impl ToString) -> JsValue {
    JsValue::from_str(&err.to_string())
}

// Set up better panic messages in the browser console
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// Export WebAssembly memory for zero-copy buffer access from JavaScript
#[wasm_bindgen]
pub fn wasm_memory() -> JsValue {
    wasm_bindgen::memory()
}

/// Macro to define a Uiua worklet from an embedded .ua file
macro_rules! define_worklet {
    ($name:ident, $ua_file:expr, $doc:expr) => {
        #[doc = $doc]
        #[wasm_bindgen]
        pub struct $name {
            gain: f64,
            uiua: Uiua,
            /// The root node extracted from compiled assembly - cheap to clone
            /// due to Arc/EcoVec internals (reference counting, not deep copy)
            root_node: Node,
            input_buffer: Vec<f32>,
            output_buffer: Vec<f32>,
            warned_short_output: bool,
            logged_first_block: bool,
        }

        #[wasm_bindgen]
        impl $name {
            #[wasm_bindgen(constructor)]
            pub fn new() -> Result<$name, JsValue> {
                let (uiua, root_node) = Self::compile_program()?;
                Ok($name {
                    gain: 1.0,
                    uiua,
                    root_node,
                    input_buffer: vec![0.0; MAX_BLOCK_SIZE],
                    output_buffer: vec![0.0; MAX_BLOCK_SIZE],
                    warned_short_output: false,
                    logged_first_block: false,
                })
            }

            /// Set the gain parameter (0.0 to 2.0)
            pub fn set_gain(&mut self, gain: f64) {
                self.gain = gain.clamp(0.0, 2.0);
            }

            /// Get the current gain value
            pub fn get_gain(&self) -> f64 {
                self.gain
            }

            /// Pointer to the input buffer inside WASM memory
            pub fn input_ptr(&self) -> usize {
                self.input_buffer.as_ptr() as usize
            }

            /// Pointer to the output buffer inside WASM memory
            pub fn output_ptr(&self) -> usize {
                self.output_buffer.as_ptr() as usize
            }

            /// Number of samples the buffers can hold per block
            pub fn buffer_len(&self) -> usize {
                self.input_buffer.len()
            }

            /// Process the samples currently copied into the input buffer
            pub fn process_block(&mut self, frames: usize, gain: f64) -> Result<(), JsValue> {
                if frames > self.input_buffer.len() {
                    return Err(js_error(format!(
                        "Frames {} exceed buffer capacity {}",
                        frames,
                        self.input_buffer.len()
                    )));
                }

                self.gain = gain.clamp(0.0, 2.0);
                self.uiua.take_stacks();

                let samples: Value = self.input_buffer[..frames]
                    .iter()
                    .copied()
                    .map(|sample| sample as f64)
                    .collect();

                self.uiua.push(samples);
                self.uiua.push(self.gain);

                // Execute the root node directly - Node.clone() is cheap due to
                // Arc/EcoVec internals (just increments reference counts)
                self.uiua
                    .exec(self.root_node.clone())
                    .map_err(js_error)?;

                let value = self.uiua.pop(()).map_err(js_error)?;
                let numbers = value
                    .as_nums(&self.uiua, Some("Uiua worklet must return numeric samples"))
                    .map_err(js_error)?;
                let slice = numbers.as_ref();

                if slice.len() < frames && !self.warned_short_output {
                    console::warn_1(
                        &format!(
                            "Uiua worklet returned {} samples, expected {}. Falling back to direct gain.",
                            slice.len(),
                            frames
                        )
                        .into(),
                    );
                    self.warned_short_output = true;
                }

                for (i, out) in self.output_buffer.iter_mut().take(frames).enumerate() {
                    let fallback = (self.input_buffer[i] as f64) * self.gain;
                    let value = slice.get(i).copied().unwrap_or(fallback);
                    *out = value as f32;
                }

                self.logged_first_block = true;

                Ok(())
            }
        }

        impl $name {
            /// Compile the Uiua program and return both the runtime and root node.
            /// The assembly is loaded into the runtime, and we extract the root node
            /// for efficient repeated execution (Node.clone() is cheap).
            fn compile_program() -> Result<(Uiua, Node), JsValue> {
                let mut compiler = Compiler::new();
                compiler
                    .load_str(include_str!($ua_file))
                    .map_err(js_error)?;
                let asm = compiler.finish();
                let root_node = asm.root.clone();

                let mut uiua = Uiua::with_safe_sys();
                // Load assembly into runtime so bindings are available
                uiua.asm = asm;

                Ok((uiua, root_node))
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new().unwrap()
            }
        }

        // Compatibility shim for older JS pipelines that relied on per-call processing.
        // This can be removed once all consumers switch to the shared-buffer API.
        #[wasm_bindgen]
        pub fn process_audio(input: Vec<f32>, gain: f64) -> Result<Vec<f32>, JsValue> {
            let output: Vec<f32> = input.iter().map(|&sample| sample * gain as f32).collect();
            Ok(output)
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
