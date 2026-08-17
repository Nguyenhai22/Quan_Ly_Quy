// ============================================================
// STATE
// ============================================================
let currentUser = null;   // auth user
let myProfile = null;     // profiles row
let myRoom = null;        // rooms row (phòng hiện tại)
let selectedIds = { income: new Set(), expense: new Set(), activity: new Set() };
let members = [];
let incomeList = [];
let expenseList = [];
let notifList = [];
let activityList = [];
let duesList = [];
let cleaningList = [];
let cleaningViewMonth = (function(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); })();

const TYPE_LABEL = {
  // Khoản thu (tiền nộp vào quỹ)
  nop_quy:'Nộp quỹ', quy_an_uong:'Quỹ ăn uống', thu_khac:'Khoản thu khác',
  // Khoản chi (tiền chi ra từ quỹ)
  thue_phong:'Tiền thuê phòng', tien_dien:'Tiền điện', tien_nuoc:'Tiền nước',
  internet:'Internet', quy_chung:'Quỹ chung', phat_sinh:'Chi phát sinh',
  do_dung_chung:'Đồ dùng chung', sua_chua:'Sửa chữa', ve_sinh:'Vệ sinh', sinh_hoat:'Sinh hoạt'
};
const ROLE_LABEL = {truong_phong:'Trưởng phòng', thu_quy:'Thủ quỹ', thanh_vien:'Thành viên'};

const NAV_ITEMS = [
  {id:'dashboard', label:'Trang chủ', ic:'🏠'},
  {id:'members', label:'Thành viên', ic:'👥'},
  {id:'income', label:'Khoản thu', ic:'💰'},
  {id:'expenses', label:'Khoản chi', ic:'🧾'},
  {id:'payments', label:'Thanh toán', ic:'✅'},
  {id:'reports', label:'Báo cáo', ic:'📊'},
  {id:'notifications', label:'Thông báo', ic:'🔔'},
  {id:'cleaning', label:'Lịch vệ sinh', ic:'🧹'},
  {id:'activity', label:'Nhật ký', ic:'📜'},
  {id:'statistics', label:'Thống kê', ic:'📈'},
  {id:'account', label:'Tài khoản', ic:'⚙️'},
];
const PAGE_TITLES = {
  dashboard:['Trang chủ','Tổng quan quỹ phòng'], members:['Thành viên','Quản lý danh sách thành viên'],
  income:['Khoản thu','Ghi nhận các khoản thu vào quỹ'], expenses:['Khoản chi','Ghi nhận các khoản chi từ quỹ'],
  payments:['Thanh toán','Theo dõi công nợ & thanh toán'],
  reports:['Báo cáo','Tổng hợp thu chi theo tháng'], notifications:['Thông báo','Thông báo tới các thành viên'],
  cleaning:['Lịch vệ sinh','Thành viên tự đăng ký lịch dọn phòng'],
  activity:['Nhật ký hoạt động','Lịch sử thao tác trong hệ thống'], statistics:['Thống kê','Biểu đồ & phân tích quỹ phòng'],
  account:['Tài khoản','Thông tin cá nhân & bảo mật']
};

function canManage(){ return myProfile && (myProfile.role==='truong_phong' || myProfile.role==='thu_quy'); }
function toggleCustomType(prefix){
  const val = document.getElementById(prefix+'-type').value;
  const wrap = document.getElementById(prefix+'-type-custom-wrap');
  if(wrap) wrap.classList.toggle('hidden', val!=='__custom__');
}
function typeLabelOf(code){ return TYPE_LABEL[code] || code; }
function fmtVND(n){ return (Math.round(n||0)).toLocaleString('vi-VN')+' đ'; }
function toast(msg, type='ok'){
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast '+type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>el.remove(), 3500);
}
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }
function openModalEl(id){ document.getElementById(id).classList.remove('hidden'); }
function showConfirm(message, onConfirm, opts={}){
  document.getElementById('confirm-title').textContent = opts.title || 'Xác nhận';
  document.getElementById('confirm-message').textContent = message;
  const okBtn = document.getElementById('confirm-ok-btn');
  okBtn.textContent = opts.okText || 'Xác nhận';
  okBtn.className = 'btn ' + (opts.danger===false ? 'btn-primary' : 'btn-danger');
  const freshBtn = okBtn.cloneNode(true); // gỡ mọi listener cũ tránh gọi trùng
  okBtn.parentNode.replaceChild(freshBtn, okBtn);
  freshBtn.addEventListener('click', ()=>{ closeModal('modal-confirm'); onConfirm(); });
  openModalEl('modal-confirm');
}
function showAlert(message, opts={}){
  document.getElementById('alert-title').textContent = opts.title || 'Thông báo';
  document.getElementById('alert-message').textContent = message;
  openModalEl('modal-alert');
}

// ============================================================
// AUTH
// ============================================================
function toggleAuth(which){
  document.getElementById('login-form').classList.toggle('hidden', which!=='login');
  document.getElementById('register-form').classList.toggle('hidden', which!=='register');
}

async function doRegister(){
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const pass = document.getElementById('reg-password').value;
  const errEl = document.getElementById('register-error');
  errEl.classList.add('hidden');
  if(!name || !email || pass.length<6){
    errEl.textContent = 'Vui lòng nhập đủ họ tên, email và mật khẩu (tối thiểu 6 ký tự).';
    errEl.classList.remove('hidden'); return;
  }
  const {data, error} = await sb.auth.signUp({email, password: pass});
  if(error){ errEl.textContent = error.message; errEl.classList.remove('hidden'); return; }
  const uid = data.user?.id;
  if(uid){
    await sb.from('profiles').insert({id:uid, full_name:name, email, phone, role:'thanh_vien'});
  }
  toast('Đăng ký thành công! Hãy đăng nhập.');
  toggleAuth('login');
}

async function doLogin(){
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');
  const {data, error} = await sb.auth.signInWithPassword({email, password: pass});
  if(error){ errEl.textContent = 'Sai email hoặc mật khẩu.'; errEl.classList.remove('hidden'); return; }
  await bootAfterLogin(data.user);
}

