const apiBase = '';

function getToken() {
  return localStorage.getItem('token') || '';
}

function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function setSession({ token, user }) {
  if (token) localStorage.setItem('token', token);
  if (user) localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (getToken()) {
    headers.Authorization = `Bearer ${getToken()}`;
  }
  const res = await fetch(apiBase + path, { ...options, headers: { 'Content-Type': 'application/json', ...headers } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const message = data.message || 'Request failed';
    throw new Error(message);
  }
  return res.json();
}

function showMessage(elId, text, isError = false) {
  const el = document.getElementById(elId);
  if (el) {
    el.textContent = text;
    el.style.color = isError ? '#dc2626' : '#16a34a';
  }
}

function requireAuth(roles) {
  const user = getUser();
  if (!user || (roles && !roles.includes(user.role))) {
    window.location.href = '/login.html';
  }
}

// Auth forms
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const email = loginForm.email.value;
        const password = loginForm.password.value;
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });
        setSession(data);
        const role = data.user?.role;
        if (role === 'Admin') window.location.href = '/admin-dashboard.html';
        else if (role === 'Faculty') window.location.href = '/faculty-dashboard.html';
        else window.location.href = '/student-dashboard.html';
      } catch (err) {
        showMessage('login-msg', err.message, true);
      }
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const name = registerForm.name.value;
        const email = registerForm.email.value;
        const password = registerForm.password.value;
        const role = registerForm.role.value;
        const data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, role })
        });
        setSession(data);
        const r = data.user?.role;
        if (r === 'Admin') window.location.href = '/admin-dashboard.html';
        else if (r === 'Faculty') window.location.href = '/faculty-dashboard.html';
        else window.location.href = '/student-dashboard.html';
      } catch (err) {
        showMessage('register-msg', err.message, true);
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      window.location.href = '/login.html';
    });
  }

  const userBadge = document.getElementById('user-badge');
  if (userBadge) {
    const user = getUser();
    if (user) {
      userBadge.textContent = `${user.name} (${user.role})`;
    } else {
      userBadge.textContent = 'Guest';
    }
  }
});

// Student dashboard helpers
async function loadResources(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const resources = await apiFetch('/api/resources');
    container.innerHTML = resources
      .map(
        (r) => `<div class="card">
          <strong>${r.name}</strong><div class="muted">${r.type} · ${r.location}</div>
          <p>${r.description || ''}</p>
        </div>`
      )
      .join('');
  } catch (err) {
    container.textContent = err.message;
  }
}

async function loadMyRequests(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const requests = await apiFetch('/api/slots/my');
    container.innerHTML = requests
      .map(
        (req) => `<div class="card">
          <div><strong>${req.purpose}</strong> <span class="muted">(${req.attendees} attendees)</span></div>
          <div class="muted">${new Date(req.startTime).toLocaleString()} → ${new Date(req.endTime).toLocaleString()}</div>
          <div><span class="badge ${req.status}">${req.status}</span> ${req.decisionReason || ''}</div>
        </div>`
      )
      .join('');
  } catch (err) {
    container.textContent = err.message;
  }
}

async function handleRequestForm() {
  const form = document.getElementById('request-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        resourceId: form.resourceId.value,
        startTime: form.startTime.value,
        endTime: form.endTime.value,
        purpose: form.purpose.value,
        attendees: Number(form.attendees.value)
      };
      await apiFetch('/api/slots/request', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showMessage('request-msg', 'Request submitted');
      form.reset();
    } catch (err) {
      showMessage('request-msg', err.message, true);
    }
  });
}

async function populateResourceSelect(selectId, facultyLabelId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  try {
    const resources = await apiFetch('/api/resources');
    const existingHtml = select.innerHTML;
    const resourcesHtml = resources
      .map(
        (r) =>
          `<option value="${r._id}" data-faculty="${r.assignedFacultyId?.name || ''}" data-capacity="${r.capacity}">${r.name} (${r.type})</option>`
      )
      .join('');
    select.innerHTML = (existingHtml.includes('value=""') ? '<option value="">-- Select a Resource --</option>' : '') + resourcesHtml;

    if (facultyLabelId) {
      const labelEl = document.getElementById(facultyLabelId);
      const capEl = document.getElementById('resource-capacity');
      const updateLabels = () => {
        const opt = select.selectedOptions[0];
        if (labelEl) {
          const name = opt?.getAttribute('data-faculty') || 'Not assigned';
          labelEl.textContent = name;
        }
        if (capEl) {
          const cap = opt?.getAttribute('data-capacity') || '-';
          capEl.textContent = cap;
        }
      };
      updateLabels();
      select.addEventListener('change', updateLabels);
    }
  } catch (err) {
    select.innerHTML = `<option>${err.message}</option>`;
  }
}

async function populateFacultySelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  try {
    const faculty = await apiFetch('/api/users/faculty');
    select.innerHTML = faculty.map((f) => `<option value="${f._id}">${f.name} (${f.email})</option>`).join('');
  } catch (err) {
    select.innerHTML = `<option>${err.message}</option>`;
  }
}

// Admin helpers
async function loadUsers(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const users = await apiFetch('/api/admin/users');
    container.innerHTML = `<table>
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Save</th></tr></thead>
      <tbody>${users
        .map(
          (u) => `<tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>
              <select data-user-role="${u._id}">
                <option value="Student" ${u.role === 'Student' ? 'selected' : ''}>Student</option>
                <option value="Faculty" ${u.role === 'Faculty' ? 'selected' : ''}>Faculty</option>
                <option value="Admin" ${u.role === 'Admin' ? 'selected' : ''}>Admin</option>
              </select>
            </td>
            <td><input type="checkbox" data-user-active="${u._id}" ${u.isActive ? 'checked' : ''}/></td>
            <td><button onclick="app.saveUser('${u._id}')">Save</button></td>
          </tr>`
        )
        .join('')}</tbody>
    </table>`;
  } catch (err) {
    container.textContent = err.message;
  }
}

