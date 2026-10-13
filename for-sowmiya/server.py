"""Local draft server. No third-party packages required."""
import hashlib
import hmac
import http.cookies
import json
import os
from pathlib import Path
import secrets
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
SETTINGS_FILE = ROOT / ".local-security.json"
SETTINGS = json.loads(SETTINGS_FILE.read_text(encoding="utf-8")) if SETTINGS_FILE.exists() else {}
DEMO = os.environ.get("LOVE_DEMO", "0" if SETTINGS else "1") == "1"
KEYS = ("LOVE_MY_DOB", "LOVE_HER_DOB", "LOVE_FIRST_MOVIE")
DEFAULTS = ("2000-01-01", "2000-02-02", "Our first movie") if DEMO else ("", "", "")
EXPECTED = tuple(os.environ.get(key, SETTINGS.get(key, default)) for key, default in zip(KEYS, DEFAULTS))
if not DEMO and not all(value.strip() for value in EXPECTED):
    raise SystemExit("Configure .local-security.json or set LOVE_MY_DOB, LOVE_HER_DOB, and LOVE_FIRST_MOVIE.")
SESSIONS = {}
ATTEMPTS = {}
TTL = 1800
PUBLIC = {"/": ("index.html", "text/html"), "/style.css": ("style.css", "text/css"),
          "/app.js": ("app.js", "application/javascript")}

def normalized(value):
    return " ".join(value.strip().casefold().split())

def digest(value):
    return hashlib.sha256(normalized(value).encode()).digest()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Never log submitted answers or session tokens.
        pass

    def authenticated(self):
        cookies = http.cookies.SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
            token = cookies["memory_session"].value if "memory_session" in cookies else ""
        except http.cookies.CookieError:
            return False
        expires = SESSIONS.get(token, 0)
        return expires > time.time()

    def reply(self, status, data, content_type="application/json", cookie=None):
        body = json.dumps(data).encode() if content_type == "application/json" else data
        self.send_response(status)
        self.send_header("Content-Type", content_type + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' https://images.unsplash.com data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; media-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def serve_media(self, target):
        import mimetypes
        import re
        allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".webm", ".mov"}
        if target.suffix.lower() not in allowed:
            return self.reply(404, {"error": "Photo or video not found."})
        size = target.stat().st_size
        start, end, status = 0, size - 1, 200
        byte_range = self.headers.get("Range")
        if byte_range:
            match = re.fullmatch(r"bytes=(\d*)-(\d*)", byte_range.strip())
            try:
                if not match or not any(match.groups()) or size == 0:
                    raise ValueError()
                first, last = match.groups()
                if first:
                    start = int(first)
                    end = min(int(last), size - 1) if last else size - 1
                else:
                    suffix = int(last)
                    if suffix <= 0:
                        raise ValueError()
                    start = max(0, size - suffix)
                if start < 0 or start >= size or end < start:
                    raise ValueError()
                status = 206
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                return
        length = max(0, end - start + 1)
        self.send_response(status)
        self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        if self.command == "HEAD":
            return
        try:
            with target.open("rb") as stream:
                stream.seek(start)
                remaining = length
                while remaining:
                    chunk = stream.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/config":
            return self.reply(200, {"demo": DEMO, "authenticated": self.authenticated()})
        if path == "/api/story" or path.startswith(("/media/", "/photos/")):
            if not self.authenticated():
                return self.reply(401, {"error": "Please unlock the memory box first."})
            if path == "/api/story":
                return self.reply(200, json.loads((ROOT / "story.json").read_text(encoding="utf-8-sig")))
            from urllib.parse import unquote
            import mimetypes
            folder = "photos" if path.startswith("/photos/") else "media"
            media_root = (ROOT / folder).resolve()
            relative = path[len(folder) + 2:]
            target = (media_root / unquote(relative)).resolve()
            if not target.is_relative_to(media_root) or not target.is_file():
                return self.reply(404, {"error": "Photo or video not found."})
            return self.serve_media(target)
        if path in PUBLIC:
            filename, content_type = PUBLIC[path]
            return self.reply(200, (ROOT / filename).read_bytes(), content_type)
        return self.reply(404, {"error": "Not found."})

    def do_POST(self):
        path = self.path.split("?")[0]
        if self.headers.get("Sec-Fetch-Site") == "cross-site":
            return self.reply(403, {"error": "Please use this website directly."})
        if path == "/api/logout":
            cookies = http.cookies.SimpleCookie()
            try:
                cookies.load(self.headers.get("Cookie", ""))
                if "memory_session" in cookies:
                    SESSIONS.pop(cookies["memory_session"].value, None)
            except http.cookies.CookieError:
                pass
            return self.reply(200, {"ok": True}, cookie="memory_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
        if path != "/api/unlock":
            return self.reply(404, {"error": "Not found."})
        now = time.time()
        client = self.client_address[0]
        attempts = [stamp for stamp in ATTEMPTS.get(client, []) if now - stamp < 300]
        ATTEMPTS[client] = attempts
        if len(attempts) >= 5:
            return self.reply(429, {"error": "Too many tries. Take a moment and try again in five minutes."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 2048:
                raise ValueError()
            data = json.loads(self.rfile.read(length))
            answers = tuple(data.get(key, "") for key in ("myDob", "herDob", "movie"))
            if not all(isinstance(answer, str) for answer in answers):
                raise ValueError()
        except (ValueError, AttributeError, TypeError):
            return self.reply(400, {"error": "Please fill in all three answers."})
        checks = [hmac.compare_digest(digest(actual), digest(expected)) for actual, expected in zip(answers, EXPECTED)]
        if not all(checks):
            attempts.append(now)
            return self.reply(401, {"error": "Those memories don’t quite match. Check the dates and movie name, and try again."})
        ATTEMPTS.pop(client, None)
        for token, expires in list(SESSIONS.items()):
            if expires <= now:
                SESSIONS.pop(token, None)
        token = secrets.token_urlsafe(32)
        SESSIONS[token] = now + TTL
        return self.reply(200, {"ok": True}, cookie=f"memory_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={TTL}")

if __name__ == "__main__":
    print("For Sowmiya — open http://127.0.0.1:8080")
    print("Demo mode: " + ("ON (sample answers)" if DEMO else "OFF"))
    ThreadingHTTPServer(("127.0.0.1", 8080), Handler).serve_forever()
