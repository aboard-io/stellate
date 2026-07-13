# STELLATE is a fully static browser app (HTML/JS/WASM) served over HTTP.
# The desktop ring engine REQUIRES SharedArrayBuffer, which requires the page
# to be cross-origin isolated (COOP: same-origin + COEP: require-corp on EVERY
# response, including the worker scripts and .wasm modules). nginx sets those
# headers server-wide below. No build step is needed for the app shell: the repo
# working tree IS the web root (see docs/HOSTING.md / serve.sh).
FROM 492970811130.dkr.ecr.us-east-1.amazonaws.com/cadence-dev-base:nginx-alpine

# Serve the repo tree as-is. Runtime media (found/*.wav|mp3, found/video/*.mp4)
# is gitignored and fetched out-of-band via tools/fetch-found-*.sh, so it is not
# present in the image; the app shell still boots and any missing media simply
# 404s (the app tolerates absent found-sound layers).
COPY . /usr/share/nginx/html

# nginx config: cross-origin isolation headers + correct WASM MIME + SPA-ish
# fallback to index.html for the root explorer.
RUN printf 'types { application/wasm wasm; }\nserver {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  gzip on;\n  gzip_types application/javascript application/json application/wasm text/css;\n  add_header Cross-Origin-Opener-Policy "same-origin" always;\n  add_header Cross-Origin-Embedder-Policy "require-corp" always;\n  add_header Cross-Origin-Resource-Policy "cross-origin" always;\n  add_header Cache-Control "no-cache" always;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
