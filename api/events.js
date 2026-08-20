const { getSql, clean } = require('./_db');

const ALLOWED_EVENTS = new Set([
  'page_view','session_start','session_end','consent_granted','screen_view','engagement',
  'mode_select','game_start','draft_spin','card_select','draft_complete','tournament_start',
  'round_start','round_end','game_end','game_abandon','replay_click','return_to_menu',
  'gala_setup','ceremony_start','award_open','share_open','share_copy','share_twitter'
]);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }
  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const eventName = clean(payload.event_name, 64);
    if (!ALLOWED_EVENTS.has(eventName)) return res.status(400).json({ ok: false, error: 'unknown_event' });

    const props = payload.props && typeof payload.props === 'object' && !Array.isArray(payload.props) ? payload.props : {};
    let active = Number(props.active_seconds || 0);
    if (!Number.isFinite(active)) active = 0;
    active = Math.max(0, Math.min(3600, active));
    const tsCandidate = new Date(payload.ts || Date.now());
    const ts = Number.isNaN(tsCandidate.getTime()) ? new Date() : tsCandidate;
    const eventId = clean(payload.event_id, 64);
    if (!eventId) return res.status(400).json({ ok: false, error: 'missing_event_id' });

    const sql = getSql();
    await sql`
      INSERT INTO events(
        event_id,ts,visitor_id,session_id,event_name,mode,stage,page_path,referrer,
        utm_source,utm_medium,utm_campaign,utm_content,utm_term,click_id_type,click_id,
        first_utm_source,first_utm_medium,first_utm_campaign,device_type,language,timezone,
        viewport,screen,active_seconds,props_json
      ) VALUES (
        ${eventId},${ts.toISOString()},${clean(payload.visitor_id,64)},${clean(payload.session_id,64)},${eventName},
        ${clean(payload.mode,32)},${clean(payload.stage,64)},${clean(payload.page_path,300)},${clean(payload.referrer,500)},
        ${clean(payload.utm_source,120)},${clean(payload.utm_medium,120)},${clean(payload.utm_campaign,160)},
        ${clean(payload.utm_content,160)},${clean(payload.utm_term,160)},${clean(payload.click_id_type,32)},${clean(payload.click_id,255)},
        ${clean(payload.first_utm_source,120)},${clean(payload.first_utm_medium,120)},${clean(payload.first_utm_campaign,160)},
        ${clean(payload.device_type,32)},${clean(payload.language,32)},${clean(payload.timezone,64)},${clean(payload.viewport,32)},
        ${clean(payload.screen,32)},${active},${JSON.stringify(props)}::jsonb
      ) ON CONFLICT (event_id) DO NOTHING
    `;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(202).json({ ok: true });
  } catch (err) {
    console.error('analytics event error', err && err.message ? err.message : err);
    const code = err && err.code === 'NO_DATABASE_URL' ? 503 : 400;
    return res.status(code).json({ ok: false, error: code === 503 ? 'database_not_configured' : 'invalid_payload' });
  }
};
