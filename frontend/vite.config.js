import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    base: "/",
    build: {
        outDir: "dist",
        target: 'esnext',
        rollupOptions: {
            output: {
                format: 'es'
            }
        }
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext'
        }
    },
    plugins: [react()],
    server: {
        port: 3003,
        proxy: {
            '/api': {
                target: 'http://localhost:8000',
                changeOrigin: true,
            }
        }
    },
    define: {
        APP_VERSION: JSON.stringify(process.env.npm_package_version),
    },
});