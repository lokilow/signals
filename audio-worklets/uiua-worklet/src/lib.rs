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

/// Macro to define a stateless Uiua worklet from an embedded .ua file
///
/// Stack protocol:
///   Push: samples (array), then params (scalars, last pushed = top of stack)
///   Pop: processed samples (array)
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
    };
}

/// Macro to define a stateful Uiua worklet with persistent state across blocks
///
/// Stack protocol:
///   Push: state (array), samples (array), then params (scalars, last pushed = top of stack)
///   Pop: new_state (array), then processed samples (array)
///
/// The Uiua code must return TWO arrays on the stack:
///   - Top: new state to persist
///   - Below: processed audio samples
macro_rules! define_stateful_worklet {
    ($name:ident, $ua_file:expr, $doc:expr, state_size: $state_size:expr) => {
        #[doc = $doc]
        #[wasm_bindgen]
        pub struct $name {
            params: [f64; 4], // Generic params array: [p0, p1, p2, p3]
            state: Vec<f64>,
            uiua: Uiua,
            root_node: Node,
            input_buffer: Vec<f32>,
            output_buffer: Vec<f32>,
            warned_short_output: bool,
        }

        #[wasm_bindgen]
        impl $name {
            #[wasm_bindgen(constructor)]
            pub fn new() -> Result<$name, JsValue> {
                let (uiua, root_node) = Self::compile_program()?;
                Ok($name {
                    params: [0.0; 4],
                    state: vec![0.0; $state_size],
                    uiua,
                    root_node,
                    input_buffer: vec![0.0; MAX_BLOCK_SIZE],
                    output_buffer: vec![0.0; MAX_BLOCK_SIZE],
                    warned_short_output: false,
                })
            }

            /// Set parameter by index (0-3)
            pub fn set_param(&mut self, index: usize, value: f64) {
                if index < self.params.len() {
                    self.params[index] = value;
                }
            }

            /// Get parameter by index
            pub fn get_param(&self, index: usize) -> f64 {
                self.params.get(index).copied().unwrap_or(0.0)
            }

            /// Get current state size
            pub fn state_size(&self) -> usize {
                self.state.len()
            }

            /// Resize state buffer (for effects like delay that need variable buffer sizes)
            pub fn resize_state(&mut self, new_size: usize) {
                self.state.resize(new_size, 0.0);
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

            /// Process audio with state persistence
            /// params_used: how many of the 4 params to push onto stack
            pub fn process_block(
                &mut self,
                frames: usize,
                params_used: usize,
            ) -> Result<(), JsValue> {
                if frames > self.input_buffer.len() {
                    return Err(js_error(format!(
                        "Frames {} exceed buffer capacity {}",
                        frames,
                        self.input_buffer.len()
                    )));
                }

                self.uiua.take_stacks();

                // Push state first (bottom of stack after all pushes)
                let state_value: Value = self.state.iter().copied().collect();
                self.uiua.push(state_value);

                // Push samples
                let samples: Value = self.input_buffer[..frames]
                    .iter()
                    .copied()
                    .map(|sample| sample as f64)
                    .collect();
                self.uiua.push(samples);

                // Push params (last pushed = top of stack)
                for i in 0..params_used.min(self.params.len()) {
                    self.uiua.push(self.params[i]);
                }

                // Execute
                self.uiua.exec(self.root_node.clone()).map_err(js_error)?;

                // Pop new state (top of stack after execution)
                let new_state = self.uiua.pop(()).map_err(js_error)?;
                let state_nums = new_state
                    .as_nums(&self.uiua, Some("Uiua worklet must return state array"))
                    .map_err(js_error)?;
                let state_slice = state_nums.as_ref();

                // Update state
                for (i, &val) in state_slice.iter().enumerate() {
                    if i < self.state.len() {
                        self.state[i] = val;
                    }
                }

                // Pop output samples
                let output = self.uiua.pop(()).map_err(js_error)?;
                let numbers = output
                    .as_nums(&self.uiua, Some("Uiua worklet must return audio samples"))
                    .map_err(js_error)?;
                let slice = numbers.as_ref();

                if slice.len() < frames && !self.warned_short_output {
                    console::warn_1(
                        &format!(
                            "Uiua worklet returned {} samples, expected {}.",
                            slice.len(),
                            frames
                        )
                        .into(),
                    );
                    self.warned_short_output = true;
                }

                for (i, out) in self.output_buffer.iter_mut().take(frames).enumerate() {
                    let fallback = self.input_buffer[i] as f64;
                    let value = slice.get(i).copied().unwrap_or(fallback);
                    *out = value as f32;
                }

                Ok(())
            }
        }

        impl $name {
            fn compile_program() -> Result<(Uiua, Node), JsValue> {
                let mut compiler = Compiler::new();
                compiler
                    .load_str(include_str!($ua_file))
                    .map_err(js_error)?;
                let asm = compiler.finish();
                let root_node = asm.root.clone();

                let mut uiua = Uiua::with_safe_sys();
                uiua.asm = asm;

                Ok((uiua, root_node))
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new().unwrap()
            }
        }
    };
}

// Compatibility shim for older JS pipelines
#[wasm_bindgen]
pub fn process_audio(input: Vec<f32>, gain: f64) -> Result<Vec<f32>, JsValue> {
    let output: Vec<f32> = input.iter().map(|&sample| sample * gain as f32).collect();
    Ok(output)
}

// ============================================================================
// Stateless worklets
// ============================================================================

define_worklet!(
    UiuaGainWorklet,
    "worklets/gain.ua",
    "Gain worklet using Uiua - multiplies samples by gain value"
);

// ============================================================================
// Stateful worklets
// ============================================================================

// Biquad filter - needs 4 floats of state (x1, x2, y1, y2)
define_stateful_worklet!(
    UiuaBiquadWorklet,
    "worklets/biquad.ua",
    "Biquad filter using Uiua - low/high/bandpass filter",
    state_size: 4
);

// Delay - needs buffer for delayed samples (default 48000 = 1 second at 48kHz)
// Can be resized via resize_state() for different delay times
define_stateful_worklet!(
    UiuaDelayWorklet,
    "worklets/delay.ua",
    "Delay effect using Uiua - echo/delay with feedback",
    state_size: 48000
);
