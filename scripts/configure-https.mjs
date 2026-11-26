import { X509Certificate, createPrivateKey } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const existing = 'C:/Work/DCPCore/Src/Common/DCP.Core.Common/Docs/Deployment/Host/certificate/ngnix';
const host = process.env.DCP_HTTPS_HOST ?? 'dcpcore.com';
const certificate = resolve(process.env.DCP_TLS_CERT ?? existing + '/dcpcore.crt');
const privateKey = resolve(process.env.DCP_TLS_KEY ?? existing + '/dcpcore.key');
if (!process.env.DCP_API_UPSTREAM) throw new Error('Set DCP_API_UPSTREAM to the local CoreService origin.');
const upstream = new URL(process.env.DCP_API_UPSTREAM);
if (!/^[a-zA-Z0-9.-]+$/.test(host) || upstream.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(upstream.hostname) ||
    upstream.pathname !== '/' || upstream.username || upstream.password || upstream.search || upstream.hash) {
  throw new Error('Use a valid TLS hostname and a plain HTTP loopback CoreService origin.');
}
const cert = new X509Certificate(await readFile(certificate));
if (!cert.checkHost(host) || !cert.checkPrivateKey(createPrivateKey(await readFile(privateKey)))) {
  throw new Error('The configured certificate and key must match the HTTPS hostname.');
}
if (Date.now() < Date.parse(cert.validFrom) || Date.now() > Date.parse(cert.validTo)) {
  throw new Error('The configured certificate is outside its validity period.');
}

function port(input, fallback) {
  const value = Number(input ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error('Invalid HTTP or HTTPS port.');
  return String(value);
}
function quoted(path) {
  const value = path.replaceAll('\\', '/');
  if (/["\r\n$]/.test(value)) throw new Error('Unsupported character in an NGINX path.');
  return '"' + value + '"';
}
const https = port(process.env.DCP_HTTPS_PORT, 443);
const http = port(process.env.DCP_HTTP_PORT, 80);
if (http === https) throw new Error('Use different HTTP and HTTPS ports.');
const bind = process.env.DCP_NGINX_BIND ?? '';
if (bind && bind !== '127.0.0.1') throw new Error('DCP_NGINX_BIND may be set to 127.0.0.1 for local verification.');
const mimeTypes = process.env.DCP_NGINX_MIME ? resolve(process.env.DCP_NGINX_MIME) : 'conf/mime.types';
const settings = {
  HOST: host, BIND: bind ? bind + ':' : '', HTTP_PORT: http, HTTPS_PORT: https, HTTPS_SUFFIX: https === '443' ? '' : ':' + https,
  DIST: quoted(resolve('dist')), CERTIFICATE: quoted(certificate), PRIVATE_KEY: quoted(privateKey),
  UPSTREAM: upstream.origin, MIME_TYPES: quoted(mimeTypes),
};
const template = await readFile(new URL('../deploy/nginx.conf.template', import.meta.url), 'utf8');
const output = resolve('.local/nginx.conf');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, template.replace(/@([A-Z_]+)@/g, (_, key) => settings[key]));
console.log('Generated ' + output + ' for ' + host + '. Certificate hostname, key match and validity verified.');
