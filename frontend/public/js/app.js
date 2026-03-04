const apiBase = '';
let currentUser = null;

async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  const res = await fetch(apiBase + path, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers }
  });
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

async function fetchSessionUser() {
  try {
    const data = await apiFetch('/api/auth/me');
    currentUser = data.user;
    return currentUser;
  } catch (err) {
    currentUser = null;
    return null;
  }
}

async function requireAuth(roles) {
  const user = currentUser || (await fetchSessionUser());
  if (!user || (roles && !roles.includes(user.role))) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

// return currently cached user or fetch from server if not loaded
async function getUser() {
  if (currentUser) return currentUser;
  return await fetchSessionUser();
}

async function handleChangePasswordForm(formId = 'change-password-form', msgId = 'change-password-msg') {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const confirmPassword = form.confirmPassword.value;
    if (newPassword !== confirmPassword) {
      showMessage(msgId, 'New password and confirmation do not match', true);
      return;
    }
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      showMessage(msgId, 'Password updated successfully');
      form.reset();
    } catch (err) {
      showMessage(msgId, err.message, true);
    }
  });
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
        currentUser = data.user || null;
        const role = currentUser?.role;
        if (role === 'Admin') window.location.href = '/admin-dashboard.html';
        else if (role === 'Faculty') window.location.href = '/faculty-dashboard.html';
        else window.location.href = '/student-dashboard.html';
      } catch (err) {
        showMessage('login-msg', err.message, true);
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      } catch (err) {
        // ignore
      }
      currentUser = null;
      window.location.href = '/login.html';
    });
  }

  const userBadge = document.getElementById('user-badge');
  if (userBadge) {
    fetchSessionUser().then((user) => {
      if (user) {
        userBadge.textContent = `${user.name} (${user.role})`;
      } else {
        userBadge.textContent = 'Guest';
      }
    });
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
          <strong>${r.name}</strong>
          <div class="muted">${r.type} · ${r.location}</div>
          <div class="muted">Strength: ${r.capacity || '-'}</div>
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
    const stageLabel = (stage) => {
      if (!stage || stage === 'FACULTY') return 'Faculty';
      if (stage === 'CLUB_INCHARGE') return 'Club Incharge';
      if (stage === 'ASSOCIATE_DEAN') return 'Associate Dean';
      if (stage === 'HOD') return 'HOD';
      return stage;
    };
    const approvalProgress = (slot) => {
      if (slot.status !== 'PENDING') return '';
      if (slot.approvalStage === 'HOD') return 'Approved by Club Incharge';
      if (slot.approvalStage === 'ASSOCIATE_DEAN') return 'Approved by HOD';
      if (slot.approvalStage === 'CLUB_INCHARGE') return 'Awaiting Club Incharge approval';
      if (slot.approvalStage === 'FACULTY') return 'Awaiting Faculty approval';
      return `Awaiting ${stageLabel(slot.approvalStage)} approval`;
    };
    container.innerHTML = requests
      .map(
        (req) => `<div class="card">
          <div><strong>${req.purpose}</strong> <span class="muted">(${req.attendees} attendees)</span></div>
          <div class="muted">${new Date(req.startTime).toLocaleString()} → ${new Date(req.endTime).toLocaleString()}</div>
          <div><span class="badge ${req.status}">${req.status}</span> ${req.decisionReason || ''}</div>
          <div class="muted">Stage: ${stageLabel(req.approvalStage)}${req.approvalStage === 'FINAL' ? ' (Final)' : ''}</div>
          ${approvalProgress(req) ? `<div class="muted">${approvalProgress(req)}</div>` : ''}
        </div>`
      )
      .join('');
  } catch (err) {
    container.textContent = err.message;
  }
}

