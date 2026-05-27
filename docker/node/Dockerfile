FROM node:20-alpine

WORKDIR /app

EXPOSE 5173

# Start Vite dev server if package.json exists,
# otherwise idle (container stays up while make init-frontend runs)
CMD ["sh", "-c", "[ -f package.json ] && npm run dev -- --host 0.0.0.0 || (echo 'Waiting for frontend scaffold...' && tail -f /dev/null)"]
