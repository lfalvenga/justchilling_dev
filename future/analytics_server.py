#!/usr/bin/env python3
import base64, csv, hmac, io, json, os, sqlite3, sys
from datetime import datetime, timezone, timedelta
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

BASE = Path(__file__).resolve().parent
DB = Path(os.environ.get('RT_ANALYTICS_DB', BASE / 'road_to_statuette_analytics.sqlite3'))
GAME_CANDIDATES = [
    os.environ.get('RT_GAME_FILE', ''),
    'road_to_statuette_WIKIDATA_Pix.html',
    'road_to_statuette_WIKIDATA.html',
    'road_to_statuette_ANALYTICS.html',
]
CRM = BASE / 'crm.html'
JS = BASE / 'analytics.js'
HOST = os.environ.get('HOST', '127.0.0.1')
PORT = int(os.environ.get('PORT', '8080'))
MAX_BODY = 64 * 1024
CRM_USER = os.environ.get('CRM_USER', '')
CRM_PASSWORD = os.environ.get('CRM_PASSWORD', '')
ALLOWED_EVENTS = {
    'page_view','session_start','session_end','consent_granted','screen_view','engagement',
    'mode_select','game_start','draft_spin','card_select','draft_complete','tournament_start',
    'round_start','round_end','game_end','game_abandon','replay_click','return_to_menu',
    'gala_setup','ceremony_start','award_open'
}


def game_file():
    for name in GAME_CANDIDATES:
        if not name:
            continue
        path = Path(name) if Path(name).is_absolute() else BASE / name
        if path.exists():
            return path
    return BASE / 'road_to_statuette_WIKIDATA_Pix.html'

def game_source():
    path = game_file()
    try:
        mtime = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
    except Exception:
        mtime = None
    return {'game_file': path.name, 'exists': path.exists(), 'mtime': mtime}

def instrumented_game_bytes():
    path = game_file()
    if not path.exists():
        return None
    html = path.read_text(encoding='utf-8')
    tag = '<script src="/analytics.js"></script>'
    if tag not in html:
        if '</body>' in html:
            html = html.replace('</body>', tag + '\n</body>', 1)
        else:
            html += '\n' + tag
    return html.encode('utf-8')

def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA journal_mode=WAL')
    con.execute('PRAGMA synchronous=NORMAL')
    return con

def init_db():
    with db() as con:
        con.execute('''CREATE TABLE IF NOT EXISTS events(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT UNIQUE NOT NULL,
          ts TEXT NOT NULL,
          received_at TEXT NOT NULL,
          visitor_id TEXT,
          session_id TEXT,
          event_name TEXT NOT NULL,
          mode TEXT,
          stage TEXT,
          page_path TEXT,
          referrer TEXT,
          utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
          click_id_type TEXT, click_id TEXT,
          first_utm_source TEXT, first_utm_medium TEXT, first_utm_campaign TEXT,
          device_type TEXT, language TEXT, timezone TEXT, viewport TEXT, screen TEXT,
          active_seconds REAL DEFAULT 0,
          props_json TEXT NOT NULL DEFAULT '{}'
        )''')
        con.execute('CREATE INDEX IF NOT EXISTS idx_events_received ON events(received_at)')
        con.execute('CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id)')
        con.execute('CREATE INDEX IF NOT EXISTS idx_events_name ON events(event_name)')
        con.execute('CREATE INDEX IF NOT EXISTS idx_events_campaign ON events(utm_campaign)')

def clean(v, n=300):
    if v is None: return ''
    return str(v).replace('\x00','')[:n]

def period_start(days):
    try: days = max(1, min(3650, int(days)))
    except Exception: days = 30
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec='seconds')

def one(con, sql, args=()):
    return con.execute(sql, args).fetchone()

