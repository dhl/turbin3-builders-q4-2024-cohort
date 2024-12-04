#!/bin/bash

# Enable strict error handling
set -euf -o pipefail

export RUSTUP_TOOLCHAIN="nightly-2024-11-19"

# Start the tmux session
tmux new-session -d -s anchor-test

# Start the solana-test-validator in the first panel
tmux send-keys -t anchor-test "COPYFILE_DISABLE=1 solana-test-validator -r --bpf-program GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw tests/spl_governance_3_1_1.so" C-m

# Wait for the validator to be ready
sleep 5

# Create a new window for running the tests
tmux split-window -h -t anchor-test

# Run the tests in the new panel
tmux send-keys -t anchor-test:0.1 "anchor build && anchor deploy && anchor run test" C-m

# Attach to the tmux session to see all the output
tmux attach-session -t anchor-test
