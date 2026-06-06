FROM node:20-alpine

WORKDIR /app

EXPOSE 5173

# Build for production and serve with vite preview.
# The dev server is too memory-heavy for the public-facing site.
# For local HMR: override CMD via docker-compose override with `npm run dev -- --host 0.0.0.0`
CMD ["sh", "-c", "[ -f package.json ] && (npm run build && npm run preview -- --host 0.0.0.0 --port 5173) || (echo 'Waiting for frontend scaffold...' && tail -f /dev/null)"]
