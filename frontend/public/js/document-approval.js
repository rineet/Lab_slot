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

function toOptions(selectEl, users, placeholder = '') {
  const placeholderOption = placeholder ? `<option value="">${placeholder}</option>` : '';
  selectEl.innerHTML =
    placeholderOption +
    users.map((u) => `<option value="${u._id}">${u.name} (${u.role}) - ${u.email}</option>`).join('');
  if (placeholder) {
    selectEl.value = '';
  }
}

function renderSelectedRecipients(containerEl, ids, usersById, typeLabel, onRemove) {
  if (!containerEl) return;

  if (!ids.length) {
    containerEl.textContent = `No ${typeLabel} recipients added.`;
    containerEl.classList.add('muted');
    return;
  }

  containerEl.classList.remove('muted');
  containerEl.innerHTML = ids
    .map((id) => {
      const u = usersById.get(id);
      if (!u) return '';
      return `<span class="recipient-chip">${u.name} (${u.role})<button type="button" data-remove-recipient="${id}" aria-label="Remove ${u.name}">×</button></span>`;
    })
    .join('');

  containerEl.querySelectorAll('[data-remove-recipient]').forEach((btn) => {
    btn.addEventListener('click', () => onRemove(btn.getAttribute('data-remove-recipient')));
  });
}

function setRequestSubmitLoading(form, isLoading) {
  const submitBtn = form.querySelector('button[type="submit"]');
  const progress = document.getElementById('request-submit-progress');
  if (submitBtn) {
    submitBtn.disabled = isLoading;
    submitBtn.textContent = isLoading ? 'Submitting and sending mail...' : 'Submit Request';
  }
  if (progress) {
    progress.classList.toggle('active', Boolean(isLoading));
  }
}

function getDocumentViewUrl(request) {
  if (request && request.documentPath && String(request.documentPath).trim()) {
    return String(request.documentPath).trim();
  }
  if (request && request._id) {
    return `/api/document-requests/${request._id}/document`;
  }
  return '#';
}

async function initRequestForm() {
  const form = document.getElementById('request-form');
  if (!form) return;

  const user = await approvalApi.me();
  if (!user || user.role !== 'Student') {
    window.location.href = '/login-student.html';
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
  const addCcBtn = document.getElementById('add-cc-recipient');
  const addBccBtn = document.getElementById('add-bcc-recipient');
  const ccSelected = document.getElementById('cc-selected');
  const bccSelected = document.getElementById('bcc-selected');

  const usersById = new Map(recipients.map((u) => [u._id, u]));
  const selectedCc = [];
  const selectedBcc = [];

  toOptions(to, recipients, '-- Select primary recipient --');
  toOptions(cc, recipients, '-- Select CC recipient --');
  toOptions(bcc, recipients, '-- Select BCC recipient --');

  function refreshRecipientSelections() {
    const toId = to.value;
    if (toId) {
      const ccIdx = selectedCc.indexOf(toId);
      if (ccIdx >= 0) selectedCc.splice(ccIdx, 1);
      const bccIdx = selectedBcc.indexOf(toId);
      if (bccIdx >= 0) selectedBcc.splice(bccIdx, 1);
    }

    renderSelectedRecipients(ccSelected, selectedCc, usersById, 'CC', (id) => {
      const idx = selectedCc.indexOf(id);
      if (idx >= 0) selectedCc.splice(idx, 1);
      refreshRecipientSelections();
    });

    renderSelectedRecipients(bccSelected, selectedBcc, usersById, 'BCC', (id) => {
      const idx = selectedBcc.indexOf(id);
      if (idx >= 0) selectedBcc.splice(idx, 1);
      refreshRecipientSelections();
    });
  }

  function addRecipient(targetList, selectEl, label) {
    const id = selectEl.value;
    if (!id) {
      setMsg('request-form-msg', `Please select a ${label} recipient`, true);
      return;
    }
    if (id === to.value) {
      setMsg('request-form-msg', `${label} recipient cannot be the same as To`, true);
      return;
    }
    if (selectedCc.includes(id) || selectedBcc.includes(id)) {
      setMsg('request-form-msg', 'Recipient already added in CC/BCC', true);
      return;
    }
    targetList.push(id);
    selectEl.value = '';
    setMsg('request-form-msg', '');
    refreshRecipientSelections();
  }

  addCcBtn?.addEventListener('click', () => addRecipient(selectedCc, cc, 'CC'));
  addBccBtn?.addEventListener('click', () => addRecipient(selectedBcc, bcc, 'BCC'));
  to.addEventListener('change', refreshRecipientSelections);
  refreshRecipientSelections();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const toId = to.value;

    // Build final CC/BCC safely: include added chips, current dropdown value,
    // and any selected options (for backward compatibility with cached old UI).
    const finalCc = new Set(selectedCc);
    const finalBcc = new Set(selectedBcc);

    if (cc.value) finalCc.add(cc.value);
    if (bcc.value) finalBcc.add(bcc.value);

    Array.from(cc.selectedOptions || []).forEach((opt) => {
      if (opt.value) finalCc.add(opt.value);
    });
    Array.from(bcc.selectedOptions || []).forEach((opt) => {
      if (opt.value) finalBcc.add(opt.value);
    });

    // A recipient cannot be both To and CC/BCC.
    if (toId) {
      finalCc.delete(toId);
      finalBcc.delete(toId);
    }

    // If the same user exists in CC and BCC, keep them only in CC.
    Array.from(finalCc).forEach((id) => {
      if (finalBcc.has(id)) finalBcc.delete(id);
    });

    formData.set('cc', JSON.stringify(Array.from(finalCc)));
    formData.set('bcc', JSON.stringify(Array.from(finalBcc)));

    try {
      setRequestSubmitLoading(form, true);
      setMsg('request-form-msg', 'Submitting request and sending email notification...');
      const response = await approvalApi.submitRequest(formData);

      if (response && response.mailSent === false) {
        setMsg(
          'request-form-msg',
          `Request submitted, but email notification failed${response.mailError ? `: ${response.mailError}` : ''}`,
          true
        );
      } else {
        setMsg('request-form-msg', 'Request submitted successfully and email sent');
      }

      form.reset();
      if (studentName) studentName.value = user.name || '';
      to.value = '';
      cc.value = '';
      bcc.value = '';
      selectedCc.length = 0;
      selectedBcc.length = 0;
      refreshRecipientSelections();
    } catch (err) {
      setMsg('request-form-msg', err.message, true);
    } finally {
      setRequestSubmitLoading(form, false);
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
              <td><a href="${getDocumentViewUrl(r)}" target="_blank" rel="noopener noreferrer">View</a></td>
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
    window.location.href = '/login-student.html';
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
      const documentUrl = getDocumentViewUrl(r);
      const canTakeDecision = r.status === 'Pending' || r.status === 'Forwarded';

      const actionBlock = canTakeDecision
        ? `<div style="margin-top: 8px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          <a class="btn btn-secondary" href="${documentUrl}" target="_blank" rel="noopener noreferrer">Preview PDF</a>
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
          <a class="btn btn-secondary" href="${documentUrl}" target="_blank" rel="noopener noreferrer">Preview PDF</a>
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
    window.location.href = '/login-student.html';
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
