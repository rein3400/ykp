export const OPS_SESSION_HEADERS = ['chat_id','state_json','last_update_id','last_reply','updated_at','user_id'];
export function sessionTabAction(headers: string[] | undefined): 'create'|'write_headers'|'ready' {
 if(headers===undefined)return 'create';
 if(!headers.some(h=>h.trim()))return 'write_headers';
 if(JSON.stringify(headers)!==JSON.stringify(OPS_SESSION_HEADERS))throw new Error('Ops session schema differs; manual reviewed migration required');
 return 'ready';
}
export const OPS_COMMANDS = [
 ['start','Mulai atau hubungkan akun'],['menu','Semua menu Operasional'],['opening','Isi checklist pembukaan'],
 ['closing','Isi checklist penutupan'],['checklist','Isi checklist operasional'],['incident','Laporkan insiden'],
 ['complaint','Laporkan keluhan customer'],['waste','Laporkan bahan terbuang'],['stock','Laporkan selisih stok'],
 ['qc','Isi penilaian Visual QC'],['kds','Laporkan waktu pelayanan'],['briefing','Baca briefing outlet'],
 ['batal','Batalkan draft'],['link','Hubungkan akun: /link KODE']
].map(([command,description])=>({command,description}));
