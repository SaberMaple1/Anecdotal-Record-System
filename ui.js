"use strict";

/* ===== UI: DOM helpers, views, and rendering ===== */

const $ = (id) => document.getElementById(id);
const HOME = PORTAL === "teacher" ? "teacherHome" : "guidanceHome";

const msg = (el, text, cls) => {
  el.textContent = text;
  el.className = "message " + cls;
};
const clearMsg = (el) => {
  el.textContent = "";
  el.className = "message";
};
const setHTML = (id, html) => {
  const el = $(id);
  if (el) el.innerHTML = html;
};
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function paintAvatar(el, user) {
  if (user.avatar) {
    el.style.backgroundImage = `url("${user.avatar}")`;
    el.textContent = "";
  } else {
    el.style.backgroundImage = "";
    el.textContent = initials(user.name);
  }
}

function openApp() {
  $("loginPage").classList.add("hidden");
  $("appPage").classList.remove("hidden");
  $("currentUser").textContent = session.name;
  $("currentRole").textContent = ROLE_LABEL[session.role];
  $("welcomeTitle").textContent = "Welcome, " + session.name;
  $("todayText").textContent = new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  paintAvatar($("avatar"), session);
  showView(HOME);
}

function showView(id) {
  document
    .querySelectorAll(".app-view")
    .forEach((v) => v.classList.add("hidden"));
  $(id).classList.remove("hidden");
  document
    .querySelectorAll(".nav-btn[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === id));
  if (id === "settings") renderSettings();
  renderAll();
  window.scrollTo(0, 0);
}

function visible() {
  let r = getRecords();
  if (session && session.role === "teacher")
    r = r.filter((x) => x.createdBy === session.email);
  const q = $("search") ? clean($("search").value).toLowerCase() : "";
  const s = $("statusFilter") ? $("statusFilter").value : "all";
  return r.filter(
    (x) =>
      (s === "all" || x.status === s) &&
      (!q ||
        [x.studentId, x.studentName, x.gradeSection, x.category].some((v) =>
          v.toLowerCase().includes(q),
        )),
  );
}

const stat = (label, value) =>
  `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;

function tableHTML(rows, controls = false) {
  if (!rows.length) return '<div class="empty">No records found.</div>';
  const cell = (label, html) => `<td data-label="${label}">${html}</td>`;
  let h =
    '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Section</th><th>Category</th><th>Observation / Action</th><th>Submitted By</th><th>Status</th>' +
    (controls ? "<th>Controls</th>" : "") +
    "</tr></thead><tbody>";
  rows.forEach((x) => {
    const reviewed = x.status === "Reviewed";
    h +=
      "<tr>" +
      cell("Date", esc(x.date)) +
      cell(
        "Student",
        `<strong>${esc(x.studentName)}</strong><br>${esc(x.studentId)}`,
      ) +
      cell("Section", esc(x.gradeSection)) +
      cell("Category", esc(x.category)) +
      cell(
        "Observation",
        `${esc(x.observation)}<br><small><b>Action:</b> ${esc(x.actionTaken)}</small>`,
      ) +
      cell("Submitted by", esc(x.teacherName)) +
      cell(
        "Status",
        `<span class="badge ${reviewed ? "reviewed" : "pending"}">${esc(x.status)}</span>`,
      ) +
      (controls
        ? cell(
            "Controls",
            `<div class="actions"><button class="btn btn-soft btn-sm" onclick="toggleStatus(${x.id})">${reviewed ? "Reopen" : "Review"}</button><button class="btn btn-danger btn-sm" onclick="deleteRecord(${x.id})">Delete</button></div>`,
          )
        : "") +
      "</tr>";
  });
  return h + "</tbody></table></div>";
}

function renderAll() {
  if (!session) return;
  const all = getRecords();
  if (PORTAL === "teacher") {
    const mine = all.filter((r) => r.createdBy === session.email);
    const month = today().slice(0, 7);
    setHTML(
      "teacherStats",
      stat("My Records", mine.length) +
        stat(
          "Pending",
          mine.filter((r) => r.status === "Pending Review").length,
        ) +
        stat("Reviewed", mine.filter((r) => r.status === "Reviewed").length) +
        stat(
          "This Month",
          mine.filter((r) => r.date.slice(0, 7) === month).length,
        ),
    );
    setHTML("teacherRecent", tableHTML(mine.slice(0, 5)));
    setHTML("teacherTable", tableHTML(mine));
  } else {
    setHTML(
      "guidanceStats",
      stat("Total Records", all.length) +
        stat(
          "Pending Review",
          all.filter((r) => r.status === "Pending Review").length,
        ) +
        stat("Reviewed", all.filter((r) => r.status === "Reviewed").length) +
        stat("Students", new Set(all.map((r) => r.studentId)).size),
    );
    setHTML(
      "pendingQueue",
      tableHTML(
        all.filter((r) => r.status === "Pending Review").slice(0, 4),
        true,
      ),
    );
    const c = {};
    all.forEach((r) => (c[r.category] = (c[r.category] || 0) + 1));
    setHTML(
      "categorySummary",
      Object.keys(c).length
        ? Object.entries(c)
            .sort((a, b) => b[1] - a[1])
            .map(
              ([k, v]) =>
                `<div class="summary-row"><span>${esc(k)}</span><b>${v}</b></div>`,
            )
            .join("")
        : '<div class="empty">No category data yet.</div>',
    );
    setHTML("guidanceTable", tableHTML(visible(), true));
  }
}

function renderSettings() {
  paintAvatar($("settingsAvatar"), session);
  $("displayName").value = session.name;
  $("timeoutSelect").value = String(session.timeout || 15);
  const info = [
    ["Name", session.name],
    ["Email", session.email],
    ["Account type", ROLE_LABEL[session.role]],
    [
      "Created",
      new Date(session.createdAt).toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    ],
    ["Auto sign-out", (session.timeout || 15) + " minutes"],
  ];
  setHTML(
    "infoList",
    info.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join(""),
  );
  if (PORTAL === "guidance") renderAccounts();
}

function renderAccounts() {
  const rows = getUsers()
    .map(
      (u) => `<tr>
    <td data-label="Name">${esc(u.name)}</td><td data-label="Email">${esc(u.email)}</td>
    <td data-label="Type">${ROLE_LABEL[u.role]}</td>
    <td data-label="Status"><span class="badge ${u.active ? "active-b" : "inactive-b"}">${u.active ? "Active" : "Inactive"}</span></td>
    <td data-label="Action">${u.email === session.email ? "You" : `<button class="btn btn-soft btn-sm" onclick="toggleAccount('${esc(u.email)}')">${u.active ? "Deactivate" : "Activate"}</button>`}</td></tr>`,
    )
    .join("");
  setHTML(
    "accountTable",
    `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Type</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`,
  );
}