def metrics(days):
    since = period_start(days)
    with db() as con:
        k = one(con, '''WITH s AS (
          SELECT session_id,
            MAX(visitor_id) visitor_id,
            SUM(CASE WHEN event_name='engagement' THEN active_seconds ELSE 0 END) active_seconds,
            MAX(CASE WHEN event_name='game_start' THEN 1 ELSE 0 END) started,
            MAX(CASE WHEN event_name='game_end' THEN 1 ELSE 0 END) ended,
            MAX(CASE WHEN event_name='game_abandon' THEN 1 ELSE 0 END) abandoned,
            SUM(CASE WHEN event_name='replay_click' THEN 1 ELSE 0 END) replays,
            MAX(CASE WHEN event_name IN ('game_start','draft_complete','game_end') THEN 1 ELSE 0 END) engaged
          FROM events WHERE received_at>=? AND session_id<>'' GROUP BY session_id
        ) SELECT COUNT(*) sessions, COUNT(DISTINCT visitor_id) visitors,
          COALESCE(AVG(active_seconds),0) avg_active_seconds,
          COALESCE(SUM(started),0) game_starts, COALESCE(SUM(ended),0) game_ends,
          COALESCE(SUM(abandoned),0) abandons, COALESCE(SUM(replays),0) replays,
          COALESCE(AVG(started),0) start_rate, COALESCE(SUM(ended)*1.0/NULLIF(SUM(started),0),0) completion_rate,
          COALESCE(SUM(replays)*1.0/NULLIF(SUM(ended),0),0) replay_rate, COALESCE(AVG(engaged),0) engaged_rate
          FROM s''', (since,))
        pageviews = one(con, "SELECT COUNT(*) n FROM events WHERE received_at>=? AND event_name='page_view'", (since,))['n']
        kpis = dict(k); kpis['pageviews'] = pageviews

        funnel_events = ['page_view','mode_select','game_start','draft_complete','game_end','replay_click']
        funnel=[]
        for ev in funnel_events:
            n=one(con, "SELECT COUNT(DISTINCT session_id) n FROM events WHERE received_at>=? AND event_name=?",(since,ev))['n']
            funnel.append({'event':ev,'sessions':n})

        modes=[dict(r) for r in con.execute('''SELECT COALESCE(NULLIF(mode,''),'(sem modo)') label, COUNT(*) games
          FROM events WHERE received_at>=? AND event_name='game_start' GROUP BY mode ORDER BY games DESC''',(since,))]
        devices=[dict(r) for r in con.execute('''WITH s AS (SELECT session_id, MAX(COALESCE(NULLIF(device_type,''),'desconhecido')) label
          FROM events WHERE received_at>=? GROUP BY session_id) SELECT label, COUNT(*) sessions FROM s GROUP BY label ORDER BY sessions DESC''',(since,))]
        abandons=[dict(r) for r in con.execute('''WITH starts AS (
          SELECT COALESCE(NULLIF(mode,''),'(sem modo)') mode, COUNT(*) mode_starts
          FROM events WHERE received_at>=? AND event_name='game_start'
          GROUP BY COALESCE(NULLIF(mode,''),'(sem modo)')
        ), a AS (
          SELECT COALESCE(NULLIF(mode,''),'(sem modo)') mode,
                 COALESCE(NULLIF(stage,''),'desconhecida') stage, COUNT(*) abandons
          FROM events WHERE received_at>=? AND event_name='game_abandon'
          GROUP BY COALESCE(NULLIF(mode,''),'(sem modo)'), COALESCE(NULLIF(stage,''),'desconhecida')
        ) SELECT a.mode,a.stage,a.abandons,COALESCE(starts.mode_starts,0) mode_starts,
          COALESCE(a.abandons*1.0/NULLIF(starts.mode_starts,0),0) abandon_rate
          FROM a LEFT JOIN starts ON starts.mode=a.mode
          ORDER BY a.abandons DESC,a.mode,a.stage''',(since,since))]
        abandon_modes=[dict(r) for r in con.execute('''WITH starts AS (
          SELECT COALESCE(NULLIF(mode,''),'(sem modo)') mode, COUNT(*) mode_starts
          FROM events WHERE received_at>=? AND event_name='game_start'
          GROUP BY COALESCE(NULLIF(mode,''),'(sem modo)')
        ), a AS (
          SELECT COALESCE(NULLIF(mode,''),'(sem modo)') mode, COUNT(*) abandons
          FROM events WHERE received_at>=? AND event_name='game_abandon'
          GROUP BY COALESCE(NULLIF(mode,''),'(sem modo)')
        ) SELECT starts.mode,COALESCE(a.abandons,0) abandons,starts.mode_starts,
          COALESCE(COALESCE(a.abandons,0)*1.0/NULLIF(starts.mode_starts,0),0) abandon_rate
          FROM starts LEFT JOIN a ON a.mode=starts.mode
          ORDER BY abandons DESC,starts.mode_starts DESC''',(since,since))]

        campaigns=[dict(r) for r in con.execute('''WITH s AS (
          SELECT session_id,
            COALESCE(NULLIF(MAX(utm_source),''),'(direto/referral)') source,
            COALESCE(NULLIF(MAX(utm_medium),''),'—') medium,
            COALESCE(NULLIF(MAX(utm_campaign),''),'(sem campanha)') campaign,
            SUM(CASE WHEN event_name='engagement' THEN active_seconds ELSE 0 END) active_seconds,
            MAX(CASE WHEN event_name='game_start' THEN 1 ELSE 0 END) started,
            MAX(CASE WHEN event_name='game_end' THEN 1 ELSE 0 END) ended,
            SUM(CASE WHEN event_name='replay_click' THEN 1 ELSE 0 END) replays
          FROM events WHERE received_at>=? GROUP BY session_id
        ) SELECT source,medium,campaign,COUNT(*) sessions,SUM(started) game_starts,SUM(ended) game_ends,
          SUM(replays) replays,ROUND(SUM(active_seconds),1) active_seconds,
          COALESCE(SUM(started)*1.0/COUNT(*),0) start_rate,
          COALESCE(SUM(ended)*1.0/NULLIF(SUM(started),0),0) completion_rate
          FROM s GROUP BY source,medium,campaign ORDER BY sessions DESC,game_starts DESC LIMIT 100''',(since,))]
        recent=[dict(r) for r in con.execute('''SELECT ts,event_name,mode,utm_campaign FROM events
          WHERE received_at>=? ORDER BY id DESC LIMIT 80''',(since,))]
    return {'kpis':kpis,'funnel':funnel,'modes':modes,'devices':devices,'abandons':abandons,'abandon_modes':abandon_modes,'campaigns':campaigns,'recent':recent}

