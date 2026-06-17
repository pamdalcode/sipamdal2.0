import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // Base path — ubah ke '/namasubfolder/' jika deploy ke subdirektori
  base: '/',

  build: {
    // Output ke dist/ (default Vite)
    outDir: 'dist',

    // Source map untuk production debugging (opsional, bisa di-false-kan)
    sourcemap: false,

    // Chunk size warning threshold
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        // Manual chunking: pisahkan vendor besar agar cache lebih efisien
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'firebase-vendor': [
            'firebase/app',
            'firebase/firestore',
            'firebase/auth',
            'firebase/messaging'
          ],
          'zustand-vendor': ['zustand']
        }
      }
    }
  },

  server: {
    port: 5173,
    open: true
  },

  // Agar import tanpa ekstensi tetap bisa resolve
  resolve: {
    extensions: ['.jsx', '.js', '.json']
  }
});