// Student: attendance & marks
async function loadMyAttendance(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const rows = await apiFetch('/api/attendance/my');
    if (!rows.length) {
      container.textContent = 'No attendance published yet.';
      return;
    }
    container.innerHTML = `<table>
      <thead><tr><th>Subject</th><th>Month</th><th>Attended / Total</th><th>%</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr>
          <td>${r.subjectCode}</td>
          <td>${r.month}</td>
          <td>${r.attendedClasses} / ${r.totalClasses}</td>
          <td>${r.percentage.toFixed(1)}</td>
        </tr>`
        )
        .join('')}</tbody>
    </table>`;
  } catch (err) {
    container.textContent = err.message;
  }
}

async function loadMyMarks(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const rows = await apiFetch('/api/marks/my');
    if (!rows.length) {
      container.textContent = 'No marks published yet.';
      return;
    }
    container.innerHTML = `<table>
      <thead><tr><th>Subject</th><th>Assessment</th><th>Obtained</th><th>Max</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr>
          <td>${r.subjectCode}</td>
          <td>${r.assessmentType}</td>
          <td>${r.obtainedMarks}</td>
          <td>${r.maxMarks}</td>
        </tr>`
        )
        .join('')}</tbody>
    </table>`;
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
        attendees: Number(form.attendees.value),
        isClubBooking: Boolean(form.isClubBooking?.checked)
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
          <div class="muted">Club approval: ${r.requiresClubApproval ? 'Yes' : 'No'}</div>
          <div class="muted">${r.description || ''}</div>
          <button onclick="app.deactivateResource('${r._id}')">Deactivate</button>
        </div>`
      )
      .join('');
  } catch (err) {
    container.textContent = err.message;
  }
}

// File input handler with drag and drop
function setupFileInputHandler(fileInputId, fileNameSpanId) {
  const fileInput = document.getElementById(fileInputId);
  const fileNameSpan = document.getElementById(fileNameSpanId);
  const wrapper = fileInput.parentElement;

  if (!fileInput || !fileNameSpan) return;

  // Handle file selection
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileNameSpan.textContent = e.target.files[0].name;
    }
  });

  // Handle drag over
  wrapper.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    wrapper.classList.add('drag-over');
  });

  // Handle drag leave
  wrapper.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    wrapper.classList.remove('drag-over');
  });

  // Handle drop
  wrapper.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    wrapper.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Check if file is xlsx
      const file = files[0];
      if (file.name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        fileInput.files = files;
        fileNameSpan.textContent = file.name;
      } else {
        alert('Please drop an Excel (.xlsx) file');
      }
    }
  });
}

// Admin: bulk student creation
async function handleBulkStudentUploadForm() {
  const form = document.getElementById('bulk-student-form');
  if (!form) return;
  setupFileInputHandler('student-file', 'student-file-name');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = form.querySelector('input[name="file"]');
    if (!fileInput.files.length) {
      showMessage('bulk-student-msg', 'Please select a file.', true);
      return;
    }
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    try {
      const res = await fetch(apiBase + '/api/admin/bulk-students', {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      const errInfo = data.errors && data.errors.length ? ` | Email errors: ${data.errors.length}` : '';
      showMessage('bulk-student-msg', `Created: ${data.created}, Skipped: ${data.skipped}${errInfo}`);
      form.reset();
      document.getElementById('student-file-name').textContent = 'Click to upload or drag file here';
      await loadUsers('user-table');
    } catch (err) {
      showMessage('bulk-student-msg', err.message, true);
    }
  });
}

// Admin: bulk faculty creation
async function handleBulkFacultyUploadForm() {
  const form = document.getElementById('bulk-faculty-form');
  if (!form) return;
  setupFileInputHandler('faculty-file', 'faculty-file-name');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = form.querySelector('input[name="file"]');
    if (!fileInput.files.length) {
      showMessage('bulk-faculty-msg', 'Please select a file.', true);
      return;
    }
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    try {
      const res = await fetch(apiBase + '/api/admin/bulk-faculty', {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Upload failed');
      const errInfo = data.errors && data.errors.length ? ` | Email errors: ${data.errors.length}` : '';
      showMessage('bulk-faculty-msg', `Created: ${data.created}, Skipped: ${data.skipped}${errInfo}`);
      form.reset();
      document.getElementById('faculty-file-name').textContent = 'Click to upload or drag file here';
      await loadUsers('user-table');
    } catch (err) {
      showMessage('bulk-faculty-msg', err.message, true);
    }
  });
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
        capacity: Number(form.capacity.value),
        requiresClubApproval: Boolean(form.requiresClubApproval?.checked)
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
    const stageLabel = (stage) => {
      if (!stage || stage === 'FACULTY') return 'Faculty';
      if (stage === 'CLUB_INCHARGE') return 'Club Incharge';
      if (stage === 'ASSOCIATE_DEAN') return 'Associate Dean';
      return stage;
    };
    container.innerHTML = slots
      .map(
        (s) => `<div class="card">
          <div><strong>${s.purpose}</strong> <span class="muted">(${s.attendees} attendees)</span></div>
          <div class="muted">${new Date(s.startTime).toLocaleString()} → ${new Date(s.endTime).toLocaleString()}</div>
          <div class="muted">Student: ${s.studentId?.name || s.studentId}</div>
          <div class="muted">Approval stage: ${stageLabel(s.approvalStage)}</div>
          <button onclick="app.respondSlot('${s._id}', true)">Approve</button>
          <button onclick="app.respondSlot('${s._id}', false)">Reject</button>
        </div>`
      )
      .join('');
  } catch (err) {
    container.textContent = err.message;
  }
}

// Faculty/Admin: attendance & marks uploads
async function handleAttendanceUploadForm() {
  const form = document.getElementById('attendance-upload-form');
  if (!form) return;
  setupFileInputHandler('attendance-file', 'attendance-file-name');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = form.querySelector('input[name="file"]');
    const totalClasses = form.totalClasses.value;
    if (!totalClasses) {
      showMessage('attendance-upload-msg', 'Please provide total classes.', true);
      return;
    }
    if (!fileInput.files.length) {
      showMessage('attendance-upload-msg', 'Please select a file.', true);
      return;
    }
    const fd = new FormData();
    fd.append('totalClasses', totalClasses);
    fd.append('file', fileInput.files[0]);
    try {
      const res = await fetch(apiBase + '/api/attendance/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Upload failed');
      }
      showMessage('attendance-upload-msg', `Uploaded: ${data.inserted}, Updated: ${data.updated}, Skipped: ${data.skipped}`);
      form.reset();
      document.getElementById('attendance-file-name').textContent = 'Click to upload or drag file here';
    } catch (err) {
      showMessage('attendance-upload-msg', err.message, true);
    }
  });
}

async function handleMarksUploadForm() {
  const form = document.getElementById('marks-upload-form');
  if (!form) return;
  setupFileInputHandler('marks-file', 'marks-file-name');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = form.querySelector('input[name="file"]');
    if (!fileInput.files.length) {
      showMessage('marks-upload-msg', 'Please select a file.', true);
      return;
    }
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    try {
      const res = await fetch(apiBase + '/api/marks/upload', {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Upload failed');
      }
      showMessage('marks-upload-msg', `Uploaded: ${data.inserted}, Skipped: ${data.skipped}`);
      form.reset();
      document.getElementById('marks-file-name').textContent = 'Click to upload or drag file here';
    } catch (err) {
      showMessage('marks-upload-msg', err.message, true);
    }
  });
}

async function handleAttendancePublishForm() {
  const form = document.getElementById('attendance-publish-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        subjectCode: form.subjectCode.value,
        month: form.month.value
      };
      await apiFetch('/api/attendance/publish', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showMessage('attendance-upload-msg', 'Attendance published');
    } catch (err) {
      showMessage('attendance-upload-msg', err.message, true);
    }
  });
}

async function handleMarksPublishForm() {
  const form = document.getElementById('marks-publish-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        subjectCode: form.subjectCode.value,
        assessmentType: form.assessmentType.value
      };
      await apiFetch('/api/marks/publish', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showMessage('marks-upload-msg', 'Marks published');
    } catch (err) {
      showMessage('marks-upload-msg', err.message, true);
    }
  });
}
// Complaints
async function handleComplaintForm() {
  const form = document.getElementById('complaint-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const payload = {
        venueId: form.venueId.value,
        category: form.category.value,
        description: form.description.value
      };
      await apiFetch('/api/complaints', { method: 'POST', body: JSON.stringify(payload) });
      showMessage('complaint-msg', 'Complaint submitted');
      form.reset();
      await loadMyComplaints('complaints-list');
    } catch (err) {
      showMessage('complaint-msg', err.message, true);
    }
  });
}

async function loadMyComplaints(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const rows = await apiFetch('/api/complaints/my');
    if (!rows.length) {
      container.textContent = 'No complaints raised yet.';
      return;
    }
    container.innerHTML = rows
      .map((c) => {
        const venueName = c.venueId?.name || c.venueId?.location || 'Unknown resource';
        return `<div class="card">
          <div><strong>${c.category}</strong></div>
          <div class="muted">Resource: ${venueName}</div>
          <div class="muted">${c.description}</div>
          <div class="muted">Status: ${c.status}</div>
        </div>`;
      })
      .join('');
  } catch (err) {
    container.textContent = err.message;
  }
}

async function loadFacultyComplaints(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const rows = await apiFetch('/api/complaints/faculty/assigned');
    if (!rows.length) {
      container.textContent = 'No complaints for your resources.';
      return;
    }
    container.innerHTML = `<div>${rows
      .map((c) => {
        const studentName = c.raisedBy?.name || 'Unknown';
        const venueName = c.venueId?.name || c.venueId?.location || 'Unknown resource';
        // if already closed, don't render controls
          if (c.status === 'CLOSED') {
            return `<div class="card">
              <div><strong>${c.category}</strong></div>
              <div class="muted">Resource: ${venueName}</div>
              <div class="muted">Raised by: ${studentName}</div>
              <div class="muted">${c.description}</div>
              <div class="muted">Status: <strong>${c.status}</strong></div>
            </div>`;
          }
          return `<div class="card">
            <div><strong>${c.category}</strong></div>
            <div class="muted">Resource: ${venueName}</div>
            <div class="muted">Raised by: ${studentName}</div>
            <div class="muted">${c.description}</div>
            <div class="muted">Status: <strong>${c.status}</strong></div>
            <div class="complaint-actions" style="margin-top: 12px;">
              <select id="status-${c._id}" style="margin-right: 8px;">
                <option value="">-- Update Status --</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
              <button onclick="app.updateComplaintStatus('${c._id}')">Update</button>
            </div>
          </div>`;
      })
      .join('')}</div>`;
  } catch (err) {
    container.textContent = err.message;
  }
}

async function loadAllComplaints(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const rows = await apiFetch('/api/complaints');
    if (!rows.length) {
      container.textContent = 'No complaints in the system.';
      return;
    }
    container.innerHTML = `<div>${rows
      .map((c) => {
        const studentName = c.raisedBy?.name || 'Unknown';
        const venueName = c.venueId?.name || c.venueId?.location || 'Unknown resource';
        const assignedName = c.assignedTo?.name || 'Unassigned';
        // skip controls if closed
        if (c.status === 'CLOSED') {
          return `<div class="card">
            <div><strong>${c.category}</strong></div>
            <div class="muted">Resource: ${venueName}</div>
            <div class="muted">Raised by: ${studentName}</div>
            <div class="muted">Assigned to: ${assignedName}</div>
            <div class="muted">${c.description}</div>
            <div class="muted">Status: <strong>${c.status}</strong></div>
          </div>`;
        }
        return `<div class="card">
          <div><strong>${c.category}</strong></div>
          <div class="muted">Resource: ${venueName}</div>
          <div class="muted">Raised by: ${studentName}</div>
          <div class="muted">Assigned to: ${assignedName}</div>
          <div class="muted">${c.description}</div>
          <div class="muted">Status: <strong>${c.status}</strong></div>
          <div class="complaint-actions" style="margin-top: 12px;">
            <select id="status-${c._id}" style="margin-right: 8px;">
              <option value="">-- Update Status --</option>
              <option value="OPEN">OPEN</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
            <button onclick="app.updateComplaintStatus('${c._id}')">Update</button>
          </div>
        </div>`;
      })
      .join('')}</div>`;
  } catch (err) {
    container.textContent = err.message;
  }
}

async function updateComplaintStatus(complaintId) {
  const statusSelect = document.getElementById(`status-${complaintId}`);
  const status = statusSelect?.value;
  if (!status) {
    alert('Please select a status');
    return;
  }
  try {
    await apiFetch(`/api/complaints/${complaintId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    alert('Complaint status updated');
    window.location.reload();
  } catch (err) {
    alert(err.message);
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
        bookedBy: s.studentId?.name || 'Unknown',
        attendees: s.attendees,
        capacity: s.resourceId?.capacity
      }
    }));

    if (window.calendar) {
      // Remove all existing sources to avoid duplicates/residue
      window.calendar.getEventSources().forEach((source) => source.remove());
      // Add the new events as a fresh source
      window.calendar.addEventSource(events);
    }
  } catch (err) {
    alert(err.message);
  }
}

