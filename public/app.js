(() => {
  const $ = (id) => document.getElementById(id);

  // ---------- i18n Translations ----------
  const I18N = {
    ar: {
      dir: 'rtl',
      lang_name: 'English',
      toggle_text: '🌐 English',
      toggle_short: 'EN',
      page_title: 'خدمة العملاء | Taager Live Chat',
      login_title: 'خدمة العملاء',
      login_sub: 'سجّل الدخول للبدء في الرد على العملاء',
      login_username_placeholder: 'اسم المستخدم',
      login_password_placeholder: 'كلمة المرور',
      login_btn: 'تسجيل الدخول',
      login_err: 'اسم المستخدم أو كلمة المرور غير صحيحة',
      search_placeholder: 'ابحث بالاسم أو الرقم…',
      composer_placeholder: 'اكتب رسالة…',
      all_tabs: 'الكل',
      unassigned: 'غير مُسندة',
      assigned_to: 'الموظف',
      via: 'عبر',
      no_contacts: 'لا توجد محادثات بعد',
      empty_title: 'اختر محادثة للبدء',
      empty_sub: 'ستظهر رسائل العملاء هنا لحظة وصولها',
      loading_chat: 'جارٍ تحميل المحادثة…',
      demo_banner: 'وضع تجريبي: بيانات وهمية بدون اتصال بـ Boostrify',
      tpl_bar_text: '⚠️ انتهت نافذة الـ 24 ساعة — البدء من جديد يتم بقالب رسالة معتمد',
      send_tpl_btn: 'إرسال قالب',
      new_chat_title: 'محادثة جديدة',
      new_chat_line_label: 'من أي رقم تريد المراسلة؟',
      new_chat_phone_label: 'رقم العميل (صيغة دولية بدون +)',
      new_chat_name_label: 'اسم العميل (اختياري)',
      new_chat_name_placeholder: 'مثال: أحمد محمد',
      cancel_btn: 'إلغاء',
      start_chat_btn: 'بدء المحادثة',
      tpl_modal_title: 'إرسال قالب رسالة',
      tpl_select_label: 'القالب:',
      send_btn: 'إرسال',
      close_btn: 'إغلاق',
      admin_title: 'إدارة الموظفين وتخصيص أرقام الدول',
      add_employee_title: 'إضافة موظف جديد',
      add_employee_name: 'الاسم (مثال: أحمد علي)',
      add_employee_username: 'اسم المستخدم (username)',
      add_employee_password: 'كلمة المرور',
      allowed_lines_title: 'الأرقام المسموح له بالرد والإرسال منها:',
      add_employee_btn: 'إضافة الموظف',
      all_countries_admin: 'جميع الدول والأرقام (مدير)',
      no_lines_allowed: 'لا توجد أرقام مسموحة',
      change_password: 'كلمة المرور',
      allowed_lines_btn: 'الأرقام المسموحة',
      deactivate_btn: 'تعطيل',
      activate_btn: 'تفعيل',
      new_pass_prompt: 'كلمة مرور جديدة لـ',
      min_pass_err: 'كلمة المرور 4 أحرف على الأقل',
      select_lines_prompt: 'حدد أرقام الدول المسموح لـ',
      enabled: 'مفعل',
      disabled: 'معطل',
      require_one_line_err: 'يرجى اختيار رقم دولة واحد على الأقل للموظف',
      max_file_err: 'الحد الأقصى لحجم الملف 16 ميجابايت',
      send_failed: 'فشل الإرسال:',
      no_templates_err: 'لا توجد قوالب مضافة. أضف القوالب المعتمدة من Meta في ملف templates.json',
      role_super_admin: 'مدير عام',
      role_admin: 'مشرف / أدمن',
      role_agent: 'موظف',
      can_manage_users_label: '🔑 السماح لهذا الأدمن بإنشاء وإدارة المستخدمين',
      grant_user_mgmt: 'منح صلاحية اليوزرات',
      revoke_user_mgmt: 'سحب صلاحية اليوزرات',
      badge_user_mgmt: '🔑 يدير المستخدمين',
      today: 'اليوم',
      yesterday: 'أمس',
      photo_preview: '📷 صورة',
      audio_preview: '🎤 رسالة صوتية',
      doc_preview: '📄 ملف',
      file_label: 'ملف',
      image_label: 'صورة',
      footer_text: '© 2026 Taager.com • تم الإنشاء بواسطة فريق iTTaager Team',
    },
    en: {
      dir: 'ltr',
      lang_name: 'العربية',
      toggle_text: '🌐 العربية',
      toggle_short: 'AR',
      page_title: 'Customer Support | Taager Live Chat',
      login_title: 'Customer Support',
      login_sub: 'Sign in to start responding to customers',
      login_username_placeholder: 'Username',
      login_password_placeholder: 'Password',
      login_btn: 'Sign In',
      login_err: 'Invalid username or password',
      search_placeholder: 'Search by name or number…',
      composer_placeholder: 'Type a message…',
      all_tabs: 'All',
      unassigned: 'Unassigned',
      assigned_to: 'Agent',
      via: 'via',
      no_contacts: 'No conversations yet',
      empty_title: 'Select a chat to start',
      empty_sub: 'Customer messages will appear here in real time',
      loading_chat: 'Loading conversation…',
      demo_banner: 'Demo Mode: Mock data without live Boostrify connection',
      tpl_bar_text: '⚠️ 24-hour window closed — Start with an approved message template',
      send_tpl_btn: 'Send Template',
      new_chat_title: 'New Conversation',
      new_chat_line_label: 'Send from which number?',
      new_chat_phone_label: 'Customer number (international format without +)',
      new_chat_name_label: 'Customer name (optional)',
      new_chat_name_placeholder: 'e.g. John Doe',
      cancel_btn: 'Cancel',
      start_chat_btn: 'Start Chat',
      tpl_modal_title: 'Send Message Template',
      tpl_select_label: 'Template:',
      send_btn: 'Send',
      close_btn: 'Close',
      admin_title: 'Staff Management & Country Line Assignment',
      add_employee_title: 'Add New Employee',
      add_employee_name: 'Name (e.g. John Doe)',
      add_employee_username: 'Username',
      add_employee_password: 'Password',
      allowed_lines_title: 'Allowed country numbers for this employee:',
      add_employee_btn: 'Add Employee',
      all_countries_admin: 'All Countries & Numbers (Admin)',
      no_lines_allowed: 'No allowed numbers',
      change_password: 'Password',
      allowed_lines_btn: 'Allowed Lines',
      deactivate_btn: 'Deactivate',
      activate_btn: 'Activate',
      new_pass_prompt: 'New password for',
      min_pass_err: 'Password must be at least 4 characters',
      select_lines_prompt: 'Select allowed country numbers for',
      enabled: 'Active',
      disabled: 'Disabled',
      require_one_line_err: 'Please select at least one country number',
      max_file_err: 'Maximum file size is 16MB',
      send_failed: 'Failed to send:',
      no_templates_err: 'No templates found. Add Meta-approved templates in templates.json',
      role_super_admin: 'Super Admin',
      role_admin: 'Admin',
      role_agent: 'Agent',
      can_manage_users_label: '🔑 Allow this Admin to create & manage users',
      grant_user_mgmt: 'Grant User Mgmt',
      revoke_user_mgmt: 'Revoke User Mgmt',
      badge_user_mgmt: '🔑 Can Manage Users',
      today: 'Today',
      yesterday: 'Yesterday',
      photo_preview: '📷 Photo',
      audio_preview: '🎤 Voice message',
      doc_preview: '📄 Document',
      file_label: 'File',
      image_label: 'Photo',
      footer_text: '© 2026 Taager.com • Created by iTTaager Team',
    },
  };

  let curLang = localStorage.getItem('taager_lang') || 'ar';
  const t = (k) => I18N[curLang]?.[k] || I18N.ar[k] || k;

  function applyLanguage(lang) {
    curLang = lang;
    localStorage.setItem('taager_lang', lang);
    const dict = I18N[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = dict.dir;
    document.title = dict.page_title;

    // Update data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (dict[key]) el.textContent = dict[key];
    });

    // Update placeholders
    if ($('login-username')) $('login-username').placeholder = dict.login_username_placeholder;
    if ($('login-password')) $('login-password').placeholder = dict.login_password_placeholder;
    if ($('search')) $('search').placeholder = dict.search_placeholder;
    if ($('text')) $('text').placeholder = dict.composer_placeholder;
    if ($('new-name')) $('new-name').placeholder = dict.new_chat_name_placeholder;
    if ($('u-name')) $('u-name').placeholder = dict.add_employee_name;
    if ($('u-username')) $('u-username').placeholder = dict.add_employee_username;
    if ($('u-password')) $('u-password').placeholder = dict.add_employee_password;

    // Update language toggle buttons
    if ($('lang-toggle-login')) $('lang-toggle-login').textContent = dict.toggle_text;
    if ($('lang-toggle-app')) $('lang-toggle-app').textContent = dict.toggle_short;

    if (state.user) {
      $('whoami').textContent = `${state.user.name}${state.user.role === 'admin' ? ' • ' + dict.role_admin : ''}`;
      renderTabs();
      renderContacts();
      if (state.active) renderMessages();
    }
  }

  function toggleLanguage() {
    applyLanguage(curLang === 'ar' ? 'en' : 'ar');
  }

  // ---------- State ----------
  const state = {
    contacts: [],
    active: null,
    messages: [],
    file: null,
    socket: null,
    lines: [],
    allLines: [],
    line: 'all',
  };

  // Track IDs of messages sent by THIS browser tab to avoid socket echo duplicates
  const sentByMe = new Set();

  const lineName = (id) => (state.allLines || state.lines).find((l) => l.id === id)?.name || id;
  const chatUrl = (c, tail) => `/api/contacts/${encodeURIComponent(c.line)}/${encodeURIComponent(c.phone)}/${tail}`;
  const isActive = (c) => state.active && state.active.line === c.line && state.active.phone === c.phone;

  const esc = (s = '') => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const linkify = (s) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color:#00a884;text-decoration:underline">$1</a>');
  const hue = (s = '') => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const avatar = (c) => `style="background:hsl(${hue(c.phone)} 55% 42%)"`;
  const label = (c) => c.name || '+' + c.phone;
  const initial = (c) => (c.name || c.phone).trim().charAt(0).toUpperCase();

  const fmtTime = (ts) => new Date(ts).toLocaleTimeString(curLang === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = (ts) => {
    const d = new Date(ts), now = new Date();
    if (d.toDateString() === now.toDateString()) return t('today');
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return t('yesterday');
    return d.toLocaleDateString(curLang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const fmtList = (ts) => {
    if (!ts) return '';
    const d = new Date(ts), now = new Date();
    return d.toDateString() === now.toDateString() ? fmtTime(ts) : d.toLocaleDateString(curLang === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' });
  };

  async function api(path, opts = {}) {
    const res = await fetch(path, opts);
    if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  }

  // ---------- Auth & Login ----------
  function showLogin() {
    $('login').classList.remove('hidden');
    $('app').classList.add('hidden');
  }

  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-error').textContent = '';
    try {
      await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: $('login-username').value, password: $('login-password').value }),
      });
      start();
    } catch {
      $('login-error').textContent = t('login_err');
    }
  });

  $('logout').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
  });

  $('lang-toggle-login').addEventListener('click', toggleLanguage);
  $('lang-toggle-app').addEventListener('click', toggleLanguage);

  async function start() {
    try { state.user = await api('/api/me'); } catch { return; }
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    const roleLabel = state.user.role === 'super_admin' ? t('role_super_admin') : (state.user.role === 'admin' ? t('role_admin') : '');
    $('whoami').textContent = `${state.user.name}${roleLabel ? ' • ' + roleLabel : ''}`;
    const isAdmin = state.user.role === 'super_admin' || state.user.role === 'admin';
    $('admin-btn').classList.toggle('hidden', !isAdmin);
    state.users = await api('/api/users');
    state.templates = await api('/api/templates');
    const info = await api('/api/lines');
    state.lines = info.lines;
    state.allLines = info.allLines || info.lines;
    $('demo-banner').classList.toggle('hidden', !info.demo);
    applyLanguage(curLang);
    await loadContacts();
    connectSocket();
  }

  // ---------- Socket.IO ----------
  function connectSocket() {
    if (state.socket) state.socket.disconnect();
    const s = (state.socket = io());
    s.on('connect', () => $('conn').classList.add('on'));
    s.on('disconnect', () => $('conn').classList.remove('on'));
    s.on('message', onIncoming);
    s.on('refresh', async () => {
      try {
        const [me, info] = await Promise.all([api('/api/me'), api('/api/lines')]);
        if (me) {
          state.user = me;
          const isAdmin = me.role === 'super_admin' || me.role === 'admin';
          $('admin-btn').classList.toggle('hidden', !isAdmin);
        }
        if (info) {
          state.lines = info.lines;
          state.allLines = info.allLines || info.lines;
          if (state.line !== 'all' && !state.lines.some((l) => l.id === state.line)) {
            state.line = 'all';
          }
        }
      } catch { /* ignore */ }
      loadContacts();
    });
    s.on('status', ({ id, oldId, status }) => {
      const m = state.messages.find((x) => x.id === id || (oldId && x.id === oldId));
      if (m) {
        m.status = status;
        if (id && m.id !== id) m.id = id;
        const targetId = oldId || id;
        const el = document.querySelector(`[data-id="${CSS.escape(targetId)}"]`) ||
                   document.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (el) {
          el.dataset.id = id;
          const tick = el.querySelector('.tick');
          if (tick) paintTick(tick, status);
        }
      }
    });
  }

  function onIncoming(m) {
    const active = state.active && state.active.line === m.line && state.active.phone === m.phone;

    // Ignore socket echo for messages we sent from this tab
    if (m.direction === 'out' && sentByMe.has(m.id)) {
      sentByMe.delete(m.id);
      return;
    }

    if (active) {
      if (m.direction === 'out') {
        // Find existing matching outgoing message (by ID or content within 45 seconds)
        const matchIdx = state.messages.findIndex((x) =>
          x.id === m.id ||
          (x.direction === 'out' &&
           ((m.type === 'text' && x.body === m.body) || (m.type !== 'text' && (x.type === m.type || x.body === m.body))) &&
           Math.abs((x.ts || 0) - (m.ts || 0)) < 45000)
        );

        if (matchIdx >= 0) {
          const old = state.messages[matchIdx];
          const oldId = old.id;
          state.messages[matchIdx] = { ...old, ...m, id: m.id || old.id };
          const el = document.querySelector(`.msg[data-id="${CSS.escape(oldId)}"]`);
          if (el) {
            el.dataset.id = m.id || oldId;
            const tick = el.querySelector('.tick');
            if (tick) paintTick(tick, m.status || 'sent');
          }
          loadContacts();
          return;
        }
      }

      if (!state.messages.some((x) => x.id === m.id)) {
        state.messages.push(m);
        appendMessage(m);
        if (m.direction === 'in') {
          state.windowOpen = true;
          updateComposer();
          fetch(chatUrl(m, 'messages?sync=0')); // mark read
        }
      }
    }
    if (m.direction === 'in' && (!active || document.hidden)) beep();
    loadContacts();
  }

  function beep() {
    try {
      const a = new AudioContext(), o = a.createOscillator(), g = a.createGain();
      o.frequency.value = 880; g.gain.value = .05; o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + .12);
    } catch { /* autoplay blocked */ }
  }

  // ---------- Contacts & Tabs ----------
  async function loadContacts() {
    state.contacts = await api('/api/contacts');
    renderContacts();
  }

  function renderTabs() {
    const unread = (id) => state.contacts.filter((c) => (id === 'all' || c.line === id) && !isActive(c)).reduce((a, c) => a + c.unread, 0);
    const tabs = [{ id: 'all', name: t('all_tabs') }, ...state.lines];
    $('tabs').innerHTML = tabs.map((tab) => {
      const n = unread(tab.id);
      return `<button class="tab ${state.line === tab.id ? 'active' : ''}" data-line="${esc(tab.id)}">${esc(tab.name)}${n ? `<span class="badge">${n}</span>` : ''}</button>`;
    }).join('');
    $('tabs').classList.toggle('hidden', state.lines.length < 2);
  }

  $('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) {
      state.line = btn.dataset.line;
      renderTabs();
      renderContacts();
    }
  });

  function renderContacts() {
    renderTabs();
    const q = $('search').value.trim().toLowerCase();
    const list = state.contacts.filter((c) =>
      (state.line === 'all' || c.line === state.line) && (!q || label(c).toLowerCase().includes(q) || c.phone.includes(q)));

    $('contacts').innerHTML = list.map((c) => `
      <li class="contact ${isActive(c) ? 'active' : ''}" data-line="${esc(c.line)}" data-phone="${esc(c.phone)}">
        <div class="avatar" ${avatar(c)}>${esc(initial(c))}</div>
        <div class="c-main">
          <div class="c-row"><span class="name">${esc(label(c))}</span><span class="time">${fmtList(c.last_message_at)}</span></div>
          <div class="c-row"><span class="preview">${esc(c.last_preview)}</span>${c.unread && !isActive(c) ? `<span class="badge">${c.unread}</span>` : ''}</div>
          ${contactTag(c)}
        </div>
      </li>`).join('') || `<li class="preview" style="padding:28px;text-align:center">${t('no_contacts')}</li>`;
  }

  function contactTag(c) {
    const parts = [];
    parts.push(`${t('via')} ${esc(lineName(c.line))}`);
    if (c.owner == null) return `<div class="c-line unassigned">${t('unassigned')}${parts.length ? ' • ' + parts.join(' ') : ''}</div>`;
    if (state.user.role === 'admin' || state.user.role === 'super_admin') parts.push(`${t('assigned_to')}: ${esc(c.owner_name || '')}`);
    return parts.length ? `<div class="c-line">${parts.join(' • ')}</div>` : '';
  }

  $('search').addEventListener('input', renderContacts);
  $('contacts').addEventListener('click', (e) => {
    const li = e.target.closest('.contact');
    if (li) openChat(li.dataset.line, li.dataset.phone);
  });

  // ---------- Chat Thread ----------
  async function openChat(line, phone) {
    const c = state.contacts.find((x) => x.line === line && x.phone === phone) || { line, phone };
    state.active = c;
    $('empty').classList.add('hidden');
    $('thread').classList.remove('hidden');
    $('app').classList.add('open');
    $('head-name').textContent = label(c);
    $('head-phone').textContent = '+' + c.phone;
    const isAdmin = state.user.role === 'super_admin' || state.user.role === 'admin';
    // Show edit-name button for admins only
    const editNameBtn = $('btn-edit-name');
    if (editNameBtn) editNameBtn.style.display = isAdmin ? '' : 'none';
    if (isAdmin && state.lines.length > 1) {
      $('head-line').innerHTML = `${t('via')} <select id="head-line-select" style="background:#1f2c34;color:#00a884;border:1px solid #2a3942;border-radius:6px;padding:1px 6px;font-size:12px;font-family:inherit;cursor:pointer">` +
        state.lines.map((l) => `<option value="${esc(l.id)}" ${l.id === line ? 'selected' : ''}>${esc(l.name)}</option>`).join('') +
        `</select>`;
      $('head-line-select')?.addEventListener('change', async (ev) => {
        const targetLine = ev.target.value;
        if (targetLine === line) return;
        try {
          const switched = await api('/api/chats', jsonOpts('POST', { line: targetLine, phone: c.phone, name: c.name || '' }));
          await loadContacts();
          openChat(switched.line, switched.phone);
        } catch (err) {
          alert(err.message);
          ev.target.value = line;
        }
      });
    } else {
      $('head-line').textContent = `${t('via')} ${lineName(line)}`;
    }
    $('head-avatar').outerHTML = `<div id="head-avatar" class="avatar" ${avatar(c)}>${esc(initial(c))}</div>`;
    clearAttachment();
    renderContacts();
    $('messages').innerHTML = `<div class="day">${t('loading_chat')}</div>`;

    try {
      const r = await api(chatUrl(c, 'messages'));
      state.messages = r.messages;
      state.windowOpen = r.windowOpen;
      state.active = { ...c, ...r.contact };
    } catch { return; }

    renderMessages();
    renderOwnerSelect();
    updateComposer();
    loadContacts();

    if (!state.windowOpen && !state.messages.length) openTemplateModal();
    else $('text').focus();
  }

  function renderOwnerSelect() {
    const sel = $('owner-select');
    const canAssign = state.user.role === 'admin' || state.user.role === 'super_admin';
    sel.classList.toggle('hidden', !canAssign);
    if (!canAssign) return;
    const agents = (state.users || []).filter((u) => u.active);
    sel.innerHTML = `<option value="">${t('unassigned')}</option>` +
      agents.map((u) => `<option value="${u.id}" ${state.active.owner === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
  }

  $('owner-select').addEventListener('change', async (e) => {
    await api(`/api/chats/${encodeURIComponent(state.active.line)}/${encodeURIComponent(state.active.phone)}/owner`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: e.target.value || null }),
    });
    state.active.owner = e.target.value ? Number(e.target.value) : null;
    loadContacts();
  });

  function updateComposer() {
    $('composer').classList.toggle('hidden', !state.windowOpen);
    if ($('quick-bar')) $('quick-bar').classList.toggle('hidden', !state.windowOpen);
    $('tpl-bar').classList.toggle('hidden', state.windowOpen);
  }

  function renderMessages() {
    const box = $('messages');
    box.innerHTML = '';
    let lastDay = '';
    for (const m of state.messages) {
      const d = new Date(m.ts).toDateString();
      if (d !== lastDay) { lastDay = d; box.insertAdjacentHTML('beforeend', `<div class="day">${fmtDay(m.ts)}</div>`); }
      box.insertAdjacentHTML('beforeend', messageHtml(m));
    }
    box.scrollTop = box.scrollHeight;
  }

  function appendMessage(m) {
    const box = $('messages');
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 160;
    box.insertAdjacentHTML('beforeend', messageHtml(m));
    if (nearBottom || m.direction === 'out') box.scrollTop = box.scrollHeight;
  }

  const TICKS = { sending: '🕒', sent: '✓', delivered: '✓✓', read: '✓✓', failed: '⚠' };
  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅'];
  const POPULAR_EMOJIS = [
    '👍', '❤️', '😂', '🤣', '😊', '😍', '🥰', '😎', '🤩', '🤔',
    '👏', '🙏', '🤝', '🔥', '💚', '✨', '💯', '⭐', '🎉', '🎁',
    '🛍️', '📦', '🚚', '🏷️', '💳', '💵', '📞', '📍', '✅', '❌'
  ];
  function paintTick(el, status) { el.textContent = TICKS[status] || ''; el.className = 'tick ' + status; }

  function messageHtml(m) {
    const src = (m.media_url && m.media_url.startsWith('blob:')) ? m.media_url : `/api/media/${encodeURIComponent(m.id)}`;
    let inner = '';
    if (m.type === 'image' || m.type === 'sticker') inner += `<img class="media" loading="lazy" src="${src}" data-full="${src}" alt="${t('image_label')}" />`;
    else if (m.type === 'audio' || m.type === 'voice') inner += `<audio controls preload="metadata" src="${src}"></audio>`;
    else if (m.type === 'video') inner += `<video controls preload="metadata" src="${src}" style="max-width:100%;max-height:300px;border-radius:8px;display:block"></video>`;
    else if (m.type === 'document') inner += `<a class="doc" href="${src}" target="_blank" rel="noopener">📄 <span>${esc(m.filename || t('file_label'))}</span></a>`;
    else if (m.type === 'reaction') inner += `<span class="reaction-pill">${esc(m.body || '❤️')}</span>`;
    if (m.body && m.type !== 'reaction') inner += `<div>${linkify(m.body).replace(/\n/g, '<br>')}</div>`;
    const tick = m.direction === 'out' ? `<span class="tick ${m.status}">${TICKS[m.status] || ''}</span>` : '';
    return `<div class="msg ${m.direction}" data-id="${esc(m.id)}">${inner}<div class="meta"><span>${fmtTime(m.ts)}</span>${tick}</div></div>`;
  }

  $('back').addEventListener('click', () => { $('app').classList.remove('open'); state.active = null; renderContacts(); });

  // --- تعديل اسم العميل ---
  const editNameBtn = $('btn-edit-name');
  if (editNameBtn) {
    editNameBtn.addEventListener('click', async () => {
      if (!state.active) return;
      const c = state.active;
      const currentName = $('head-name').textContent || '';
      const newName = window.prompt('اكتب الاسم الجديد للعميل:', currentName);
      if (newName === null) return; // cancelled
      try {
        const updated = await api(
          `/api/contacts/${encodeURIComponent(c.line)}/${encodeURIComponent(c.phone)}/name`,
          { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) }
        );
        // Update local state
        const idx = state.contacts.findIndex((x) => x.line === c.line && x.phone === c.phone);
        if (idx !== -1) state.contacts[idx] = updated;
        state.active = updated;
        $('head-name').textContent = updated.name || ('+' + updated.phone);
        renderContacts();
      } catch (err) { alert('فشل تعديل الاسم: ' + err.message); }
    });
  }

  // ---------- Composer & Sending ----------
  const ta = $('text');
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('composer').requestSubmit(); } });

  // ---------- Emoji Picker & Reactions ----------
  const ep = $('emoji-picker');
  if (ep) {
    ep.innerHTML = POPULAR_EMOJIS.map((em) => `<button type="button" class="emoji-item" data-emoji="${em}">${em}</button>`).join('');
    ep.addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-item');
      if (!btn) return;
      const em = btn.dataset.emoji;
      const start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + em + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + em.length;
      ta.focus();
    });
  }
  $('emoji-btn')?.addEventListener('click', () => {
    ep?.classList.toggle('hidden');
  });

  // Fast reaction from message hover toolbar
  $('messages').addEventListener('click', async (e) => {
    const btn = e.target.closest('.msg-react-btn');
    if (!btn || !state.active) return;
    const emoji = btn.dataset.emoji;
    const fd = new FormData();
    fd.append('text', emoji);
    try {
      const row = await api(chatUrl(state.active, 'send'), { method: 'POST', body: fd });
      if (row && !state.messages.some((x) => x.id === row.id)) {
        state.messages.push(row);
        appendMessage(row);
      }
      loadContacts();
    } catch (err) {
      alert(t('send_failed') + ' ' + err.message);
    }
  });

  $('attach').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', () => {
    const f = $('file').files[0];
    if (!f) return;
    if (f.size > 16 * 1024 * 1024) { alert(t('max_file_err')); $('file').value = ''; return; }
    state.file = f;
    $('preview-body').innerHTML = f.type.startsWith('image/') ? `<img src="${URL.createObjectURL(f)}" alt="" />` : `📄 ${esc(f.name)}`;
    $('preview').classList.remove('hidden');
  });

  function clearAttachment() { state.file = null; $('file').value = ''; $('preview').classList.add('hidden'); }
  $('preview-clear').addEventListener('click', clearAttachment);

  // ---------- Voice Note Recording ----------
  let mediaRecorder = null;
  let audioChunks = [];
  let recordTimerInterval = null;
  let recordSeconds = 0;
  let activeStream = null;

  function stopRecordingTracks() {
    if (activeStream) {
      activeStream.getTracks().forEach((tr) => tr.stop());
      activeStream = null;
    }
    if (recordTimerInterval) {
      clearInterval(recordTimerInterval);
      recordTimerInterval = null;
    }
  }

  function resetRecordingUI() {
    stopRecordingTracks();
    mediaRecorder = null;
    audioChunks = [];
    recordSeconds = 0;
    $('composer').classList.remove('is-recording');
    $('recording-bar').classList.add('hidden');
    $('text').classList.remove('hidden');
    $('send').innerHTML = '➤';
    $('send').title = 'إرسال';
  }

  async function startRecording() {
    if (!state.active) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStream = stream;

      const mime = ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm']
        .find((m) => MediaRecorder.isTypeSupported(m)) || '';

      mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (!audioChunks.length) {
          resetRecordingUI();
          return;
        }
        const mimeType = mediaRecorder.mimeType || 'audio/ogg';
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('webm') ? 'webm' : 'ogg';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        resetRecordingUI();

        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const blobUrl = URL.createObjectURL(audioBlob);

        // Optimistic UI: audio bubble appears on screen immediately!
        const optMsg = {
          id: tempId,
          line: state.active.line,
          phone: state.active.phone,
          direction: 'out',
          type: 'audio',
          body: '',
          media_url: blobUrl,
          filename: `voice_${Date.now()}.${ext}`,
          status: 'sending',
          ts: Date.now(),
        };
        state.messages.push(optMsg);
        appendMessage(optMsg);

        const fd = new FormData();
        fd.append('file', audioBlob, `voice_${Date.now()}.${ext}`);
        fd.append('type', 'audio');
        fd.append('text', '');

        try {
          const row = await api(chatUrl(state.active, 'send'), { method: 'POST', body: fd });
          if (row) {
            // Register this ID so the socket echo is ignored
            sentByMe.add(row.id);
            const idx = state.messages.findIndex((m) => m.id === tempId);
            if (idx >= 0) state.messages[idx] = row;
            const el = document.querySelector(`.msg[data-id="${tempId}"]`);
            if (el) {
              el.dataset.id = row.id;
              const tick = el.querySelector('.tick');
              if (tick) paintTick(tick, row.status || 'sent');
            }
          }
          loadContacts();
        } catch (err) {
          const el = document.querySelector(`.msg[data-id="${tempId}"]`);
          if (el) {
            const tick = el.querySelector('.tick');
            if (tick) paintTick(tick, 'failed');
            el.insertAdjacentHTML('beforeend', `<div class="msg-error" style="color:var(--danger);font-size:11px;margin-top:2px;">${esc(err.message)}</div>`);
          }
        }
      };

      mediaRecorder.start(250);
      recordSeconds = 0;
      $('rec-timer').textContent = '0:00';
      $('composer').classList.add('is-recording');
      $('text').classList.add('hidden');
      $('recording-bar').classList.remove('hidden');
      $('send').innerHTML = '✔';
      $('send').title = 'إنهاء وإرسال التسجيل';

      recordTimerInterval = setInterval(() => {
        recordSeconds++;
        const m = Math.floor(recordSeconds / 60);
        const s = recordSeconds % 60;
        $('rec-timer').textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
      }, 1000);

    } catch (err) {
      console.error('Microphone error:', err);
      alert('تعذر الوصول إلى الميكروفون. يرجى السماح بالوصول من إعدادات المتصفح.');
      resetRecordingUI();
    }
  }

  $('mic-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    } else {
      startRecording();
    }
  });

  $('rec-cancel')?.addEventListener('click', (e) => {
    e.preventDefault();
    audioChunks = [];
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    } else {
      resetRecordingUI();
    }
  });

  document.addEventListener('paste', (e) => {
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f && state.active) {
      const dt = new DataTransfer(); dt.items.add(f); $('file').files = dt.files;
      $('file').dispatchEvent(new Event('change'));
    }
  });

  $('composer').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!state.active) return;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }
    const text = ta.value.trim();
    if (!text && !state.file) return;

    const fileToSend = state.file;
    const textToSend = text;

    // Reset input immediately (instant feedback to user!)
    ta.value = '';
    ta.style.height = 'auto';
    clearAttachment();

    // Optimistic UI bubble
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let optType = 'text';
    if (fileToSend) {
      const mime = fileToSend.type || '';
      if (mime.startsWith('image/')) optType = 'image';
      else if (mime.startsWith('video/') || /\.(mp4|mov|avi|3gp|mkv)$/i.test(fileToSend.name)) optType = 'video';
      else if (mime.startsWith('audio/') || /\.(ogg|mp3|m4a|wav|webm)$/i.test(fileToSend.name)) optType = 'audio';
      else optType = 'document';
    }

    const optMsg = {
      id: tempId,
      line: state.active.line,
      phone: state.active.phone,
      direction: 'out',
      type: optType,
      body: textToSend,
      media_url: fileToSend ? URL.createObjectURL(fileToSend) : null,
      filename: fileToSend ? fileToSend.name : null,
      status: 'sending',
      ts: Date.now(),
    };
    state.messages.push(optMsg);
    appendMessage(optMsg);

    const fd = new FormData();
    fd.append('text', textToSend);
    if (fileToSend) {
      fd.append('file', fileToSend);
      fd.append('type', optType);
    }

    try {
      const row = await api(chatUrl(state.active, 'send'), { method: 'POST', body: fd });
      if (row) {
        // Register this ID so the socket echo is ignored
        sentByMe.add(row.id);
        const idx = state.messages.findIndex((m) => m.id === tempId);
        if (idx >= 0) state.messages[idx] = row;
        const el = document.querySelector(`.msg[data-id="${CSS.escape(tempId)}"]`);
        if (el) {
          el.dataset.id = row.id;
          const tick = el.querySelector('.tick');
          if (tick) paintTick(tick, row.status || 'sent');
        }
      }
      loadContacts();
    } catch (err) {
      const el = document.querySelector(`.msg[data-id="${CSS.escape(tempId)}"]`);
      if (el) {
        const tick = el.querySelector('.tick');
        if (tick) paintTick(tick, 'failed');
        el.insertAdjacentHTML('beforeend', `<div class="msg-error" style="color:var(--danger);font-size:11px;margin-top:2px;">${esc(err.message)}</div>`);
      }
    } finally {
      ta.focus();
    }
  });

  // ---------- Image Viewer Modal ----------
  let zoom = 1;
  const setZoom = (z) => { zoom = Math.max(.5, Math.min(4, z)); $('viewer-img').style.transform = `scale(${zoom})`; };
  const closeViewer = () => { $('viewer').classList.add('hidden'); setZoom(1); };
  $('messages').addEventListener('click', (e) => {
    const img = e.target.closest('img.media');
    if (!img) return;
    $('viewer-img').src = img.dataset.full; $('viewer-dl').href = img.dataset.full;
    setZoom(1); $('viewer').classList.remove('hidden');
  });
  $('viewer-close').addEventListener('click', closeViewer);
  $('viewer').addEventListener('click', (e) => { if (e.target.id === 'viewer') closeViewer(); });
  $('zoom-in').addEventListener('click', () => setZoom(zoom + .25));
  $('zoom-out').addEventListener('click', () => setZoom(zoom - .25));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeViewer(); });
  $('viewer').addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom + (e.deltaY < 0 ? .15 : -.15)); }, { passive: false });

  // ---------- Modals Handling ----------
  const openModal = (id) => $(id).classList.remove('hidden');
  const closeModals = () => document.querySelectorAll('.modal').forEach((m) => m.classList.add('hidden'));
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });
  const jsonOpts = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  // New Chat
  $('new-chat').addEventListener('click', () => {
    $('new-form').reset();
    $('new-error').textContent = '';
    const isAdmin = state.user?.role === 'super_admin' || state.user?.role === 'admin';
    const list = (state.lines && state.lines.length) ? state.lines : (state.allLines && state.allLines.length ? state.allLines : [{ id: '191', name: 'wafyStore 💬' }]);
    $('new-line').innerHTML = list.map((l, idx) => `<option value="${esc(l.id)}"${idx === 0 ? ' selected' : ''}>${esc(l.name)} (${esc(l.id)})</option>`).join('');
    if (state.line !== 'all' && list.some((l) => l.id === state.line)) {
      $('new-line').value = state.line;
    } else if (list.length > 0) {
      $('new-line').value = list[0].id;
    }
    // Hide the number selector for employees (only Admin / Super Admin can choose the number)
    const lineLabel = $('new-line')?.closest('label');
    if (lineLabel) lineLabel.classList.toggle('hidden', !isAdmin);
    openModal('modal-new');
    $('new-phone').focus();
  });

  $('new-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const c = await api('/api/chats', jsonOpts('POST', { line: $('new-line').value, phone: $('new-phone').value, name: $('new-name').value }));
      closeModals();
      await loadContacts();
      state.line = 'all'; renderContacts();
      openChat(c.line, c.phone);
    } catch (err) { $('new-error').textContent = err.message; }
  });

  // Templates
  const tplByName = (n) => state.templates.find((tpl) => tpl.name === n);
  function renderTplFields() {
    const tpl = tplByName($('tpl-select').value);
    if (!tpl) return;
    const staffName = state.user?.name || '';
    $('tpl-params').innerHTML = tpl.params.map((p, i) => {
      const isStaff = /موظف|ممثل|خدمة|كول|سيلز/i.test(p);
      const defaultVal = isStaff ? staffName : (i === 0 ? (state.active?.name || '') : '');
      return `<label>${esc(p)}<input data-param="${i}" value="${esc(defaultVal)}" required /></label>`;
    }).join('');
    updateTplPreview();
  }
  function tplValues() { return [...document.querySelectorAll('[data-param]')].map((i) => i.value); }
  function updateTplPreview() {
    const tpl = tplByName($('tpl-select').value), v = tplValues();
    $('tpl-preview').textContent = tpl ? tpl.body.replace(/\{\{(\d+)\}\}/g, (_, i) => v[i - 1] || `{{${i}}}`) : '';
  }
  function openTemplateModal() {
    if (!state.active) return;
    if (!state.templates.length) { alert(t('no_templates_err')); return; }
    $('tpl-select').innerHTML = state.templates.map((tpl) => `<option value="${esc(tpl.name)}">${esc(tpl.label || tpl.name)}</option>`).join('');
    $('tpl-error').textContent = '';
    renderTplFields();
    openModal('modal-tpl');
  }
  $('tpl-select').addEventListener('change', renderTplFields);
  $('tpl-params').addEventListener('input', updateTplPreview);
  $('tpl-btn').addEventListener('click', openTemplateModal);
  $('tpl-open').addEventListener('click', openTemplateModal);

  const btnQuickIntro = $('btn-quick-intro');
  if (btnQuickIntro) {
    btnQuickIntro.addEventListener('click', () => {
      if (!state.active) return;
      const myName = (state.user?.name || '').trim();
      const text = `حياك الله معك ${myName} من وافي`;
      ta.value = text;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
      ta.focus();
    });
  }
  $('tpl-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('template', $('tpl-select').value);
    fd.append('params', JSON.stringify(tplValues()));
    try {
      const row = await api(chatUrl(state.active, 'send'), { method: 'POST', body: fd });
      closeModals();
      if (row && !state.messages.some((x) => x.id === row.id)) { state.messages.push(row); appendMessage(row); }
      loadContacts();
    } catch (err) { $('tpl-error').textContent = err.message; }
  });

  // Staff Management (Admin)
  function renderLineCheckboxes() {
    const box = $('u-lines-checks');
    if (!box) return;
    const allList = state.allLines || state.lines || [];
    box.innerHTML = `
      <select id="u-line-select" name="u_line" style="margin-top:0">
        ${allList.map((l, idx) => `<option value="${esc(l.id)}" ${idx === 0 ? 'selected' : ''}>📱 ${esc(l.name)}</option>`).join('')}
      </select>
    `;
  }

  function userLinesPills(u, canAssignLine) {
    if (u.role === 'super_admin' || u.role === 'admin') {
      const permBadge = (u.role === 'admin' && u.can_manage_users)
        ? `<span class="line-pill" style="background:#fef3c7;color:#92400e;border-color:#fde68a">${t('badge_user_mgmt')}</span>`
        : '';
      return `<div class="user-lines-tags"><span class="line-pill">${t('all_countries_admin')}</span>${permBadge}</div>`;
    }
    const allList = state.allLines || state.lines || [];
    const rawAllowed = (u.allowed_lines || '').split(',').map((s) => s.trim()).filter(Boolean);
    const assignedId = rawAllowed[0] || String(allList[0]?.id || '191');
    if (!canAssignLine) {
      return `<div class="user-lines-tags"><span class="line-pill">📱 ${esc(lineName(assignedId))}</span></div>`;
    }
    return `
      <div class="user-lines-tags">
        <select class="emp-line-select" data-line-select data-uid="${u.id}">
          ${allList.map((l) => `<option value="${esc(l.id)}" ${String(l.id) === String(assignedId) ? 'selected' : ''}>📱 ${esc(l.name)}</option>`).join('')}
        </select>
      </div>
    `;
  }

  function syncRolePermUI() {
    const isSuper = state.user?.role === 'super_admin';
    const roleSel = $('u-role');
    if (roleSel) {
      const superOpt = roleSel.querySelector('option[value="super_admin"]');
      if (superOpt) superOpt.hidden = !isSuper;
      if (!isSuper && roleSel.value === 'super_admin') roleSel.value = 'agent';
    }
    if ($('u-perm-box')) {
      $('u-perm-box').classList.toggle('hidden', !(isSuper && roleSel?.value === 'admin'));
    }
    const linesBox = $('u-lines-checks')?.closest('.line-choices-box');
    if (linesBox) {
      linesBox.classList.toggle('hidden', roleSel?.value !== 'agent');
    }
  }
  if ($('u-role')) $('u-role').addEventListener('change', syncRolePermUI);

  async function renderUsers() {
    state.users = await api('/api/users');
    renderLineCheckboxes();
    syncRolePermUI();
    const isSuper = state.user?.role === 'super_admin';
    const isAdmin = isSuper || state.user?.role === 'admin';
    const canManageUsers = isSuper || (state.user?.role === 'admin' && Boolean(state.user?.can_manage_users));
    if ($('user-form')) $('user-form').classList.toggle('hidden', !canManageUsers);
    $('users-list').innerHTML = state.users.map((u) => {
      const roleText = u.role === 'super_admin' ? t('role_super_admin') : (u.role === 'admin' ? t('role_admin') : t('role_agent'));
      const canEditTarget = canManageUsers && (isSuper || u.role !== 'super_admin');
      return `
      <div class="user-row ${u.active ? '' : 'off'}">
        <div class="avatar" style="width:36px;height:36px;font-size:15px;background:hsl(${hue(u.username)} 45% 38%)">${esc(u.name.charAt(0))}</div>
        <div class="u-info">
          <div><strong>${esc(u.name)}</strong> <span class="role ${u.role}">${esc(roleText)}</span> <small dir="ltr" style="display:inline">@${esc(u.username)}</small></div>
          ${userLinesPills(u, isAdmin)}
        </div>
        <div class="user-actions">
          ${canEditTarget ? `<button class="btn ghost small" data-act="pw" data-id="${u.id}">${t('change_password')}</button>` : ''}
          ${(isSuper && u.role === 'admin') ? `<button class="btn ghost small" data-act="perm" data-id="${u.id}">${u.can_manage_users ? t('revoke_user_mgmt') : t('grant_user_mgmt')}</button>` : ''}
          ${(u.id !== state.user.id && canEditTarget) ? `<button class="btn ghost small" data-act="toggle" data-id="${u.id}">${u.active ? t('deactivate_btn') : t('activate_btn')}</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  $('admin-btn').addEventListener('click', async () => {
    $('admin-error').textContent = '';
    await renderUsers();
    openModal('modal-admin');
  });

  $('users-list').addEventListener('change', async (e) => {
    const sel = e.target.closest('select[data-line-select]');
    if (!sel) return;
    const uid = Number(sel.dataset.uid);
    const chosenLine = sel.value;
    $('admin-error').textContent = '';
    try {
      await api(`/api/users/${uid}`, jsonOpts('PATCH', { allowed_lines: [chosenLine] }));
      await renderUsers();
    } catch (err) {
      $('admin-error').textContent = err.message;
      await renderUsers();
    }
  });

  $('users-list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const u = state.users.find((x) => x.id === Number(b.dataset.id));
    $('admin-error').textContent = '';
    try {
      if (b.dataset.act === 'pw') {
        const password = prompt(`${t('new_pass_prompt')} ${u.name}:`);
        if (!password) return;
        if (password.length < 4) throw new Error(t('min_pass_err'));
        await api(`/api/users/${u.id}`, jsonOpts('PATCH', { password }));
      } else if (b.dataset.act === 'perm') {
        await api(`/api/users/${u.id}`, jsonOpts('PATCH', { can_manage_users: !u.can_manage_users }));
      } else {
        await api(`/api/users/${u.id}`, jsonOpts('PATCH', { active: !u.active }));
      }
      await renderUsers();
    } catch (err) { $('admin-error').textContent = err.message; }
  });

  $('user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const chosenLine = $('u-line-select')?.value || (state.allLines || state.lines)?.[0]?.id || '191';
    try {
      const selectedRole = $('u-role') ? $('u-role').value : 'agent';
      const isSuper = state.user?.role === 'super_admin';
      const canManage = isSuper && selectedRole === 'admin' && Boolean($('u-can-manage')?.checked);
      await api('/api/users', jsonOpts('POST', {
        name: $('u-name').value,
        username: $('u-username').value,
        password: $('u-password').value,
        role: selectedRole,
        allowed_lines: [chosenLine],
        can_manage_users: canManage ? 1 : 0,
      }));
      $('user-form').reset();
      if ($('u-can-manage')) $('u-can-manage').checked = false;
      $('admin-error').textContent = '';
      await renderUsers();
    } catch (err) { $('admin-error').textContent = err.message; }
  });

  applyLanguage(curLang);
  start();
  showLoginIfNeeded();
  function showLoginIfNeeded() { fetch('/api/me').then((r) => { if (r.status === 401) showLogin(); }); }
})();
