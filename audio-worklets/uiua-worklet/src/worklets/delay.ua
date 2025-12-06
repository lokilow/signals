# Delay effect proof of concept
#
# Input (bottom to top): state samples wet feedback
# Output (bottom to top): output_samples new_state
#
# For now: passthrough that proves the stateful protocol works

# Stack: state samples wet feedback
# drop feedback and wet

# Stack: state samples
⊸∘ # by identity: keep state, put it on top
# Stack: samples state