function askLogout(){
  showConfirm('Bạn có chắc muốn đăng xuất không?', ()=>{ doLogout(); }, {title:'Đăng xuất'});
}
async function doLogout(){
  await sb.auth.signOut();
  currentUser = null; myProfile = null; myRoom = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('room-gate-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
}

async function bootAfterLogin(user){
  try {
    currentUser = user;
    let {data: profile, error: profErr} = await sb.from('profiles').select('*').eq('id', user.id).single();
    if(profErr && profErr.code !== 'PGRST116'){
      // PGRST116 = không tìm thấy dòng nào (bình thường với user mới) — các lỗi khác thì báo rõ, không crash
      alert('Lỗi tải hồ sơ: '+profErr.message+'\n\nHãy kiểm tra lại RLS policy trên bảng profiles trong Supabase.');
      return;
    }
    if(!profile){
      // fallback: create profile if missing (e.g. first admin)
      const insertRes = await sb.from('profiles').insert({id:user.id, full_name:user.email, email:user.email, role:'thanh_vien'}).select().single();
      if(insertRes.error){ alert('Lỗi tạo hồ sơ: '+insertRes.error.message); return; }
      profile = insertRes.data;
    }
    myProfile = profile;
    document.getElementById('auth-screen').classList.add('hidden');

    if(!myProfile.room_id){
      showRoomGate();
      return;
    }
    const {data: room} = await sb.from('rooms').select('*').eq('id', myProfile.room_id).maybeSingle();
    myRoom = room || null;
    await enterApp();
  } catch(e){
    console.error('bootAfterLogin', e);
    alert('Không thể tải ứng dụng: '+(e.message||e)+'\n\nHãy kiểm tra kết nối mạng và thử tải lại trang.');
  }
}

// ============================================================
// ROOM GATE (chọn/tạo phòng trước khi vào quỹ)
// ============================================================
function showRoomGate(){
  document.getElementById('app').classList.add('hidden');
  document.getElementById('room-gate-username').textContent = myProfile.full_name || myProfile.email || 'bạn';
  document.getElementById('room-gate-screen').classList.remove('hidden');
  document.getElementById('room-create-name').value = '';
  document.getElementById('room-create-code').value = '';
  document.getElementById('room-join-code').value = '';
  document.getElementById('room-gate-error').classList.add('hidden');
  toggleRoomTab('create');
}
function toggleRoomTab(which){
  document.getElementById('room-tab-create').className = 'btn'+(which==='create'?' btn-primary':'');
  document.getElementById('room-tab-join').className = 'btn'+(which==='join'?' btn-primary':'');
  document.getElementById('room-create-form').classList.toggle('hidden', which!=='create');
  document.getElementById('room-join-form').classList.toggle('hidden', which!=='join');
  document.getElementById('room-gate-error').classList.add('hidden');
}
async function createRoom(){
  const errEl = document.getElementById('room-gate-error');
  errEl.classList.add('hidden');
  const name = document.getElementById('room-create-name').value.trim();
  const code = document.getElementById('room-create-code').value.trim().toUpperCase();
  if(!name || !code){
    errEl.textContent = 'Vui lòng nhập đủ tên phòng và mã phòng.';
    errEl.classList.remove('hidden'); return;
  }
  const {data: room, error} = await sb.from('rooms').insert({ten_phong:name, ma_phong:code, truong_phong_id: currentUser.id}).select().single();
  if(error){
    errEl.textContent = /duplicate|unique/i.test(error.message) ? 'Mã phòng này đã có người dùng, hãy chọn mã khác.' : 'Lỗi: '+error.message;
    errEl.classList.remove('hidden'); return;
  }
  const {error: upErr} = await sb.from('profiles').update({room_id: room.id, role:'truong_phong'}).eq('id', currentUser.id);
  if(upErr){ errEl.textContent = 'Lỗi cập nhật hồ sơ: '+upErr.message; errEl.classList.remove('hidden'); return; }
  myProfile.room_id = room.id; myProfile.role = 'truong_phong'; myRoom = room;
  document.getElementById('room-gate-screen').classList.add('hidden');
  await enterApp();
  toast('🎉 Đã tạo phòng "'+room.ten_phong+'"! Hãy chia sẻ mã "'+room.ma_phong+'" cho các thành viên.');
}
async function joinRoom(){
  const errEl = document.getElementById('room-gate-error');
  errEl.classList.add('hidden');
  const code = document.getElementById('room-join-code').value.trim().toUpperCase();
  if(!code){ errEl.textContent = 'Vui lòng nhập mã phòng.'; errEl.classList.remove('hidden'); return; }
  const {data: room, error} = await sb.from('rooms').select('*').eq('ma_phong', code).maybeSingle();
  if(error || !room){ errEl.textContent = 'Không tìm thấy phòng với mã này.'; errEl.classList.remove('hidden'); return; }
  const {error: upErr} = await sb.from('profiles').update({room_id: room.id}).eq('id', currentUser.id);
  if(upErr){ errEl.textContent = 'Lỗi tham gia phòng: '+upErr.message; errEl.classList.remove('hidden'); return; }
  myProfile.room_id = room.id; myRoom = room;
  document.getElementById('room-gate-screen').classList.add('hidden');
  await enterApp();
  toast('✅ Đã tham gia phòng "'+room.ten_phong+'"!');
}
async function updateRoom(){
  if(!myRoom || myProfile.role!=='truong_phong'){ toast('Chỉ Trưởng phòng mới đổi được mã phòng','err'); return; }
  const name = document.getElementById('room-manage-name').value.trim();
  const code = document.getElementById('room-manage-code').value.trim().toUpperCase();
  if(!name || !code){ toast('Vui lòng nhập đủ tên phòng và mã phòng','err'); return; }
  const {error} = await sb.from('rooms').update({ten_phong:name, ma_phong:code}).eq('id', myRoom.id);
  if(error){ toast(/duplicate|unique/i.test(error.message)?'Mã phòng này đã được dùng, chọn mã khác.':'Lỗi: '+error.message, 'err'); return; }
  myRoom.ten_phong = name; myRoom.ma_phong = code;
  const brandEl = document.getElementById('sidebar-room-name');
  if(brandEl) brandEl.textContent = name;
  toast('Đã cập nhật thông tin phòng');
}

async function enterApp(){
  document.getElementById('room-gate-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const displayName = myProfile.full_name || myProfile.email;
  document.getElementById('foot-username').textContent = displayName;
  document.getElementById('role-badge').textContent = ROLE_LABEL[myProfile.role] || 'Thành viên';
  document.getElementById('user-avatar').textContent = displayName.trim().charAt(0).toUpperCase();
  applyAvatar(document.getElementById('user-avatar'), displayName, myProfile.avatar_url);
  const nameEl = document.getElementById('topbar-username');
  if(nameEl) nameEl.textContent = displayName;
  // Sidebar footer
  const footAvatar = document.getElementById('foot-avatar-letter');
  if(footAvatar) footAvatar.textContent = displayName.trim().charAt(0).toUpperCase();
  applyAvatar(footAvatar, displayName, myProfile.avatar_url);
  const footRole = document.getElementById('foot-role');
  if(footRole) footRole.textContent = ROLE_LABEL[myProfile.role] || 'Thành viên';
  const brandEl = document.getElementById('sidebar-room-name');
  if(brandEl) brandEl.textContent = myRoom ? myRoom.ten_phong : 'Quỹ Phòng';
  buildNav();
  applyRoleVisibility();
  await loadAll();
  go('dashboard');
}

// ============================================================
// NAV / ROUTER
// ============================================================
function buildNav(){
  const nav = document.getElementById('nav-menu');
  nav.innerHTML = NAV_ITEMS.map(it =>
    `<button class="nav-item" id="nav-${it.id}" onclick="go('${it.id}')"><span class="ic">${it.ic}</span>${it.label}</button>`
  ).join('');
}
function go(pageId){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+pageId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('nav-'+pageId)?.classList.add('active');
  document.getElementById('page-title').textContent = PAGE_TITLES[pageId][0];
  document.getElementById('page-sub').textContent = PAGE_TITLES[pageId][1];
  document.getElementById('sidebar').classList.remove('open');
  if(pageId==='statistics') renderStatistics();
  if(pageId==='cleaning') renderCleaning();
  if(pageId==='account') fillAccountForm();
  if(pageId==='payments') renderMonthlyDues();
}
function applyRoleVisibility(){
  const manage = canManage();
  ['btn-add-member','btn-add-income'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = manage ? '' : 'none';
  });
  const expBtn = document.getElementById('btn-add-expense');
  if(expBtn) expBtn.style.display = ''; // tất cả thành viên đều được thêm khoản chi
}

// ============================================================
// LOAD ALL DATA
// ============================================================
// Bọc mọi truy vấn Supabase: nếu lỗi (mất mạng, RLS chặn, bảng lỗi...) sẽ báo toast
// và trả về mảng rỗng thay vì ném lỗi làm treo cả trang ở trạng thái "Đang tải…"
async function safeQuery(promise, label){
  try {
    const {data, error} = await promise;
    if(error){ console.error('['+label+']', error); toast('Không tải được '+label+': '+error.message, 'err'); return []; }
    return data || [];
  } catch(e){
    console.error('['+label+']', e);
    toast('Lỗi kết nối khi tải '+label+' (kiểm tra mạng hoặc thử tải lại trang)', 'err');
    return [];
  }
}
async function loadAll(){
  try {
    await Promise.all([loadMembers(), loadIncome(), loadExpenses(), loadNotifications(), loadActivity(), loadMonthlyDues(), loadCleaning()]);
  } catch(e){
    console.error('loadAll', e);
    toast('Có lỗi khi tải dữ liệu, một số phần có thể hiển thị thiếu. Thử tải lại trang.', 'err');
  }
  renderDashboard();
  renderMembers();
  populateMonthFilters();
  renderIncome();
  renderExpenses();
  renderMonthlyDues();
  renderNotifications();
  renderActivity();
  renderReports();
}

async function loadMonthlyDues(){
  duesList = await safeQuery(sb.from('monthly_dues').select('*').eq('room_id', myProfile.room_id).order('thang', {ascending:false}), 'quỹ chung hàng tháng');
}

async function loadMembers(){
  members = await safeQuery(sb.from('profiles').select('*').eq('room_id', myProfile.room_id).order('created_at'), 'thành viên');
}
async function loadIncome(){
  incomeList = await safeQuery(sb.from('income').select('*').eq('room_id', myProfile.room_id).order('created_at', {ascending:false}), 'khoản thu');
}
async function loadExpenses(){
  expenseList = await safeQuery(sb.from('expenses').select('*').eq('room_id', myProfile.room_id).order('created_at', {ascending:false}), 'khoản chi');
}
async function loadNotifications(){
  notifList = await safeQuery(sb.from('notifications').select('*').eq('room_id', myProfile.room_id).order('created_at', {ascending:false}), 'thông báo');
}
async function loadActivity(){
  activityList = await safeQuery(sb.from('activity_log').select('*').eq('room_id', myProfile.room_id).order('created_at', {ascending:false}).limit(200), 'nhật ký hoạt động');
}
async function logActivity(hanh_dong, bang, record_id, mo_ta){
  await sb.from('activity_log').insert({hanh_dong, bang, record_id, mo_ta, nguoi_thuc_hien: currentUser.id, room_id: myProfile.room_id});
  await loadActivity(); renderActivity();
}
function memberName(id){ const m = members.find(x=>x.id===id); return m ? (m.full_name || m.email || '—') : '—'; }
function myDisplayName(){ return myProfile ? (myProfile.full_name || myProfile.email || '—') : '—'; }

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard(){
  const totalIncome = incomeList.reduce((s,x)=>s+Number(x.so_tien),0);
  const totalExpense = expenseList.reduce((s,x)=>s+Number(x.so_tien),0);
  document.getElementById('stat-balance').textContent = fmtVND(totalIncome-totalExpense);
  document.getElementById('stat-income').textContent = fmtVND(totalIncome);
  document.getElementById('stat-income-count').textContent = incomeList.length+' khoản';
  document.getElementById('stat-expense').textContent = fmtVND(totalExpense);
  document.getElementById('stat-expense-count').textContent = expenseList.length+' khoản';
  document.getElementById('stat-members').textContent = members.filter(m=>m.status==='active').length;

  const notifWrap = document.getElementById('dashboard-notifications');
  if(!notifList.length){ notifWrap.innerHTML = '<div class="empty">Chưa có thông báo nào.</div>'; }
  else {
    notifWrap.innerHTML = '<table><tbody>' + notifList.slice(0,5).map(n=>`
      <tr><td><b>${n.tieu_de}</b><br><span style="color:var(--muted);font-size:12px">${(n.noi_dung||'').slice(0,90)}</span></td>
      <td style="white-space:nowrap;color:var(--muted);font-size:12px">${new Date(n.created_at).toLocaleDateString('vi-VN')}</td></tr>`).join('') + '</tbody></table>';
  }
  const actWrap = document.getElementById('dashboard-activity');
  if(!activityList.length){ actWrap.innerHTML = '<div class="empty">Chưa có hoạt động nào.</div>'; }
  else {
    actWrap.innerHTML = '<table><tbody>' + activityList.slice(0,6).map(a=>{
      const actor = memberName(a.nguoi_thuc_hien);
      const desc = a.mo_ta||a.hanh_dong;
      // Replace email pattern in description with actual name
      const cleanDesc = actor !== '—' ? desc.replace(/[\w.-]+@[\w.-]+\.[a-z]{2,}/gi, actor) : desc;
      return `<tr><td><span style="font-weight:600;color:var(--amber)">${actor}</span> — ${cleanDesc}</td><td style="white-space:nowrap;color:var(--muted);font-size:12px">${new Date(a.created_at).toLocaleString('vi-VN')}</td></tr>`;
    }).join('') + '</tbody></table>';
  }
}

// ============================================================
// MEMBERS
// ============================================================
function renderMembers(){
  const tbody = document.getElementById('members-tbody');
  if(!members.length){ tbody.innerHTML = '<tr><td colspan="7" class="empty">Chưa có thành viên nào.</td></tr>'; return; }
  tbody.innerHTML = members.map(m=>`
    <tr>
      <td>${avatarSpanHtml(m.full_name, m.avatar_url, 'member-avatar')}${m.full_name}</td>
      <td>${m.phone||'—'}</td>
      <td><span class="tag ${m.role==='truong_phong'?'amber':m.role==='thu_quy'?'green':'gray'}">${ROLE_LABEL[m.role]}</span></td>
      <td>${m.join_date||'—'}</td>
      <td>${m.leave_date||'—'}</td>
      <td><span class="tag ${m.status==='active'?'green':'red'}">${m.status==='active'?'Đang ở':'Đã rời'}</span></td>
      <td>${canManage() ? `<button class="btn btn-sm" onclick='openMemberModal(${JSON.stringify(m)})'>Sửa</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMember('${m.id}')">Đánh dấu rời</button>` : ''}
        ${(myProfile.role==='truong_phong' && m.id!==currentUser.id) ? `<button class="btn btn-sm btn-danger" onclick="removeMemberFromRoom('${m.id}','${(m.full_name||'').replace(/'/g,"\\'")}')">Xóa khỏi phòng</button>` : ''}</td>
    </tr>`).join('');
}
function openMemberModal(m){
  document.getElementById('member-modal-title').textContent = m ? 'Sửa thành viên' : 'Thêm thành viên';
  document.getElementById('member-id').value = m ? m.id : '';
  document.getElementById('member-name').value = m ? m.full_name : '';
  document.getElementById('member-phone').value = m ? (m.phone||'') : '';
  document.getElementById('member-role').value = m ? m.role : 'thanh_vien';
  document.getElementById('member-status').value = m ? m.status : 'active';
  document.getElementById('member-join').value = m ? (m.join_date||'') : '';
  document.getElementById('member-leave').value = m ? (m.leave_date||'') : '';
  openModalEl('modal-member');
}
async function saveMember(){
  const id = document.getElementById('member-id').value;
  const payload = {
    full_name: document.getElementById('member-name').value.trim(),
    phone: document.getElementById('member-phone').value.trim(),
    role: document.getElementById('member-role').value,
    status: document.getElementById('member-status').value,
    join_date: document.getElementById('member-join').value || null,
    leave_date: document.getElementById('member-leave').value || null,
  };
  if(!payload.full_name){ toast('Vui lòng nhập họ tên','err'); return; }
  if(id){
    await sb.from('profiles').update(payload).eq('id', id);
    await logActivity('sua','members', id, `Cập nhật thành viên ${payload.full_name}`);
  } else {
    toast('Thành viên mới cần tự đăng ký tài khoản. Bạn có thể sửa vai trò sau khi họ đăng ký.','err');
    closeModal('modal-member'); return;
  }
  closeModal('modal-member');
  await loadMembers(); renderMembers(); renderDashboard();
  toast('Đã lưu thành viên');
}
async function deleteMember(id){
  showConfirm('Đánh dấu thành viên này đã rời phòng? (vẫn giữ lịch sử thu/chi cũ)', async ()=>{
    await sb.from('profiles').update({status:'inactive'}).eq('id', id);
    await logActivity('xoa','members', id, 'Đánh dấu thành viên đã rời phòng');
    await loadMembers(); renderMembers(); renderDashboard();
    toast('Đã cập nhật trạng thái thành viên');
  });
}
async function removeMemberFromRoom(id, name){
  if(myProfile.role!=='truong_phong'){ toast('Chỉ Trưởng phòng mới xóa được thành viên khỏi phòng','err'); return; }
  if(id===currentUser.id){ toast('Bạn không thể tự xóa mình khỏi phòng ở đây.','err'); return; }
  showConfirm(`Xóa "${name}" khỏi phòng? Người này sẽ mất quyền xem dữ liệu phòng ngay lập tức và cần nhập lại mã phòng nếu muốn tham gia lại.`, async ()=>{
    const {error} = await sb.from('profiles').update({room_id:null, role:'thanh_vien'}).eq('id', id);
    if(error){ toast('Lỗi: '+error.message,'err'); return; }
    await logActivity('xoa','members', id, `Xóa ${name} khỏi phòng`);
    await loadMembers(); renderMembers(); renderDashboard();
    toast(`Đã xóa "${name}" khỏi phòng`);
  }, {title:'Xóa khỏi phòng'});
}

// ============================================================
// FILE UPLOAD HELPER
// ============================================================
async function uploadReceipt(inputEl, folder){
  const file = inputEl.files[0];
  if(!file) return null;
  const path = `${folder}/${Date.now()}_${file.name.replace(/\s+/g,'_')}`;
  const {error} = await sb.storage.from('receipts').upload(path, file);
  if(error){ toast('Lỗi tải ảnh: '+error.message, 'err'); return null; }
  const {data} = sb.storage.from('receipts').getPublicUrl(path);
  return data.publicUrl;
}
function showImage(url){
  document.getElementById('image-preview-src').src = url;
  openModalEl('modal-image');
}

// ============================================================
// INCOME
// ============================================================
function currentMonthStr(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function populateMonthFilters(){
  const months = new Set([...incomeList.map(x=>x.thang), ...expenseList.map(x=>x.thang), currentMonthStr()]);
  const arr = Array.from(months).sort().reverse();
  const latestMonth = arr[0] || currentMonthStr();
  const opts = '<option value="">Tất cả tháng</option>' + arr.map(m=>`<option value="${m}">${m}</option>`).join('');

  const incomeSel = document.getElementById('income-filter-month');
  const incomeKeep = incomeSel.dataset.userSet==='1' && arr.includes(incomeSel.value) ? incomeSel.value : latestMonth;
  incomeSel.innerHTML = opts;
  incomeSel.value = incomeKeep;

  const expenseSel = document.getElementById('expense-filter-month');
  const expenseKeep = expenseSel.dataset.userSet==='1' && arr.includes(expenseSel.value) ? expenseSel.value : latestMonth;
  expenseSel.innerHTML = opts;
  expenseSel.value = expenseKeep;

  document.getElementById('report-month').innerHTML = arr.map(m=>`<option value="${m}">${m}</option>`).join('');
  document.getElementById('income-month').value = currentMonthStr();
  document.getElementById('expense-month').value = currentMonthStr();

  const duesMonths = new Set([...arr, ...duesList.map(x=>x.thang), currentMonthStr()]);
  const duesArr = Array.from(duesMonths).sort().reverse();
  const duesSel = document.getElementById('dues-month');
  const keepVal = duesSel.value || currentMonthStr();
  duesSel.innerHTML = duesArr.map(m=>`<option value="${m}">${m}</option>`).join('');
  duesSel.value = duesArr.includes(keepVal) ? keepVal : currentMonthStr();
}
function renderIncome(){
  const monthF = document.getElementById('income-filter-month').value;
  const typeF = document.getElementById('income-filter-type').value;
  let rows = incomeList.filter(x=>(!monthF||x.thang===monthF)&&(!typeF||x.loai===typeF));
  const tbody = document.getElementById('income-tbody');
  const rowIds = new Set(rows.map(x=>x.id));
  selectedIds.income.forEach(id=>{ if(!rowIds.has(id)) selectedIds.income.delete(id); });
  if(!rows.length){ tbody.innerHTML = '<tr><td colspan="8" class="empty">Không có khoản thu nào.</td></tr>'; updateBulkBar('income'); return; }
  tbody.innerHTML = rows.map(x=>{
    const canDel = canManage();
    return `
    <tr>
      <td>${canDel ? `<input type="checkbox" class="row-check-income" data-id="${x.id}" ${selectedIds.income.has(x.id)?'checked':''} onchange="toggleSelectOne('income','${x.id}',this.checked)">` : ''}</td>
      <td>${x.hinh_anh_url ? `<img src="${x.hinh_anh_url}" class="thumb" onclick="showImage('${x.hinh_anh_url}')">` : '—'}</td>
      <td><span class="tag green">${typeLabelOf(x.loai)}</span></td>
      <td>${x.mo_ta||'—'}</td>
      <td class="num" style="color:var(--green);font-weight:700">${fmtVND(x.so_tien)}</td>
      <td>${x.thang}</td>
      <td>${memberName(x.nguoi_tao)}</td>
      <td>${canDel ? `<button class="btn btn-sm" onclick="editIncome('${x.id}')">Sửa</button> <button class="btn btn-sm btn-danger" onclick="deleteIncome('${x.id}')">Xóa</button>` : ''}</td>
    </tr>`;
  }).join('');
  updateBulkBar('income');
}
function openIncomeModal(){
  document.getElementById('income-modal-title').textContent = 'Thêm khoản thu';
  document.getElementById('income-id').value='';
  document.getElementById('income-type').value='nop_quy';
  document.getElementById('income-amount').value='';
  document.getElementById('income-month').value=currentMonthStr();
  document.getElementById('income-desc').value='';
  document.getElementById('income-image').value='';
  document.getElementById('income-type-custom').value='';
  toggleCustomType('income');
  openModalEl('modal-income');
}
function editIncome(id){
  const x = incomeList.find(i=>i.id===id);
  if(!x) return;
  document.getElementById('income-modal-title').textContent = 'Sửa khoản thu';
  document.getElementById('income-id').value = x.id;
  const isKnownType = ['nop_quy','quy_an_uong','thu_khac'].includes(x.loai);
  document.getElementById('income-type').value = isKnownType ? x.loai : '__custom__';
  document.getElementById('income-type-custom').value = isKnownType ? '' : x.loai;
  document.getElementById('income-amount').value = x.so_tien;
  document.getElementById('income-month').value = x.thang;
  document.getElementById('income-desc').value = x.mo_ta || '';
  document.getElementById('income-image').value = '';
  toggleCustomType('income');
  openModalEl('modal-income');
}
async function saveIncome(){
  const amount = Number(document.getElementById('income-amount').value);
  if(!amount || amount<=0){ toast('Vui lòng nhập số tiền hợp lệ','err'); return; }
  let loai = document.getElementById('income-type').value;
  if(loai==='__custom__'){
    loai = document.getElementById('income-type-custom').value.trim();
    if(!loai){ toast('Vui lòng nhập tên loại khoản thu','err'); return; }
  }
  const editId = document.getElementById('income-id').value;
  let imgUrl = await uploadReceipt(document.getElementById('income-image'), 'income');
  const payload = {
    loai,
    so_tien: amount,
    mo_ta: document.getElementById('income-desc').value.trim(),
    thang: document.getElementById('income-month').value || currentMonthStr(),
  };
  if(imgUrl) payload.hinh_anh_url = imgUrl;
  if(editId){
    const original = incomeList.find(i=>i.id===editId);
    const {error} = await sb.from('income').update(payload).eq('id', editId);
    if(error){ toast('Lỗi khi lưu: '+error.message, 'err'); return; }
    await logActivity('sua','income', editId, `Sửa khoản thu ${typeLabelOf(payload.loai)}: ${fmtVND(amount)}`);
    if(payload.loai==='nop_quy' && original) await autoMarkDuePaid(original.nguoi_tao, payload.thang);
    closeModal('modal-income');
    await loadIncome(); populateMonthFilters(); renderIncome(); renderDashboard(); renderReports();
    toast('Đã cập nhật khoản thu');
    return;
  }
  payload.nguoi_tao = currentUser.id;
  payload.room_id = myProfile.room_id;
  const {error} = await sb.from('income').insert(payload);
  if(error){ toast('Lỗi khi lưu: '+error.message, 'err'); return; }
  await logActivity('them','income', null, `Thêm khoản thu ${typeLabelOf(payload.loai)}: ${fmtVND(amount)}`);
  if(payload.loai==='nop_quy') await autoMarkDuePaid(currentUser.id, payload.thang);
  closeModal('modal-income');
  await loadIncome(); populateMonthFilters(); renderIncome(); renderDashboard(); renderReports();
  toast('Đã thêm khoản thu');
}
// Tự động đánh dấu "Đã nộp" cho quỹ chung hàng tháng khi có khoản thu "Nộp quỹ" khớp thành viên + tháng
async function autoMarkDuePaid(memberId, month){
  if(!memberId || !month) return;
  await loadMonthlyDues();
  const due = duesList.find(d=>d.member_id===memberId && d.thang===month);
  if(!due || due.da_nop) return;
  await sb.from('monthly_dues').update({da_nop:true, ngay_nop:new Date().toISOString()}).eq('id', due.id);
  await logActivity('thanh_toan','monthly_dues', due.id, `${memberName(memberId)} đã nộp quỹ chung tháng ${month} (tự động từ khoản thu)`);
  await loadMonthlyDues();
  if(document.getElementById('page-payments') && document.getElementById('page-payments').classList.contains('active')) renderMonthlyDues();
}
async function deleteIncome(id){
  showConfirm('Xóa khoản thu này?', async ()=>{
    await sb.from('income').delete().eq('id', id);
    await logActivity('xoa','income', id, 'Xóa một khoản thu');
    await loadIncome(); renderIncome(); renderDashboard(); renderReports();
    toast('Đã xóa khoản thu');
  });
}

// ============================================================
// EXPENSES
// ============================================================
function renderExpenses(){
  const monthF = document.getElementById('expense-filter-month').value;
  const typeF = document.getElementById('expense-filter-type').value;
  let rows = expenseList.filter(x=>(!monthF||x.thang===monthF)&&(!typeF||x.loai===typeF));
  const tbody = document.getElementById('expenses-tbody');
  const rowIds = new Set(rows.map(x=>x.id));
  selectedIds.expense.forEach(id=>{ if(!rowIds.has(id)) selectedIds.expense.delete(id); });
  if(!rows.length){ tbody.innerHTML = '<tr><td colspan="8" class="empty">Không có khoản chi nào.</td></tr>'; updateBulkBar('expense'); return; }
  tbody.innerHTML = rows.map(x=>{
    const canDel = canManage() || x.nguoi_tao===currentUser.id;
    return `
    <tr>
      <td>${canDel ? `<input type="checkbox" class="row-check-expense" data-id="${x.id}" ${selectedIds.expense.has(x.id)?'checked':''} onchange="toggleSelectOne('expense','${x.id}',this.checked)">` : ''}</td>
      <td>${x.hinh_anh_url ? `<img src="${x.hinh_anh_url}" class="thumb" onclick="showImage('${x.hinh_anh_url}')">` : '—'}</td>
      <td><span class="tag red">${typeLabelOf(x.loai)}</span></td>
      <td>${x.mo_ta||'—'}</td>
      <td class="num" style="color:var(--red);font-weight:700">${fmtVND(x.so_tien)}</td>
      <td>${x.thang}</td>
      <td>${memberName(x.nguoi_tao)}</td>
      <td>
        ${canDel ? `<button class="btn btn-sm" onclick="editExpense('${x.id}')">Sửa</button> <button class="btn btn-sm btn-danger" onclick="deleteExpense('${x.id}')">Xóa</button>` : ''}
      </td>
    </tr>`;
  }).join('');
  updateBulkBar('expense');
}
function openExpenseModal(){
  document.getElementById('expense-modal-title').textContent = 'Thêm khoản chi';
  document.getElementById('expense-id').value='';
  document.getElementById('expense-type').value='do_dung_chung';
  document.getElementById('expense-amount').value='';
  document.getElementById('expense-month').value=currentMonthStr();
  document.getElementById('expense-desc').value='';
  document.getElementById('expense-image').value='';
  document.getElementById('expense-type-custom').value='';
  toggleCustomType('expense');
  openModalEl('modal-expense');
}
function editExpense(id){
  const x = expenseList.find(i=>i.id===id);
  if(!x) return;
  document.getElementById('expense-modal-title').textContent = 'Sửa khoản chi';
  document.getElementById('expense-id').value = x.id;
  const knownTypes = ['thue_phong','tien_dien','tien_nuoc','internet','quy_chung','do_dung_chung','sua_chua','ve_sinh','sinh_hoat','phat_sinh'];
  const isKnownType = knownTypes.includes(x.loai);
  document.getElementById('expense-type').value = isKnownType ? x.loai : '__custom__';
  document.getElementById('expense-type-custom').value = isKnownType ? '' : x.loai;
  document.getElementById('expense-amount').value = x.so_tien;
  document.getElementById('expense-month').value = x.thang;
  document.getElementById('expense-desc').value = x.mo_ta || '';
  document.getElementById('expense-image').value = '';
  toggleCustomType('expense');
  openModalEl('modal-expense');
}
async function saveExpense(){
  const amount = Number(document.getElementById('expense-amount').value);
  if(!amount || amount<=0){ toast('Vui lòng nhập số tiền hợp lệ','err'); return; }
  let loai = document.getElementById('expense-type').value;
  if(loai==='__custom__'){
    loai = document.getElementById('expense-type-custom').value.trim();
    if(!loai){ toast('Vui lòng nhập tên loại khoản chi','err'); return; }
  }
  const editId = document.getElementById('expense-id').value;
  let imgUrl = await uploadReceipt(document.getElementById('expense-image'), 'expenses');
  const payload = {
    loai,
    so_tien: amount,
    mo_ta: document.getElementById('expense-desc').value.trim(),
    thang: document.getElementById('expense-month').value || currentMonthStr(),
  };
  if(imgUrl) payload.hinh_anh_url = imgUrl;
  if(editId){
    const {error} = await sb.from('expenses').update(payload).eq('id', editId);
    if(error){ toast('Lỗi khi lưu: '+error.message, 'err'); return; }
    await logActivity('sua','expenses', editId, `Sửa khoản chi ${typeLabelOf(payload.loai)}: ${fmtVND(amount)}`);
    closeModal('modal-expense');
    await loadExpenses(); populateMonthFilters(); renderExpenses(); renderDashboard(); renderReports();
    toast('Đã cập nhật khoản chi');
    return;
  }
  payload.nguoi_tao = currentUser.id;
  payload.room_id = myProfile.room_id;
  const {error} = await sb.from('expenses').insert(payload);
  if(error){ toast('Lỗi khi lưu: '+error.message, 'err'); return; }
  await logActivity('them','expenses', null, `Thêm khoản chi ${typeLabelOf(payload.loai)}: ${fmtVND(amount)}`);
  closeModal('modal-expense');
  await loadExpenses(); populateMonthFilters(); renderExpenses(); renderDashboard(); renderReports();
  toast('Đã thêm khoản chi');
}
async function deleteExpense(id){
  showConfirm('Xóa khoản chi này?', async ()=>{
    await sb.from('expenses').delete().eq('id', id);
    await logActivity('xoa','expenses', id, 'Xóa một khoản chi');
    await loadExpenses(); renderExpenses(); renderDashboard(); renderReports();
    toast('Đã xóa khoản chi');
  });
}

// ============================================================
// CHỌN NHIỀU / XÓA HÀNG LOẠT (khoản thu & khoản chi)
// ============================================================
function toggleSelectOne(kind, id, checked){
  if(checked) selectedIds[kind].add(id); else selectedIds[kind].delete(id);
  updateBulkBar(kind);
}
function toggleSelectAll(kind, checked){
  const boxes = document.querySelectorAll('.row-check-'+kind);
  boxes.forEach(b=>{
    b.checked = checked;
    if(checked) selectedIds[kind].add(b.dataset.id); else selectedIds[kind].delete(b.dataset.id);
  });
  updateBulkBar(kind);
}
function updateBulkBar(kind){
  const n = selectedIds[kind].size;
  const btn = document.getElementById('btn-bulk-delete-'+kind);
  const countEl = document.getElementById('bulk-count-'+kind);
  if(countEl) countEl.textContent = n;
  if(btn) btn.classList.toggle('hidden', n===0);
  const selectAll = document.getElementById(kind+'-select-all');
  const boxes = document.querySelectorAll('.row-check-'+kind);
  if(selectAll) selectAll.checked = boxes.length>0 && n===boxes.length;
}
async function bulkDelete(kind){
  const ids = Array.from(selectedIds[kind]);
  if(!ids.length) return;
  const conf = {
    income:   {table:'income',         label:'khoản thu'},
    expense:  {table:'expenses',       label:'khoản chi'},
    activity: {table:'activity_log',  label:'dòng nhật ký'},
  }[kind];
  showConfirm(`Xóa ${ids.length} ${conf.label} đã chọn? Không thể hoàn tác.`, async ()=>{
    await sb.from(conf.table).delete().in('id', ids);
    selectedIds[kind].clear();
    if(kind==='income'){ await loadIncome(); renderIncome(); renderDashboard(); renderReports(); }
    else if(kind==='expense'){ await loadExpenses(); renderExpenses(); renderDashboard(); renderReports(); }
    else if(kind==='activity'){ activityList = activityList.filter(x=>!ids.includes(x.id)); renderActivity(); }
    if(kind!=='activity') await logActivity('xoa', conf.table, null, `Xóa hàng loạt ${ids.length} ${conf.label}`);
    toast(`Đã xóa ${ids.length} ${conf.label}`);
  });
}

// ============================================================
// QUỸ CHUNG HÀNG THÁNG (MONTHLY DUES)
// ============================================================
function activeMembers(){ return members.filter(m=>m.status==='active'); }
async function setMonthlyDueAmount(){
  if(!canManage()){ toast('Chỉ trưởng phòng/thủ quỹ mới đặt được mức quỹ','err'); return; }
  const month = document.getElementById('dues-month').value || currentMonthStr();
  const amount = Number(document.getElementById('dues-amount-input').value);
  if(!amount || amount<=0){ toast('Vui lòng nhập mức quỹ hợp lệ','err'); return; }
  const list = activeMembers();
  for(const m of list){
    const existing = duesList.find(d=>d.member_id===m.id && d.thang===month);
    if(existing){
      await sb.from('monthly_dues').update({so_tien: amount}).eq('id', existing.id);
    } else {
      await sb.from('monthly_dues').insert({member_id: m.id, thang: month, so_tien: amount, da_nop:false, room_id: myProfile.room_id});
    }
  }
  await logActivity('them','monthly_dues', null, `Đặt mức quỹ chung ${fmtVND(amount)}/người cho tháng ${month}`);
  document.getElementById('dues-amount-input').value = '';
  await loadMonthlyDues(); populateMonthFilters(); renderMonthlyDues();
  toast('Đã áp dụng mức quỹ cho tháng '+month);
}
function renderMonthlyDues(){
  document.getElementById('dues-manage-controls').style.display = canManage() ? 'flex' : 'none';
  const month = document.getElementById('dues-month').value || currentMonthStr();
  const list = activeMembers();
  const tbody = document.getElementById('dues-tbody');
  if(!list.length){ tbody.innerHTML = '<tr><td colspan="5" class="empty">Chưa có thành viên đang ở phòng.</td></tr>'; return; }
  const rows = list.map(m=>{
    const due = duesList.find(d=>d.member_id===m.id && d.thang===month);
    const isMe = myProfile && m.id === myProfile.id;
    const canAct = canManage() || isMe;
    let statusCell, actionCell;
    if(!due || due.so_tien===0){
      statusCell = '<span class="tag gray">Chưa đặt mức quỹ</span>';
      actionCell = '';
    } else if(due.da_nop){
      statusCell = '<span class="tag green">Đã nộp</span>';
      actionCell = '';
    } else {
      statusCell = '<span class="tag red">Chưa nộp</span>';
      actionCell = canAct ? `<button class="btn btn-sm btn-primary" onclick="markDuePaid('${due.id}')">Đánh dấu đã nộp</button>` : '';
    }
    return `<tr>
      <td><span class="member-avatar">${m.full_name.charAt(0).toUpperCase()}</span>${m.full_name}</td>
      <td class="num">${due ? fmtVND(due.so_tien) : '—'}</td>
      <td>${statusCell}</td>
      <td>${due && due.ngay_nop ? new Date(due.ngay_nop).toLocaleDateString('vi-VN') : '—'}</td>
      <td>${actionCell}</td>
    </tr>`;
  });
  tbody.innerHTML = rows.join('');
}
async function markDuePaid(dueId){
  await sb.from('monthly_dues').update({da_nop:true, ngay_nop:new Date().toISOString()}).eq('id', dueId);
  const due = duesList.find(d=>d.id===dueId);
  await logActivity('thanh_toan','monthly_dues', dueId, `${memberName(due?.member_id)} đã nộp quỹ chung tháng ${due?.thang}`);
  await loadMonthlyDues(); renderMonthlyDues(); renderDashboard();
  toast('Đã ghi nhận nộp quỹ');
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function renderNotifications(){
  const wrap = document.getElementById('notif-list');
  if(!notifList.length){ wrap.innerHTML = '<div class="empty">Chưa có thông báo nào.</div>'; return; }
  const typeLabel = {nhac_dong_tien:'Nhắc đóng tiền', thu_moi:'Khoản thu mới', chi_moi:'Khoản chi mới', hop_phong:'Họp phòng', chung:'Chung'};
  const canDel = canManage();
  wrap.innerHTML = '<table><tbody>' + notifList.map(n=>`
    <tr>
      <td style="width:110px"><span class="tag amber">${typeLabel[n.loai]}</span></td>
      <td><b>${n.tieu_de}</b><br><span style="color:var(--muted);font-size:12.5px">${n.noi_dung||''}</span></td>
      <td style="white-space:nowrap;color:var(--muted);font-size:12px">${new Date(n.created_at).toLocaleString('vi-VN')}</td>
      <td>${canDel ? `<button class="btn btn-sm btn-danger" onclick="deleteNotif('${n.id}')">Xóa</button>` : ''}</td>
    </tr>`).join('') + '</tbody></table>';
}
async function deleteNotif(id){
  showConfirm('Xóa thông báo này?', async ()=>{
    await sb.from('notifications').delete().eq('id', id);
    await logActivity('xoa','notifications', id, 'Xóa một thông báo');
    await loadNotifications(); renderNotifications(); renderDashboard();
    toast('Đã xóa thông báo');
  });
}
function openNotifModal(){
  document.getElementById('notif-type').value='chung';
  document.getElementById('notif-title').value='';
  document.getElementById('notif-content').value='';
  openModalEl('modal-notif');
}
async function saveNotif(){
  const title = document.getElementById('notif-title').value.trim();
  if(!title){ toast('Vui lòng nhập tiêu đề','err'); return; }
  await sb.from('notifications').insert({
    tieu_de:title, noi_dung: document.getElementById('notif-content').value.trim(),
    loai: document.getElementById('notif-type').value, nguoi_tao: currentUser.id, room_id: myProfile.room_id
  });
  closeModal('modal-notif');
  await loadNotifications(); renderNotifications(); renderDashboard();
  toast('Đã đăng thông báo');
}

// ============================================================
// ACTIVITY LOG
// ============================================================
function renderActivity(){
  const tbody = document.getElementById('activity-tbody');
  const rowIds = new Set(activityList.map(a=>a.id));
  selectedIds.activity.forEach(id=>{ if(!rowIds.has(id)) selectedIds.activity.delete(id); });
  if(!activityList.length){ tbody.innerHTML = '<tr><td colspan="7" class="empty">Chưa có hoạt động nào.</td></tr>'; updateBulkBar('activity'); return; }
  const actLabel = {them:'Thêm', sua:'Sửa', xoa:'Xóa', thanh_toan:'Thanh toán'};
  const bangLabel = {
    notifications:'Thông báo', cleaning_schedule:'Lịch vệ sinh', expenses:'Khoản chi',
    income:'Khoản thu',
    payments:'Thanh toán', monthly_dues:'Quỹ tháng', profiles:'Thành viên', rooms:'Phòng'
  };
  const canDel = canManage();
  tbody.innerHTML = activityList.map(a=>{
    const actor = memberName(a.nguoi_thuc_hien);
    const rawDesc = a.mo_ta||'';
    // Replace email addresses in description with actual member name
    const cleanDesc = actor !== '—' ? rawDesc.replace(/[\w.-]+@[\w.-]+\.[a-z]{2,}/gi, actor) : rawDesc;
    return `<tr>
      <td>${canDel ? `<input type="checkbox" class="row-check-activity" data-id="${a.id}" ${selectedIds.activity.has(a.id)?'checked':''} onchange="toggleSelectOne('activity','${a.id}',this.checked)">` : ''}</td>
      <td style="white-space:nowrap">${new Date(a.created_at).toLocaleString('vi-VN')}</td>
      <td><span class="tag gray">${actLabel[a.hanh_dong]||a.hanh_dong}</span></td>
      <td>${bangLabel[a.bang]||a.bang}</td>
      <td>${cleanDesc}</td>
      <td><span class="member-avatar" style="font-size:10px">${actor.charAt(0).toUpperCase()}</span>${actor}</td>
      <td>${canDel ? `<button class="btn btn-sm btn-danger" onclick="deleteActivity('${a.id}')">Xóa</button>` : ''}</td>
    </tr>`;
  }).join('');
  updateBulkBar('activity');
}
async function deleteActivity(id){
  showConfirm('Xóa dòng nhật ký này?', async ()=>{
    await sb.from('activity_log').delete().eq('id', id);
    activityList = activityList.filter(x=>x.id!==id);
    renderActivity();
    toast('Đã xóa dòng nhật ký');
  });
}

// ============================================================
// REPORTS
// ============================================================
function monthsAvailable(){
  return Array.from(new Set([...incomeList.map(x=>x.thang), ...expenseList.map(x=>x.thang)])).sort();
}
function renderReports(){
  const monthSel = document.getElementById('report-month');
  const month = monthSel.value || currentMonthStr();
  const inc = incomeList.filter(x=>x.thang===month).reduce((s,x)=>s+Number(x.so_tien),0);
  const exp = expenseList.filter(x=>x.thang===month).reduce((s,x)=>s+Number(x.so_tien),0);
  const debt = duesList.filter(d=>d.thang===month && !d.da_nop).reduce((s,d)=>s+Number(d.so_tien),0);
  document.getElementById('rep-income').textContent = fmtVND(inc);
  document.getElementById('rep-expense').textContent = fmtVND(exp);
  document.getElementById('rep-diff').textContent = fmtVND(inc-exp);
  document.getElementById('rep-debt').textContent = fmtVND(debt);

  const months = monthsAvailable();
  const tbody = document.getElementById('report-tbody');
  if(!months.length){ tbody.innerHTML = '<tr><td colspan="4" class="empty">Chưa có dữ liệu.</td></tr>'; return; }
  tbody.innerHTML = months.slice().reverse().map(m=>{
    const mi = incomeList.filter(x=>x.thang===m).reduce((s,x)=>s+Number(x.so_tien),0);
    const me = expenseList.filter(x=>x.thang===m).reduce((s,x)=>s+Number(x.so_tien),0);
    return `<tr><td>${m}</td><td class="num" style="color:var(--green)">${fmtVND(mi)}</td><td class="num" style="color:var(--red)">${fmtVND(me)}</td><td class="num" style="font-weight:700">${fmtVND(mi-me)}</td></tr>`;
  }).join('');
}
function exportReportCSV(){
  const months = monthsAvailable();
  let csv = 'Thang,Tong thu,Tong chi,So du\n';
  months.forEach(m=>{
    const mi = incomeList.filter(x=>x.thang===m).reduce((s,x)=>s+Number(x.so_tien),0);
    const me = expenseList.filter(x=>x.thang===m).reduce((s,x)=>s+Number(x.so_tien),0);
    csv += `${m},${mi},${me},${mi-me}\n`;
  });
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'bao_cao_quy_phong.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// STATISTICS
// ============================================================
let chartMonthly, chartExpenseStructure;
function renderStatistics(){
  const months = monthsAvailable();
  const incData = months.map(m=>incomeList.filter(x=>x.thang===m).reduce((s,x)=>s+Number(x.so_tien),0));
  const expData = months.map(m=>expenseList.filter(x=>x.thang===m).reduce((s,x)=>s+Number(x.so_tien),0));

  if(chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(document.getElementById('chart-monthly'), {
    type:'bar',
    data:{labels:months, datasets:[
      {label:'Thu', data:incData, backgroundColor:'#3E7A5C'},
      {label:'Chi', data:expData, backgroundColor:'#B4483A'}
    ]},
    options:{responsive:true, plugins:{title:{display:true,text:'Thu - Chi theo tháng'}}}
  });

  const structure = {};
  expenseList.forEach(x=>{ structure[x.loai] = (structure[x.loai]||0) + Number(x.so_tien); });
  const labels = Object.keys(structure).map(k=>typeLabelOf(k));
  const vals = Object.values(structure);
  if(chartExpenseStructure) chartExpenseStructure.destroy();
  chartExpenseStructure = new Chart(document.getElementById('chart-expense-structure'), {
    type:'doughnut',
    data:{labels, datasets:[{data:vals, backgroundColor:['#D98E2E','#3E7A5C','#B4483A','#16302E','#6E7C79','#F3E3C8']}]},
    options:{responsive:true, plugins:{title:{display:true,text:'Cơ cấu chi phí'}}}
  });

  const debtByMember = {};
  duesList.filter(d=>!d.da_nop).forEach(d=>{
    debtByMember[d.member_id] = (debtByMember[d.member_id]||0) + Number(d.so_tien);
  });
  const wrap = document.getElementById('debtors-list');
  const ids = Object.keys(debtByMember);
  if(!ids.length){ wrap.innerHTML = '<div class="empty">Không có ai còn nợ. 🎉</div>'; return; }
  wrap.innerHTML = '<table><tbody>' + ids.map(id=>`
    <tr><td><span class="member-avatar">${memberName(id).charAt(0).toUpperCase()}</span>${memberName(id)}</td>
    <td class="num" style="color:var(--red);font-weight:700">${fmtVND(debtByMember[id])}</td></tr>`).join('') + '</tbody></table>';
}

// ============================================================
// LỊCH VỆ SINH
// ============================================================
async function loadCleaning(){
  cleaningList = await safeQuery(sb.from('cleaning_schedule').select('*').eq('room_id', myProfile.room_id).order('ngay'), 'lịch vệ sinh');
}

function changeCleaningMonth(delta){
  const [y,m] = cleaningViewMonth.split('-').map(Number);
  const d = new Date(y, m-1+delta, 1);
  cleaningViewMonth = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  renderCleaning();
}

function renderCleaning(){
  const [year, month] = cleaningViewMonth.split('-').map(Number);
  const labelDate = new Date(year, month-1, 1);
  document.getElementById('cleaning-month-label').textContent =
    labelDate.toLocaleDateString('vi-VN',{month:'long',year:'numeric'});

  const firstDay = new Date(year, month-1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = (firstDay.getDay()+6)%7; // T2=0

  const today = new Date().toISOString().slice(0,10);
  const dayNames = ['T2','T3','T4','T5','T6','T7','CN'];

  let html = '<div class="cal-header">'+dayNames.map(d=>`<div class="cal-head-cell">${d}</div>`).join('')+'</div>';
  html += '<div class="cal-grid">';

  for(let i=0;i<startDow;i++) html+='<div class="cal-cell cal-empty"></div>';

  for(let day=1;day<=daysInMonth;day++){
    const dateStr = `${cleaningViewMonth}-${String(day).padStart(2,'0')}`;
    const dayCleanings = cleaningList.filter(c=>c.ngay===dateStr);
    const isToday = dateStr===today;
    const isPast = dateStr<today;
    const isMeReg = myProfile && dayCleanings.some(c=>c.member_id===myProfile.id);

    html += `<div class="cal-cell${isToday?' cal-today':''}${isPast?' cal-past':''}">` ;
    html += `<span class="cal-day-num${isToday?' cal-today-num':''} ${(firstDay.getDay()+day-2+1)%7>=5?'cal-weekend':''}">${day}</span>`;

    dayCleanings.forEach(c=>{
      const name = memberName(c.member_id);
      const isDone = c.trang_thai==='da_lam';
      const isMe = myProfile && c.member_id===myProfile.id;
      const caMap = {sang:'S\u00e1ng',chieu:'Chi\u1ec1u',ca_ngay:'C\u1ea3 ng\u00e0y'};
      html += `<div class="cal-slot${isDone?' cal-slot-done':''}">
        <span class="cal-slot-av">${name.charAt(0).toUpperCase()}</span>
        <span class="cal-slot-name">${name}</span>
        ${isDone?'<span class="cal-done-icon">\u2713</span>':''}
        <span class="cal-slot-ca">${caMap[c.ca]||''}</span>
        <span class="cal-slot-acts">
          ${isMe&&!isDone?`<button class="cal-act-btn cal-act-done" onclick="markCleaningDone('${c.id}','${dateStr}')" title="\u0110\u00e3 l\u00e0m">\u2713</button>`:''}
          ${(isMe||canManage())?`<button class="cal-act-btn cal-act-del" onclick="deleteCleaning('${c.id}','${dateStr}')" title="H\u1ee7y">\u00d7</button>`:''}
        </span>
      </div>`;
    });

    if(!isPast && !isMeReg && myProfile){
      html += `<button class="cal-reg-btn" onclick="openCleaningModal('${dateStr}')">+ \u0110\u0103ng k\u00fd</button>`;
    }

    html += '</div>';
  }

  const total = startDow+daysInMonth;
  const rem = total%7;
  if(rem>0) for(let i=0;i<7-rem;i++) html+='<div class="cal-cell cal-empty"></div>';
  html += '</div>';

  document.getElementById('cleaning-calendar').innerHTML = html;
  renderUpcomingCleaning();
}

function renderUpcomingCleaning(){
  const today = new Date().toISOString().slice(0,10);
  const upcoming = [...cleaningList]
    .filter(c=>c.ngay>=today)
    .sort((a,b)=>a.ngay.localeCompare(b.ngay))
    .slice(0,15);

  const wrap = document.getElementById('upcoming-cleaning-list');
  if(!upcoming.length){ wrap.innerHTML='<div class="empty">Ch\u01b0a c\u00f3 l\u1ecbch v\u1ec7 sinh n\u00e0o s\u1eafp t\u1edbi.<br><small style="color:var(--muted)">H\u00e3y nh\u1ea5n n\u00fat \u201c\ud83e\uddf9 \u0110\u0103ng k\u00fd v\u1ec7 sinh\u201d \u0111\u1ec3 th\u00eam l\u1ecbch!</small></div>'; return; }

  const caLabel = {sang:'Bu\u1ed5i s\u00e1ng',chieu:'Bu\u1ed5i chi\u1ec1u',ca_ngay:'C\u1ea3 ng\u00e0y'};
  wrap.innerHTML = '<table><tbody>'+upcoming.map(c=>{
    const isMe = myProfile && c.member_id===myProfile.id;
    const isDone = c.trang_thai==='da_lam';
    const d = new Date(c.ngay+'T12:00:00');
    const dateDisplay = d.toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
    const name = memberName(c.member_id);
    return `<tr>
      <td style="white-space:nowrap;font-weight:600">${dateDisplay}</td>
      <td><span class="tag amber">${caLabel[c.ca]||c.ca}</span></td>
      <td><span class="member-avatar">${name.charAt(0).toUpperCase()}</span>${name}</td>
      <td>${c.ghi_chu||'\u2014'}</td>
      <td><span class="tag ${isDone?'green':'red'}">${isDone?'\u2713 \u0110\u00e3 l\u00e0m':'Ch\u01b0a l\u00e0m'}</span></td>
      <td style="white-space:nowrap">
        ${isMe&&!isDone?`<button class="btn btn-sm btn-primary" onclick="markCleaningDone('${c.id}','${c.ngay}')">✓ Xong</button>`:''}
        ${(isMe||canManage())?`<button class="btn btn-sm btn-danger" onclick="deleteCleaning('${c.id}','${c.ngay}')">H\u1ee7y</button>`:''}
      </td>
    </tr>`;
  }).join('')+'</tbody></table>';
}

function openCleaningModal(dateStr){
  const localToday = (function(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); })();
  document.getElementById('cleaning-date').value = dateStr || localToday;
  document.getElementById('cleaning-ca').value = 'ca_ngay';
  document.getElementById('cleaning-note').value = '';
  openModalEl('modal-cleaning');
}

async function saveCleaning(){
  if(!myProfile){ toast('Vui l\u00f2ng \u0111\u0103ng nh\u1eadp','err'); return; }
  const date = document.getElementById('cleaning-date').value;
  const ca = document.getElementById('cleaning-ca').value;
  const note = document.getElementById('cleaning-note').value.trim();
  if(!date){ toast('Vui l\u00f2ng ch\u1ecdn ng\u00e0y','err'); return; }
  const existing = cleaningList.find(c=>c.ngay===date && c.member_id===myProfile.id);
  if(existing){ toast('B\u1ea1n \u0111\u00e3 \u0111\u0103ng k\u00fd v\u1ec7 sinh ng\u00e0y n\u00e0y r\u1ed3i!','err'); return; }
  const {error} = await sb.from('cleaning_schedule').insert({
    ngay:date, member_id:myProfile.id, ca, ghi_chu:note,
    trang_thai:'chua_lam', nguoi_tao:currentUser.id, room_id: myProfile.room_id
  });
  if(error){ toast('L\u1ed7i: '+error.message,'err'); return; }
  await logActivity('them','cleaning_schedule',null,`${memberName(myProfile.id)} \u0111\u0103ng k\u00fd v\u1ec7 sinh ng\u00e0y ${date}`);
  closeModal('modal-cleaning');
  await loadCleaning(); renderCleaning();
  toast('\ud83e\uddf9 \u0110\u00e3 \u0111\u0103ng k\u00fd l\u1ecbch v\u1ec7 sinh!');
}

async function markCleaningDone(id, dateStr){
  await sb.from('cleaning_schedule').update({trang_thai:'da_lam'}).eq('id',id);
  await logActivity('sua','cleaning_schedule',id,`\u0110\u00e3 ho\u00e0n th\u00e0nh v\u1ec7 sinh ng\u00e0y ${dateStr}`);
  await loadCleaning(); renderCleaning();
  toast('\ud83c\udf89 Ghi nh\u1eadn ho\u00e0n th\u00e0nh v\u1ec7 sinh!');
}

async function deleteCleaning(id, dateStr){
  showConfirm('Hủy đăng ký vệ sinh ngày '+dateStr+'?', async ()=>{
    await sb.from('cleaning_schedule').delete().eq('id',id);
    await logActivity('xoa','cleaning_schedule',id,'Hủy đăng ký vệ sinh ngày '+dateStr);
    await loadCleaning(); renderCleaning();
    toast('Đã hủy đăng ký vệ sinh');
  });
}

// ============================================================
// ACCOUNT
// ============================================================
function applyAvatar(el, name, avatarUrl){
  if(!el) return;
  if(avatarUrl){
    el.style.backgroundImage = `url('${avatarUrl}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = (name||'?').trim().charAt(0).toUpperCase();
  }
}
function avatarSpanHtml(name, avatarUrl, className){
  const letter = (name||'?').trim().charAt(0).toUpperCase();
  if(avatarUrl) return `<span class="${className}" style="background-image:url('${avatarUrl}');background-size:cover;background-position:center;color:transparent"></span>`;
  return `<span class="${className}">${letter}</span>`;
}
function fillAccountForm(){
  document.getElementById('acc-name').value = myProfile.full_name || '';
  document.getElementById('acc-phone').value = myProfile.phone || '';
  document.getElementById('acc-avatar-input').value = '';
  applyAvatar(document.getElementById('acc-avatar-preview'), myProfile.full_name, myProfile.avatar_url);
  const roomWrap = document.getElementById('room-manage-card-wrap');
  if(roomWrap){
    const isLeader = myProfile.role==='truong_phong';
    roomWrap.style.display = isLeader ? '' : 'none';
    if(isLeader && myRoom){
      document.getElementById('room-manage-name').value = myRoom.ten_phong || '';
      document.getElementById('room-manage-code').value = myRoom.ma_phong || '';
    }
  }
}
function previewAccountAvatar(){
  const input = document.getElementById('acc-avatar-input');
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e=>{
    const el = document.getElementById('acc-avatar-preview');
    el.style.backgroundImage = `url('${e.target.result}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  };
  reader.readAsDataURL(file);
}
async function updateProfile(){
  const name = document.getElementById('acc-name').value.trim();
  const phone = document.getElementById('acc-phone').value.trim();
  if(!name){ toast('Vui lòng nhập họ tên','err'); return; }
  const payload = {full_name:name, phone};
  const avatarInput = document.getElementById('acc-avatar-input');
  if(avatarInput.files[0]){
    const url = await uploadReceipt(avatarInput, 'avatars');
    if(url) payload.avatar_url = url;
  }
  const {error} = await sb.from('profiles').update(payload).eq('id', currentUser.id);
  if(error){ toast('Lỗi: '+error.message, 'err'); return; }
  Object.assign(myProfile, payload);
  document.getElementById('foot-username').textContent = name;
  applyAvatar(document.getElementById('user-avatar'), name, myProfile.avatar_url);
  const nameEl = document.getElementById('topbar-username');
  if(nameEl) nameEl.textContent = name;
  applyAvatar(document.getElementById('foot-avatar-letter'), name, myProfile.avatar_url);
  avatarInput.value = '';
  await loadMembers(); renderMembers();
  await loadMembers(); renderMembers();
  toast('Đã cập nhật thông tin cá nhân');
}
async function changePassword(){
  const pass = document.getElementById('acc-newpass').value;
  if(pass.length<6){ toast('Mật khẩu cần tối thiểu 6 ký tự','err'); return; }
  const {error} = await sb.auth.updateUser({password: pass});
  if(error){ toast('Lỗi: '+error.message,'err'); return; }
  document.getElementById('acc-newpass').value='';
  toast('Đã đổi mật khẩu');
}

// ============================================================
// INIT
// ============================================================
(async function init(){
  try {
    const {data:{session}} = await sb.auth.getSession();
    if(session?.user){ await bootAfterLogin(session.user); }
  } catch(e){
    console.error('init', e);
    alert('Không thể kết nối máy chủ: '+(e.message||e)+'\n\nHãy kiểm tra kết nối mạng và thử tải lại trang.');
  }
})();
