import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Relative assets support both domain-root and GitHub Pages repository URLs.
export default defineConfig({ base: './', plugins: [react(), tailwindcss()] });
