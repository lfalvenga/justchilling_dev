const { getSql, sinceForDays, requireCrm } = require('./_db');
function csvCell(v){ const s=String(v ?? ''); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
module.exports = async function handler(req,res){
  if(!requireCrm(req,res)) return;
  try{
    const sql=getSql(); const since=sinceForDays(req.query&&req.query.days);
    const rows=await sql`SELECT ts,event_name,mode,stage,session_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,device_type,active_seconds,props_json::text props_json FROM events WHERE received_at>=${since.toISOString()} ORDER BY id`;
    const cols=['ts','event_name','mode','stage','session_id','utm_source','utm_medium','utm_campaign','utm_content','utm_term','device_type','active_seconds','props_json'];
    const body='\ufeff'+[cols.join(','),...rows.map(r=>cols.map(c=>csvCell(r[c])).join(','))].join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="road_to_statuette_analytics.csv"');
    res.setHeader('Cache-Control','no-store');
    return res.status(200).send(body);
  }catch(err){ console.error('export error',err&&err.message?err.message:err); return res.status(500).json({ok:false,error:'export_error'}); }
};