class Handler(BaseHTTPRequestHandler):
    server_version='RTSAnalytics/1.0'
    def log_message(self, fmt, *args):
        sys.stdout.write('%s - %s\n' % (self.address_string(), fmt%args))
    def send_bytes(self, data, ctype='text/plain; charset=utf-8', status=200, extra=None):
        self.send_response(status); self.send_header('Content-Type',ctype); self.send_header('Cache-Control','no-store')
        if extra:
            for k,v in extra.items(): self.send_header(k,v)
        self.end_headers(); self.wfile.write(data)
    def send_file(self, path, ctype):
        if not path.exists(): return self.send_bytes(b'Not found',status=404)
        self.send_bytes(path.read_bytes(),ctype)
    def crm_authorized(self):
        if not CRM_USER or not CRM_PASSWORD: return True
        raw=self.headers.get('Authorization','')
        if not raw.startswith('Basic '): return False
        try:
            userpass=base64.b64decode(raw[6:]).decode('utf-8')
            user,password=userpass.split(':',1)
            return hmac.compare_digest(user,CRM_USER) and hmac.compare_digest(password,CRM_PASSWORD)
        except Exception: return False
    def require_crm_auth(self):
        if self.crm_authorized(): return True
        self.send_response(401); self.send_header('WWW-Authenticate','Basic realm="Road to Statuette CRM"'); self.end_headers(); return False
    def do_GET(self):
        u=urlparse(self.path); q=parse_qs(u.query); days=q.get('days',['30'])[0]
        if u.path=='/':
            data=instrumented_game_bytes()
            return self.send_bytes(data,'text/html; charset=utf-8') if data is not None else self.send_bytes(b'Game file not found',status=404)
        if u.path=='/analytics.js': return self.send_file(JS,'application/javascript; charset=utf-8')
        if u.path in ('/crm','/crm/'):
            if not self.require_crm_auth(): return
            return self.send_file(CRM,'text/html; charset=utf-8')
        if u.path=='/health': return self.send_bytes(json.dumps({'ok':True,**game_source()},ensure_ascii=False).encode(),'application/json; charset=utf-8')
        if u.path=='/api/source':
            if not self.require_crm_auth(): return
            return self.send_bytes(json.dumps(game_source(),ensure_ascii=False).encode(),'application/json; charset=utf-8')
        if u.path=='/api/metrics':
            if not self.require_crm_auth(): return
            return self.send_bytes(json.dumps(metrics(days),ensure_ascii=False).encode(),'application/json; charset=utf-8')
        if u.path=='/api/export.csv':
            if not self.require_crm_auth(): return
            since=period_start(days); out=io.StringIO(); w=csv.writer(out); w.writerow(['ts','event_name','mode','stage','session_id','utm_source','utm_medium','utm_campaign','utm_content','utm_term','device_type','active_seconds','props_json'])
            with db() as con:
                for r in con.execute('''SELECT ts,event_name,mode,stage,session_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,device_type,active_seconds,props_json FROM events WHERE received_at>=? ORDER BY id''',(since,)): w.writerow(list(r))
            return self.send_bytes(out.getvalue().encode('utf-8-sig'),'text/csv; charset=utf-8',extra={'Content-Disposition':'attachment; filename="road_to_statuette_analytics.csv"'})
        self.send_bytes(b'Not found',status=404)
    def do_POST(self):
        if urlparse(self.path).path!='/api/events': return self.send_bytes(b'Not found',status=404)
        try:
            n=int(self.headers.get('Content-Length','0'))
            if n<=0 or n>MAX_BODY: return self.send_bytes(b'Bad request',status=400)
            payload=json.loads(self.rfile.read(n).decode('utf-8'))
            ev=clean(payload.get('event_name'),64)
            if ev not in ALLOWED_EVENTS: return self.send_bytes(b'Unknown event',status=400)
            props=payload.get('props') if isinstance(payload.get('props'),dict) else {}
            active=props.get('active_seconds',0)
            try: active=max(0,min(3600,float(active)))
            except Exception: active=0
            now=datetime.now(timezone.utc).isoformat(timespec='milliseconds')
            vals=(clean(payload.get('event_id'),64),clean(payload.get('ts'),40) or now,now,
                  clean(payload.get('visitor_id'),64),clean(payload.get('session_id'),64),ev,clean(payload.get('mode'),32),clean(payload.get('stage'),64),clean(payload.get('page_path'),300),clean(payload.get('referrer'),500),
                  clean(payload.get('utm_source'),120),clean(payload.get('utm_medium'),120),clean(payload.get('utm_campaign'),160),clean(payload.get('utm_content'),160),clean(payload.get('utm_term'),160),
                  clean(payload.get('click_id_type'),32),clean(payload.get('click_id'),255),clean(payload.get('first_utm_source'),120),clean(payload.get('first_utm_medium'),120),clean(payload.get('first_utm_campaign'),160),
                  clean(payload.get('device_type'),32),clean(payload.get('language'),32),clean(payload.get('timezone'),64),clean(payload.get('viewport'),32),clean(payload.get('screen'),32),active,json.dumps(props,ensure_ascii=False,separators=(',',':'))[:8000])
            with db() as con:
                con.execute('''INSERT OR IGNORE INTO events(event_id,ts,received_at,visitor_id,session_id,event_name,mode,stage,page_path,referrer,utm_source,utm_medium,utm_campaign,utm_content,utm_term,click_id_type,click_id,first_utm_source,first_utm_medium,first_utm_campaign,device_type,language,timezone,viewport,screen,active_seconds,props_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',vals)
            self.send_bytes(b'{"ok":true}','application/json; charset=utf-8',status=202)
        except Exception as e:
            self.send_bytes(json.dumps({'ok':False,'error':'invalid_payload'}).encode(),'application/json; charset=utf-8',status=400)

if __name__=='__main__':
    init_db()
    print(f'Road to Statuette analytics: http://{HOST}:{PORT}/')
    print(f'CRM: http://{HOST}:{PORT}/crm')
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
