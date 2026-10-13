"""Build the GitHub Pages version. The answer screen is a UI gate, not access control."""
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "_site"
ALLOWED = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov"}
if OUT.exists():
    raise SystemExit("_site already exists. Use a fresh checkout/output directory for a clean build.")
OUT.mkdir()
(OUT / "media").mkdir()
shutil.copy2(ROOT / "media" / "kaathalae-kaathalae.mp3", OUT / "media" / "kaathalae-kaathalae.mp3")
html = (ROOT / "index.html").read_text(encoding="utf-8")
html = html.replace('href="/style.css"', 'href="./style.css"').replace('src="/app.js"', 'src="./app.js"')
(OUT / "index.html").write_text(html, encoding="utf-8")
shutil.copy2(ROOT / "style.css", OUT / "style.css")
shutil.copy2(ROOT / "pages-verification.json", OUT / "pages-verification.json")
story = json.loads((ROOT / "story.json").read_text(encoding="utf-8"))
for memory in story["memories"]:
    for asset in memory["assets"]:
        relative = Path(asset["src"].lstrip("/"))
        source = (ROOT / relative).resolve()
        if (not source.is_relative_to(ROOT.resolve()) or relative.parts[0] not in {"photos", "media"}
                or source.suffix.lower() not in ALLOWED or not source.is_file()):
            raise SystemExit(f"Invalid or missing media: {relative}")
        destination = OUT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        asset["src"] = "./" + relative.as_posix()
        if asset.get("poster"):
            poster = Path(asset["poster"].lstrip("/"))
            source = (ROOT / poster).resolve()
            if not source.is_relative_to(ROOT.resolve()) or poster.parts[0] != "media" or source.suffix.lower() != ".jpg" or not source.is_file():
                raise SystemExit(f"Invalid poster: {poster}")
            (OUT / poster).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, OUT / poster)
            asset["poster"] = "./" + poster.as_posix()

(OUT / "story.json").write_text(json.dumps(story, ensure_ascii=True), encoding="utf-8")
helper = r"""
// GitHub Pages adapter. Published media is public; this is only an interactive gate.
let pagesUnlocked=false;
async function pagesFetch(path, options={}){
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  if(path==='/api/config')return reply(200,{authenticated:pagesUnlocked,demo:false});
  if(path==='/api/story')return pagesUnlocked?fetch('./story.json',{cache:'no-store'}):reply(401,{error:'Please answer the questions first.'});
  if(path==='/api/unlock'){
    try{
      const response=await fetch('./pages-verification.json',{cache:'no-store'});
      if(!response.ok)throw new Error();
      const config=await response.json(), data=JSON.parse(options.body);
      const norm=value=>String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
      const value=[config.salt,data.myDob,data.herDob,data.movie].map(norm).join('\n');
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
      const actual=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
      if(actual!==config.digest)return reply(401,{error:'Those answers do not match. Check the dates and movie name.'});
      pagesUnlocked=true;return reply(200,{ok:true});
    }catch{return reply(503,{error:'Unable to check the answers. Please refresh and try again.'});}
  }
  return reply(404,{error:'Not found.'});
}
"""
js = (ROOT / "app.js").read_text(encoding="utf-8")
assert "fetch('/api/config'" in js and "fetch('/api/unlock'" in js and "fetch('/api/story'" in js
js = js.replace("fetch('/api/", "pagesFetch('/api/")
js = js.replace("Start the local server to open these memories. See README.txt.", "Unable to load the page. Please refresh and try again.")
(OUT / "app.js").write_text(helper + "\n" + js, encoding="utf-8")
(OUT / ".nojekyll").touch()
(OUT / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
assert not (OUT / ".local-security.json").exists()
assert not (OUT / "server.py").exists()
print(f"Built GitHub Pages site: {len(story['memories'])} events; only referenced media included.")
