const approvalApi = {
  async me() {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  },

  async getRecipients() {
    const res = await fetch('/api/document-requests/recipients', { credentials: 'include' });
    if (!res.ok) throw new Error((await safeJson(res)).message || 'Failed to load recipients');
    return res.json();
  },

  async submitRequest(formData) {
    const res = await fetch('/api/document-requests', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || 'Request submission failed');
    return data;
  },

  async getMyRequests() {
    const res = await fetch('/api/document-requests/student/my', { credentials: 'include' });
    if (!res.ok) throw new Error((await safeJson(res)).message || 'Failed to fetch requests');
    return res.json();
  },

  async getInbox() {
    const res = await fetch('/api/document-requests/inbox', { credentials: 'include' });
    if (!res.ok) throw new Error((await safeJson(res)).message || 'Failed to fetch inbox');
    return res.json();
  },

  async approve(id) {
    return this.simpleAction(`/api/document-requests/${id}/approve`);
  },

  async reject(id) {
    return this.simpleAction(`/api/document-requests/${id}/reject`);
  },

  async forward(id, forwardedTo, message) {
    const res = await fetch(`/api/document-requests/${id}/forward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ forwardedTo, message })
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || 'Forward failed');
    return data;
  },

  async simpleAction(url) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || 'Action failed');
    return data;
  }
};

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function setMsg(id, text, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#dc2626' : '#16a34a';
}

function toOptions(selectEl, users) {
  selectEl.innerHTML = users
    .map((u) => `<option value="${u._id}">${u.name} (${u.role}) - ${u.email}</option>`)
    .join('');
}

async function initRequestForm() {
  const form = document.getElementById('request-form');
  if (!form) return;

  const user = await approvalApi.me();
  if (!user || user.role !== 'Student') {
    window.location.href = '/login.html';
    return;
  }

  const studentName = document.getElementById('studentName');
  if (studentName && !studentName.value) {
    studentName.value = user.name || '';
  }

  const recipients = await approvalApi.getRecipients();
  const to = document.getElementById('to');
  const cc = document.getElementById('cc');
  const bcc = document.getElementById('bcc');
  toOptions(to, recipients);
  toOptions(cc, recipients);
  toOptions(bcc, recipients);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const ccValues = Array.from(cc.selectedOptions).map((o) => o.value);
    const bccValues = Array.from(bcc.selectedOptions).map((o) => o.value);

    formData.set('cc', JSON.stringify(ccValues));
    formData.set('bcc', JSON.stringify(bccValues));

    try {
      await approvalApi.submitRequest(formData);
      setMsg('request-form-msg', 'Request submitted successfully');
      form.reset();
      if (studentName) studentName.value = user.name || '';
    } catch (err) {
      setMsg('request-form-msg', err.message, true);
    }
  });
}

function renderStudentRequests(container, rows) {
  if (!rows.length) {
    container.innerHTML = '<p class="muted">No document requests yet.</p>';
    return;
  }

  container.innerHTML = `<table>
      <thead>
        <tr>
          <th>Subject</th>
          <th>Professor</th>
          <th>Status</th>
          <th>Document</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `<tr>
              <td>${r.subject}</td>
              <td>${r.to?.name || '-'}</td>
              <td><span class="badge">${r.status}</span></td>
              <td><a href="${r.documentPath}" target="_blank" rel="noopener noreferrer">View</a></td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>`;
}

async function initStudentDashboard() {
  const container = document.getElementById('student-requests-table');
  if (!container) return;

  const user = await approvalApi.me();
  if (!user || user.role !== 'Student') {
    window.location.href = '/login.html';
    return;
  }

  const rows = await approvalApi.getMyRequests();
  renderStudentRequests(container, rows);

}

function renderInbox(container, rows, recipients) {
  if (!rows.length) {
    container.innerHTML = '<p class="muted">No requests in inbox.</p>';
    return;
  }

  const recipientOptions = recipients
    .map((u) => `<option value="${u._id}">${u.name} (${u.role})</option>`)
    .join('');

  container.innerHTML = rows
    .map((r) => {
      const canTakeDecision = r.status === 'Pending' || r.status === 'Forwarded';

      const actionBlock = canTakeDecision
        ? `<div style="margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          <a class="btn btn-secondary" href="${r.documentPath}" target="_blank" rel="noopener noreferrer">Preview PDF</a>
          <button class="btn btn-primary" data-approve="${r._id}">Approve</button>
          <button class="btn btn-secondary" data-reject="${r._id}">Reject</button>
        </div>
        <div style="margin-top: 10px; display: grid; gap: 8px; grid-template-columns: 1fr auto;">
          <select id="forward_to_${r._id}">
            <option value="">Forward to...</option>
            ${recipientOptions}
          </select>
          <button class="btn btn-secondary" data-forward="${r._id}">Forward</button>
          <input id="forward_msg_${r._id}" placeholder="Optional forward message" style="grid-column: 1 / 3;" />
        </div>`
        : `<div style="margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          <a class="btn btn-secondary" href="${r.documentPath}" target="_blank" rel="noopener noreferrer">Preview PDF</a>
        </div>
        <div class="muted" style="margin-top:8px;">This request is ${r.status}. Decision options are disabled.</div>`;

      return `<div class="card" style="margin-bottom: 14px;">
        <div><strong>${r.subject}</strong> <span class="badge">${r.status}</span></div>
        <div class="muted">From: ${r.studentId?.name || r.name} (${r.studentId?.email || 'n/a'})</div>
        <div class="muted">Message: ${r.shortMessage || '-'}</div>
        ${actionBlock}
      </div>`;
    })
    .join('');
}

async function initProfessorDashboard() {
  const container = document.getElementById('professor-inbox');
  if (!container) return;

  const user = await approvalApi.me();
  if (!user || !['Faculty', 'Admin'].includes(user.role)) {
    window.location.href = '/login.html';
    return;
  }

  async function refresh() {
    const [rows, recipients] = await Promise.all([approvalApi.getInbox(), approvalApi.getRecipients()]);
    renderInbox(container, rows, recipients);
  }

  await refresh();

  container.addEventListener('click', async (e) => {
    const approveBtn = e.target.closest('[data-approve]');
    const rejectBtn = e.target.closest('[data-reject]');
    const forwardBtn = e.target.closest('[data-forward]');

    try {
      if (approveBtn) {
        await approvalApi.approve(approveBtn.getAttribute('data-approve'));
        setMsg('professor-action-msg', 'Approved successfully');
        await refresh();
      }

      if (rejectBtn) {
        await approvalApi.reject(rejectBtn.getAttribute('data-reject'));
        setMsg('professor-action-msg', 'Rejected successfully');
        await refresh();
      }

      if (forwardBtn) {
        const id = forwardBtn.getAttribute('data-forward');
        const forwardedTo = document.getElementById(`forward_to_${id}`).value;
        const message = document.getElementById(`forward_msg_${id}`).value;
        if (!forwardedTo) {
          setMsg('professor-action-msg', 'Please select a user to forward', true);
          return;
        }
        await approvalApi.forward(id, forwardedTo, message);
        setMsg('professor-action-msg', 'Forwarded successfully');
        await refresh();
      }
    } catch (err) {
      setMsg('professor-action-msg', err.message, true);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await initRequestForm();
    await initStudentDashboard();
    await initProfessorDashboard();
  } catch (err) {
    const ids = ['request-form-msg', 'professor-action-msg'];
    ids.forEach((id) => setMsg(id, err.message, true));
  }
});
