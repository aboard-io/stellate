# Box configuration for stellate.exe.xyz

Installed by the workspace deploy tool (`scripts/deploy stellate` on the dev
box), which runs `tools/deploy/deploy-nukernel-prod.sh --yes-prod` to publish
the site and then installs these files. Edit here and deploy.

| file | installed at |
|---|---|
| `nginx-stellate.conf` | `/etc/nginx/sites-available/stellate` — root `/srv/stellate-nu`, archive at `/old/` (`/srv/stellate`), audio at `/found/` (`/srv/media/found`), stats proxied to goatcounter |
| `goatcounter.service` | `/etc/systemd/system/` |

`docs/exe-stellate.nginx.conf` is the vhost as written at migration time; this
copy is what the box runs now.
