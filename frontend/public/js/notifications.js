function fmtStatusBadge(status) {
  return `<span class="badge">${status}</span>`;
}

function renderStudent(items) {
  if (!items.length) {
    return '<p class="muted">No requests found.</p>';
  }

  return `<ul class="notification-list">
    ${items
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(
        (req) => `<li>
          <strong>${req.subject}</strong>
          <div class="muted">To: ${req.to?.name || 'Professor/Admin'}</div>
          <div>Status: ${fmtStatusBadge(req.status)}</div>
          <div class="muted">Updated: ${new Date(req.updatedAt || req.createdAt).toLocaleString()}</div>
        </li>`
      )
      .join('')}
  </ul>`;
}

function renderReviewer(items) {
  if (!items.length) {
    return '<p class="muted">No incoming requests.</p>';
  }

  return `<ul class="notification-list">
    ${items
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(
        (req) => `<li>
          <strong>${req.subject}</strong>
          <div class="muted">From: ${req.studentId?.name || req.name || 'Student'}</div>
          <div>Status: ${fmtStatusBadge(req.status)}</div>
          <div class="muted">Updated: ${new Date(req.updatedAt || req.createdAt).toLocaleString()}</div>
        </li>`
      )
      .join('')}
  </ul>`;
}

async function loadNotifications() {
  const user = await app.requireAuth(['Student', 'Faculty', 'Admin']);
  if (!user) return;

  const summary = document.getElementById('notification-summary');
  const container = document.getElementById('notification-content');

  try {
    const endpoint = user.role === 'Student'
      ? '/api/document-requests/student/my'
      : '/api/document-requests/inbox';

    const res = await fetch(endpoint, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch notifications');
    const items = await res.json();

    if (user.role === 'Student') {
      const approved = items.filter((r) => r.status === 'Approved').length;
      summary.textContent = `Approved updates: ${approved}`;
      container.innerHTML = renderStudent(items);
    } else {
      const pending = items.filter((r) => r.status === 'Pending' || r.status === 'Forwarded').length;
      const approved = items.filter((r) => r.status === 'Approved').length;
      summary.textContent = `Pending: ${pending} | Approved: ${approved}`;
      container.innerHTML = renderReviewer(items);
    }
  } catch (err) {
    container.textContent = err.message;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadNotifications();
  const refreshBtn = document.getElementById('refresh-notifications');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await loadNotifications();
    });
  }
});