// Analytics
async function loadVenueUtilization(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const rows = await apiFetch('/api/analytics/venue-utilization');
    if (!rows.length) {
      container.textContent = 'No utilization data yet.';
      return;
    }
    container.innerHTML = `<table>
      <thead><tr><th>Venue</th><th>Type</th><th>Location</th><th>Bookings</th><th>Booked Hours</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr>
          <td>${r.name}</td>
          <td>${r.type}</td>
          <td>${r.location}</td>
          <td>${r.bookingCount}</td>
          <td>${r.hoursBooked.toFixed(2)}</td>
        </tr>`
        )
        .join('')}</tbody>
    </table>`;
  } catch (err) {
    container.textContent = 'Error loading venue utilization: ' + err.message;
  }
}

async function loadFacultyWorkload(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const rows = await apiFetch('/api/analytics/faculty-workload');
    if (!rows.length) {
      container.textContent = 'No workload data yet.';
      return;
    }
    container.innerHTML = `<table>
      <thead><tr><th>Faculty Name</th><th>Email</th><th>Approved Bookings</th><th>Total Hours</th></tr></thead>
      <tbody>${rows
        .map(
          (r) => `<tr>
          <td>${r.facultyName}</td>
          <td>${r.facultyEmail || 'N/A'}</td>
          <td>${r.approvedCount}</td>
          <td>${r.totalHours}</td>
        </tr>`
        )
        .join('')}</tbody>
    </table>`;
  } catch (err) {
    container.textContent = 'Error loading faculty workload: ' + err.message;
  }
}

async function loadFacultyHierarchy(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const users = await apiFetch('/api/admin/users');
    const faculty = users.filter((u) => u.role === 'Faculty');
    if (!faculty.length) {
      container.textContent = 'No faculty accounts found.';
      return;
    }
    const roleOptions = (current) =>
      ['NONE', 'CLUB_INCHARGE', 'HOD', 'ASSOCIATE_DEAN']
        .map((r) => `<option value="${r}" ${current === r ? 'selected' : ''}>${r}</option>`)
        .join('');
    container.innerHTML = `<table>
      <thead><tr><th>Name</th><th>Email</th><th>Faculty Role</th><th>Save</th></tr></thead>
      <tbody>${faculty
        .map(
          (u) => `<tr>
            <td>${u.name}</td>
            <td>${u.email}</td>
            <td>
              <select data-faculty-role="${u._id}">
                ${roleOptions(u.facultyRole || 'NONE')}
              </select>
            </td>
            <td><button onclick="app.saveFacultyRole('${u._id}')">Save</button></td>
          </tr>`
        )
        .join('')}</tbody>
    </table>`;
  } catch (err) {
    container.textContent = err.message;
  }
}

async function saveFacultyRole(id) {
  const roleSel = document.querySelector(`[data-faculty-role="${id}"]`);
  const facultyRole = roleSel ? roleSel.value : 'NONE';
  try {
    await apiFetch(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify({ facultyRole }) });
    alert('Faculty role updated');
  } catch (err) {
    alert(err.message);
  }
}

function highlightActiveNav() {
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('nav a');
  
  navLinks.forEach(link => {
    const linkPath = new URL(link.href).pathname;
    if (linkPath === currentPath) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// build navigation markup according to user role
function buildNav(role) {
  const items = [{ href: '/index.html', text: 'Home' }];
  if (role === 'Student') {
    items.push(
      { href: '/student-dashboard.html', text: 'Dashboard' },
      { href: '/request.html', text: 'New Request' },
      { href: '/calendar.html', text: 'Calendar' },
      { href: '/history.html', text: 'Bookings History' },
      { href: '/attendance.html', text: 'My Attendance' },
      { href: '/marks.html', text: 'My Marks' },
      { href: '/complaints.html', text: 'Complaints' }
    );
  } else if (role === 'Faculty') {
    items.push(
      { href: '/faculty-dashboard.html', text: 'Dashboard' },
      { href: '/approvals.html', text: 'Approvals' },
      { href: '/calendar.html', text: 'Resource Calendar' },
      { href: '/complaints.html', text: 'Complaints' }
    );
  } else if (role === 'Admin') {
    items.push(
      { href: '/admin-dashboard.html', text: 'Dashboard' },
      { href: '/manage-resources.html', text: 'Resources' },
      { href: '/manage-users.html', text: 'Users' },
      { href: '/manage-hierarchy.html', text: 'Hierarchy' },
      { href: '/calendar.html', text: 'Calendar' },
      { href: '/analytics.html', text: 'Analytics' },
      { href: '/complaints.html', text: 'Complaints' }
    );
  }
  return items.map(i => `<a href="${i.href}">${i.text}</a>`).join('');
}

window.app = {
  requireAuth,
  handleChangePasswordForm,
  loadResources,
  loadMyRequests,
  loadMyAttendance,
  loadMyMarks,
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
  loadResourceCalendar,
  handleComplaintForm,
  loadMyComplaints,
  loadFacultyComplaints,
  loadAllComplaints,
  updateComplaintStatus,
  loadVenueUtilization,
  loadFacultyWorkload,
  loadFacultyHierarchy,
  saveFacultyRole,
  handleAttendanceUploadForm,
  handleMarksUploadForm,
  handleAttendancePublishForm,
  handleMarksPublishForm,
  handleBulkStudentUploadForm,
  handleBulkFacultyUploadForm,
  highlightActiveNav,
  buildNav,
  getUser
};

