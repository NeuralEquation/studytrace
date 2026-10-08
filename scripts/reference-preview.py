from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json

root = Path('F:/模倣サイト')
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def do_GET(self):
        if self.path.split('?')[0] == '/api/library':
            source = (root / 'js/local-library.js').read_text(encoding='utf-8-sig')
            payload = source.split('window.localCourseLibrary = ', 1)[1].strip().rstrip(';')
            body = json.dumps(json.loads(payload), ensure_ascii=False).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()
ThreadingHTTPServer(('127.0.0.1', 5193), Handler).serve_forever()
