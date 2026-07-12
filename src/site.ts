import html from "../public/index.html";
import css from "../public/styles.css";
import javascript from "../public/app.js.txt";

const contentTypes: Record<string, string> = {
  "/styles.css": "text/css; charset=utf-8",
  "/app.js": "application/javascript; charset=utf-8",
};

export function siteAsset(path: string): Response {
  if (path === "/styles.css") return new Response(css, { headers: { "content-type": contentTypes[path], "cache-control": "public, max-age=3600" } });
  if (path === "/app.js") return new Response(javascript, { headers: { "content-type": contentTypes[path], "cache-control": "public, max-age=3600" } });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}