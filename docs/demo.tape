# WardayaCode demo GIF
# Install vhs: https://github.com/charmbracelet/vhs
# Run: vhs demo.tape
# Output: docs/wardayacode-demo.gif

Output docs/wardayacode-demo.gif

# Terminal settings
Set FontSize 14
Set FontFamily "JetBrains Mono, Fira Code, monospace"
Set Width 900
Set Height 540
Set Theme "Dracula"
Set Padding 24
Set Framerate 30

# Show startup command
Type "wardayacode" 100ms
Sleep 500ms

# Wait for the TUI to render
Sleep 3s

# Show the caret waiting for input
Sleep 1s

# Type a slash to show the command palette
Type "/" 50ms
Sleep 1s

# Scroll down a bit through the palette
Sleep 500ms

# Clear and type a real prompt
Ctrl+u
Sleep 300ms
Type "Explain the architecture of this project" 50ms per character
Sleep 500ms

# Submit (capture frame before processing)
Sleep 2s

# Hold on the result
Sleep 3s

# Fade out
Sleep 500ms
