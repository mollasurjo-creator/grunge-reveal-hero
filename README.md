# Full-Screen Grunge / Dry-Brush Scratch Reveal Hero

A real-time cursor-controlled procedural dry-brush scratch reveal hero section built with HTML5 Canvas, Vanilla CSS, and JavaScript.

## Features
- **Initial State**: 100% IMAGE 1 (the default photo) with zero reveal, zero holes, zero idle animations until user interaction.
- **Physical Dry-Brush Reveal**: Scratches IMAGE 1 away to reveal IMAGE 2 underneath with irregular torn edges and internal bristle gaps.
- **Smooth Cursor Follower**: Damped motion interpolation (`k = 1 - Math.pow(1 - 0.17, dt * 60)`).
- **Physical Shrink Lifetime**: Stamps physically shrink over ~2.7 seconds (`radius = originalRadius * Math.pow(life, 0.85)`). No opacity fading.
- **Procedural Harmonics & Catmull-Rom Splines**: 48 perimeter samples with multiscale sine wave modulation converted into closed organic Bézier curves.
- **Directional Stretch**: Brush naturally stretches along the movement vector.
- **Mobile Touch**: Full touch drag support.

## Running Locally
Run the included PowerShell script:
```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1
```
Or open in any modern browser or local static server.
