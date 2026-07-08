# stellate is a fully static browser app: the working tree IS the web root.
# No build step (JS files load directly; preact/htm come from esm.sh at runtime),
# no backend, no datastore. It just needs to be served over HTTP with the two
# cross-origin-isolation headers (COOP: same-origin + COEP: require-corp) so the
# Faust engine's SharedArrayBuffer ring works (see serve.sh / CLAUDE.md).
# Serve with the ECR-mirrored nginx (docker.io is rate-limited on the build fleet).
FROM 492970811130.dkr.ecr.us-east-1.amazonaws.com/cadence-dev-base:nginx-alpine

# The whole repo is the site root (faust/dist precompiled WASM is committed).
COPY . /usr/share/nginx/html

# Emit the cross-origin-isolation + no-cache headers serve.sh sends, and route
# a bare / to the explorer entry point.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index explorer.html;\n  location / {\n    add_header Cross-Origin-Opener-Policy "same-origin" always;\n    add_header Cross-Origin-Embedder-Policy "require-corp" always;\n    add_header Cache-Control "no-cache" always;\n    try_files $uri $uri/ /explorer.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
