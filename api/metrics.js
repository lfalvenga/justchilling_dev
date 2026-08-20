const { getSql, sinceForDays, requireCrm } = require('./_db');

module.exports = async function handler(req, res) {
  if (!requireCrm(req, res)) return;
  try {
    const sql = getSql();
    const since = sinceForDays(req.query && req.query.days);

    const [k] = await sql`
      WITH s AS (
        SELECT session_id,
          MAX(visitor_id) visitor_id,
          SUM(CASE WHEN event_name='engagement' THEN active_seconds ELSE 0 END) active_seconds,
          MAX(CASE WHEN event_name='game_start' THEN 1 ELSE 0 END) started,
          MAX(CASE WHEN event_name='game_end' THEN 1 ELSE 0 END) ended,
          MAX(CASE WHEN event_name='game_abandon' THEN 1 ELSE 0 END) abandoned,
          SUM(CASE WHEN event_name='replay_click' THEN 1 ELSE 0 END) replays,
          MAX(CASE WHEN event_name IN ('game_start','draft_complete','game_end') THEN 1 ELSE 0 END) engaged
        FROM events WHERE received_at>=${since.toISOString()} AND COALESCE(session_id,'')<>'' GROUP BY session_id
      ) SELECT COUNT(*)::int sessions, COUNT(DISTINCT visitor_id)::int visitors,
        COALESCE(AVG(active_seconds),0)::float avg_active_seconds,
        COALESCE(SUM(started),0)::int game_starts, COALESCE(SUM(ended),0)::int game_ends,
        COALESCE(SUM(abandoned),0)::int abandons, COALESCE(SUM(replays),0)::int replays,
        COALESCE(AVG(started),0)::float start_rate,
        COALESCE(SUM(ended)::float/NULLIF(SUM(started),0),0)::float completion_rate,
        COALESCE(SUM(replays)::float/NULLIF(SUM(ended),0),0)::float replay_rate,
        COALESCE(AVG(engaged),0)::float engaged_rate FROM s
    `;
    const [pv] = await sql`SELECT COUNT(*)::int n FROM events WHERE received_at>=${since.toISOString()} AND event_name='page_view'`;
    k.pageviews = pv.n;

    const funnel = [];
    for (const ev of ['page_view','mode_select','game_start','draft_complete','game_end','replay_click']) {
      const [r] = await sql`SELECT COUNT(DISTINCT session_id)::int sessions FROM events WHERE received_at>=${since.toISOString()} AND event_name=${ev}`;
      funnel.push({ event: ev, sessions: r.sessions });
    }

    const modes = await sql`SELECT COALESCE(NULLIF(mode,''),'(sem modo)') label, COUNT(*)::int games FROM events WHERE received_at>=${since.toISOString()} AND event_name='game_start' GROUP BY mode ORDER BY games DESC`;
    const devices = await sql`WITH s AS (SELECT session_id,MAX(COALESCE(NULLIF(device_type,''),'desconhecido')) label FROM events WHERE received_at>=${since.toISOString()} GROUP BY session_id) SELECT label,COUNT(*)::int sessions FROM s GROUP BY label ORDER BY sessions DESC`;
    const abandons = await sql`
      WITH starts AS (
        SELECT COALESCE(NULLIF(mode,''),'(sem modo)') mode,COUNT(*)::int mode_starts FROM events
        WHERE received_at>=${since.toISOString()} AND event_name='game_start' GROUP BY COALESCE(NULLIF(mode,''),'(sem modo)')
      ), a AS (
        SELECT COALESCE(NULLIF(mode,''),'(sem modo)') mode,COALESCE(NULLIF(stage,''),'desconhecida') stage,COUNT(*)::int abandons
        FROM events WHERE received_at>=${since.toISOString()} AND event_name='game_abandon'
        GROUP BY COALESCE(NULLIF(mode,''),'(sem modo)'),COALESCE(NULLIF(stage,''),'desconhecida')
      ) SELECT a.mode,a.stage,a.abandons,COALESCE(starts.mode_starts,0)::int mode_starts,
        COALESCE(a.abandons::float/NULLIF(starts.mode_starts,0),0)::float abandon_rate
      FROM a LEFT JOIN starts ON starts.mode=a.mode ORDER BY a.abandons DESC,a.mode,a.stage`;
    const abandonModes = await sql`
      WITH starts AS (
        SELECT COALESCE(NULLIF(mode,''),'(sem modo)') mode,COUNT(*)::int mode_starts FROM events
        WHERE received_at>=${since.toISOString()} AND event_name='game_start' GROUP BY COALESCE(NULLIF(mode,''),'(sem modo)')
      ), a AS (
        SELECT COALESCE(NULLIF(mode,''),'(sem modo)') mode,COUNT(*)::int abandons FROM events
        WHERE received_at>=${since.toISOString()} AND event_name='game_abandon' GROUP BY COALESCE(NULLIF(mode,''),'(sem modo)')
      ) SELECT starts.mode,COALESCE(a.abandons,0)::int abandons,starts.mode_starts,
        COALESCE(COALESCE(a.abandons,0)::float/NULLIF(starts.mode_starts,0),0)::float abandon_rate
      FROM starts LEFT JOIN a ON a.mode=starts.mode ORDER BY abandons DESC,starts.mode_starts DESC`;
    const campaigns = await sql`
      WITH s AS (
        SELECT session_id,
          COALESCE(NULLIF(MAX(utm_source),''),'(direto/referral)') source,
          COALESCE(NULLIF(MAX(utm_medium),''),'—') medium,
          COALESCE(NULLIF(MAX(utm_campaign),''),'(sem campanha)') campaign,
          SUM(CASE WHEN event_name='engagement' THEN active_seconds ELSE 0 END) active_seconds,
          MAX(CASE WHEN event_name='game_start' THEN 1 ELSE 0 END) started,
          MAX(CASE WHEN event_name='game_end' THEN 1 ELSE 0 END) ended,
          SUM(CASE WHEN event_name='replay_click' THEN 1 ELSE 0 END) replays
        FROM events WHERE received_at>=${since.toISOString()} GROUP BY session_id
      ) SELECT source,medium,campaign,COUNT(*)::int sessions,SUM(started)::int game_starts,SUM(ended)::int game_ends,
        SUM(replays)::int replays,ROUND(SUM(active_seconds)::numeric,1)::float active_seconds,
        COALESCE(SUM(started)::float/COUNT(*),0)::float start_rate,
        COALESCE(SUM(ended)::float/NULLIF(SUM(started),0),0)::float completion_rate
      FROM s GROUP BY source,medium,campaign ORDER BY sessions DESC,game_starts DESC LIMIT 100`;
    const recent = await sql`SELECT ts,event_name,mode,stage,utm_campaign FROM events WHERE received_at>=${since.toISOString()} ORDER BY id DESC LIMIT 80`;

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ kpis:k, funnel, modes, devices, abandons, abandon_modes:abandonModes, campaigns, recent });
  } catch (err) {
    console.error('metrics error', err && err.message ? err.message : err);
    const code = err && err.code === 'NO_DATABASE_URL' ? 503 : 500;
    return res.status(code).json({ ok:false, error: code===503 ? 'database_not_configured' : 'metrics_error' });
  }
};