async function saveUser(id) {
  const roleSel = document.querySelector(`[data-user-role="${id}"]`);
  const actChk = document.querySelector(`[data-user-active="${id}"]`);
  const payload = {
    role: roleSel ? roleSel.value : undefined,
    isActive: actChk ? Boolean(actChk.checked) : undefined
  };
  try {
    await apiFetch(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    alert('User saved');
  } catch (err) {
    alert(err.message);
  }
}

async function loadPolicyToForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  try {
    const policy = await apiFetch('/api/admin/policies');
    form.maxHoursPerDay.value = policy.maxHoursPerDay ?? 4;
    form.maxHoursPerWeek.value = policy.maxHoursPerWeek ?? 12;
    form.maxActiveRequests.value = policy.maxActiveRequests ?? 3;
  } catch (err) {
    // ignore
  }
}

async function handlePolicyForm() {
  const form = document.getElementById('policy-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        maxHoursPerDay: Number(form.maxHoursPerDay.value),
        maxHoursPerWeek: Number(form.maxHoursPerWeek.value),
        maxActiveRequests: Number(form.maxActiveRequests.value)
      };
      await apiFetch('/api/admin/policies', { method: 'PUT', body: JSON.stringify(payload) });
      showMessage('policy-msg', 'Policy updated');
    } catch (err) {
      showMessage('policy-msg', err.message, true);
    }
  });
}

async function loadAdminResources(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const resources = await apiFetch('/api/resources');
    container.innerHTML = resources
      .map(
        (r) => `<div class="card">
          <div><strong>${r.name}</strong> <span class="muted">(${r.type})</span> | Cap: ${r.capacity}</div>
          <div class="muted">${r.location}</div>
          <div class="muted">Faculty: ${r.assignedFacultyId?.name || 'Not assigned'}</div>
          <div class="muted">${r.description || ''}</div>
          <button onclick="app.deactivateResource('${r._id}')">Deactivate</button>
        </div>`
      )
      .join('');
  } catch (err) {
    container.textContent = err.message;
  }
}

async function handleCreateResourceForm() {
  const form = document.getElementById('resource-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name.value,
        type: form.type.value,
        location: form.location.value,
        assignedFacultyId: form.assignedFacultyId.value,
        description: form.description.value,
        capacity: Number(form.capacity.value)
      };
      await apiFetch('/api/resources', { method: 'POST', body: JSON.stringify(payload) });
      showMessage('resource-msg', 'Resource created');
      form.reset();
      await loadAdminResources('admin-resource-list');
    } catch (err) {
      showMessage('resource-msg', err.message, true);
    }
  });
}

async function deactivateResource(id) {
  try {
    await apiFetch(`/api/resources/${id}`, { method: 'DELETE' });
    alert('Resource deactivated');
    window.location.reload();
  } catch (err) {
    alert(err.message);
  }
}

async function loadFacultyPending(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const slots = await apiFetch('/api/slots/faculty/pending');
    if (!slots.length) {
      container.textContent = 'No pending requests';
      return;
    }
    container.innerHTML = slots
      .map(
        (s) => `<div class="card">
          <div><strong>${s.purpose}</strong> <span class="muted">(${s.attendees} attendees)</span></div>
          <div class="muted">${new Date(s.startTime).toLocaleString()} → ${new Date(s.endTime).toLocaleString()}</div>
          <div class="muted">Student: ${s.studentId?.name || s.studentId}</div>
          <button onclick="app.respondSlot('${s._id}', true)">Approve</button>
          <button onclick="app.respondSlot('${s._id}', false)">Reject</button>
        </div>`
      )
      .join('');
  } catch (err) {
    container.textContent = err.message;
  }
}

async function respondSlot(id, approve) {
  try {
    const path = approve ? `/api/slots/approve/${id}` : `/api/slots/reject/${id}`;
    await apiFetch(path, { method: 'POST', body: JSON.stringify({}) });
    window.location.reload();
  } catch (err) {
    alert(err.message);
  }
}

async function loadResourceCalendar(resourceId) {
  try {
    const slots = await apiFetch(`/api/slots/resource/${resourceId}`);
    const events = slots.map((s) => ({
      title: s.purpose,
      start: s.startTime,
      end: s.endTime,
      backgroundColor: s.status === 'APPROVED' ? '#16a34a' : '#f59e0b',
      borderColor: s.status === 'APPROVED' ? '#16a34a' : '#f59e0b',
      extendedProps: {
        status: s.status,
        bookedBy: s.studentId?.name || 'Unknown'
      }
    }));

    if (window.calendar) {
      // Remove all existing sources to avoid duplicates/residue
      window.calendar.getEventSources().forEach(source => source.remove());
      // Add the new events as a fresh source
      window.calendar.addEventSource(events);
    }
  } catch (err) {
    alert(err.message);
  }
}

window.app = {
  requireAuth,
  loadResources,
  loadMyRequests,
  handleRequestForm,
  populateResourceSelect,
  populateFacultySelect,
  loadUsers,
  saveUser,
  loadPolicyToForm,
  handlePolicyForm,
  loadFacultyPending,
  respondSlot,
  loadAdminResources,
  handleCreateResourceForm,
  deactivateResource,
  loadResourceCalendar
};

