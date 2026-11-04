"use strict";

/* ===== APP: startup, sign in/out, idle timer, event wiring ===== */

/* ---------- session lifecycle ---------- */
function startSession(user) {
  session = user;
  setSession(user.email);
  markActive();
  openApp();
  startIdleTimer();
}

function signOut(message) {
  stopIdleTimer();
  clearSession();
  session = null;
  $("appPage").classList.add("hidden");
  $("loginPage").classList.remove("hidden");
  $("idleWarn").classList.add("hidden");
  $("loginForm").reset();
  $("search") && ($("search").value = "");
  $("statusFilter") && ($("statusFilter").value = "all");
  if ($("teacherSearchResult")) {
    $("teacherStudentSearch").value = "";
    $("teacherSearchResult").className = "lookup-result";
  }
  clearMsg($("loginMessage"));
  if (message) msg($("loginMessage"), message, "error");
}

function refreshSession() {
  session = findUser(session.email) || session;
  $("currentUser").textContent = session.name;
  $("welcomeTitle").textContent = "Welcome, " + session.name;
  paintAvatar($("avatar"), session);
}

/* ---------- idle timer (counts only time spent active on this page) ---------- */
let idleTimer = null;
let warning = false;
const WARN_SECONDS = 60;

function markActive() {
  try {
    sessionStorage.setItem(KEYS.last, String(Date.now()));
  } catch {}
}
const lastActive = () =>
  Number(sessionStorage.getItem(KEYS.last)) || Date.now();
const idleLimit = () => (session.timeout || 15) * 60000;

function onActivity() {
  if (session && !warning) markActive();
}

function idleTick() {
  if (!session || document.hidden) return; // switching tabs or apps never signs you out
  const left = idleLimit() - (Date.now() - lastActive());
  if (left <= 0) return signOut("You were signed out because of inactivity.");
  warning = left <= WARN_SECONDS * 1000;
  $("idleWarn").classList.toggle("hidden", !warning);
  if (warning) $("idleSecs").textContent = Math.ceil(left / 1000);
}

function startIdleTimer() {
  stopIdleTimer();
  idleTimer = setInterval(idleTick, 1000);
}
function stopIdleTimer() {
  clearInterval(idleTimer);
  warning = false;
}

["mousemove", "keydown", "click", "touchstart", "scroll"].forEach((ev) =>
  window.addEventListener(ev, onActivity, { passive: true }),
);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && session && !warning) markActive(); // returning from another tab restarts the countdown
});
$("stayBtn").onclick = () => {
  warning = false;
  markActive();
  $("idleWarn").classList.add("hidden");
};

/* ---------- sign in / create account ---------- */
$("showPassword").onclick = () => {
  const p = $("password");
  p.type = p.type === "password" ? "text" : "password";
  $("showPassword").textContent = p.type === "password" ? "Show" : "Hide";
};

$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  clearMsg($("loginMessage"));
  const email = clean($("email").value).toLowerCase();
  const password = $("password").value;
  if (!EMAIL_RE.test(email))
    return msg(
      $("loginMessage"),
      "Enter a valid CDL-SHS school email.",
      "error",
    );
  if (password.length < 8)
    return msg(
      $("loginMessage"),
      "Password must contain at least 8 characters.",
      "error",
    );
  const u = findUser(email);
  if (!u || !(await verifyPassword(u, password)))
    return msg($("loginMessage"), "Incorrect email or password.", "error");
  if (u.role !== PORTAL) {
    const other = u.role === "teacher" ? "teacher.html" : "guidance.html";
    return msg(
      $("loginMessage"),
      `This is a ${ROLE_LABEL[u.role]} account. Please sign in on the ${ROLE_LABEL[u.role]} portal (${other}).`,
      "error",
    );
  }
  if (!u.active)
    return msg(
      $("loginMessage"),
      "This account is inactive. Contact the guidance office.",
      "error",
    );
  startSession(u);
};

if ($("signupForm")) {
  $("toggleAuth").onclick = () => {
    const signing = !$("signupForm").classList.contains("hidden");
    $("signupForm").classList.toggle("hidden", signing);
    $("loginForm").classList.toggle("hidden", !signing);
    $("authHeading").textContent = signing ? "Sign in" : "Create account";
    $("switchText").textContent = signing
      ? "No account yet?"
      : "Already have an account?";
    $("toggleAuth").textContent = signing ? "Create account" : "Sign in";
    clearMsg($("signupMessage"));
    clearMsg($("loginMessage"));
  };
  $("signupForm").onsubmit = async (e) => {
    e.preventDefault();
    clearMsg($("signupMessage"));
    if ($("suPassword").value !== $("suConfirm").value)
      return msg($("signupMessage"), "Passwords do not match.", "error");
    try {
      const user = await createUser({
        name: $("suName").value,
        email: $("suEmail").value,
        password: $("suPassword").value,
        role: "teacher",
      });
      $("signupForm").reset();
      startSession(user);
    } catch (err) {
      msg($("signupMessage"), err.message, "error");
    }
  };
}

$("logoutBtn").onclick = () => signOut();

/* ---------- navigation ---------- */
document
  .querySelectorAll(".nav-btn[data-view]")
  .forEach((b) => (b.onclick = () => showView(b.dataset.view)));

/* ---------- teacher: new record ---------- */
if ($("recordForm")) {
  $("incidentDate").max = today();
  $("recordForm").addEventListener("reset", () => clearMsg($("formMessage")));
  $("teacherSearchBtn").onclick = teacherLookup;
  $("teacherStudentSearch").onkeydown = (e) =>
    e.key === "Enter" && teacherLookup();
  $("recordForm").onsubmit = (e) => {
    e.preventDefault();
    clearMsg($("formMessage"));
    const ids = [
      "studentId",
      "studentName",
      "gradeSection",
      "incidentDate",
      "category",
      "observation",
      "actionTaken",
    ];
    if (ids.some((id) => !clean($(id).value)))
      return msg(
        $("formMessage"),
        "Please complete every required field.",
        "error",
      );
    if (!/^[A-Za-z0-9-]+$/.test(clean($("studentId").value)))
      return msg(
        $("formMessage"),
        "Student ID may contain only letters, numbers, and hyphens.",
        "error",
      );
    if ($("incidentDate").value > today())
      return msg(
        $("formMessage"),
        "Observation date cannot be in the future.",
        "error",
      );
    const r = getRecords();
    r.unshift({
      id: Date.now(),
      studentId: clean($("studentId").value),
      studentName: clean($("studentName").value),
      gradeSection: clean($("gradeSection").value),
      date: $("incidentDate").value,
      category: $("category").value,
      observation: clean($("observation").value),
      actionTaken: clean($("actionTaken").value),
      createdBy: session.email,
      teacherName: session.name,
      status: "Pending Review",
      createdAt: new Date().toISOString(),
    });
    saveRecords(r);
    e.target.reset();
    msg(
      $("formMessage"),
      "Record submitted successfully for guidance review.",
      "success",
    );
    renderAll();
  };
}

/* ---------- guidance: filters and export ---------- */
if ($("search")) {
  $("search").oninput = $("statusFilter").onchange = renderAll;
  $("exportNav").onclick = $("exportTop").onclick = exportPDF;
}

/* ---------- settings ---------- */
function fileToAvatar(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 160,
        c = document.createElement("canvas"),
        m = Math.min(img.width, img.height);
      c.width = c.height = size;
      c.getContext("2d").drawImage(
        img,
        (img.width - m) / 2,
        (img.height - m) / 2,
        m,
        m,
        0,
        0,
        size,
        size,
      );
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("bad image"));
    img.src = url;
  });
}

$("avatarInput").onchange = async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  clearMsg($("profileMessage"));
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)
    return msg(
      $("profileMessage"),
      "Choose an image file under 5 MB.",
      "error",
    );
  try {
    updateUser(session.email, { avatar: await fileToAvatar(file) });
    refreshSession();
    renderSettings();
    msg($("profileMessage"), "Profile photo updated.", "success");
  } catch {
    msg($("profileMessage"), "That image could not be read.", "error");
  }
};
$("removeAvatar").onclick = () => {
  updateUser(session.email, { avatar: "" });
  refreshSession();
  renderSettings();
};
$("saveName").onclick = () => {
  const name = clean($("displayName").value);
  if (!name) return msg($("profileMessage"), "Name cannot be empty.", "error");
  updateUser(session.email, { name });
  refreshSession();
  renderSettings();
  msg($("profileMessage"), "Name saved.", "success");
};
$("timeoutSelect").onchange = (e) => {
  updateUser(session.email, { timeout: Number(e.target.value) });
  refreshSession();
  markActive();
  renderSettings();
};

if ($("accountForm")) {
  $("accountForm").onsubmit = async (e) => {
    e.preventDefault();
    clearMsg($("accountMessage"));
    try {
      const u = await createUser({
        name: $("acName").value,
        email: $("acEmail").value,
        password: $("acPassword").value,
        role: $("acRole").value,
      });
      e.target.reset();
      renderAccounts();
      msg(
        $("accountMessage"),
        `${ROLE_LABEL[u.role]} account created for ${u.email}.`,
        "success",
      );
    } catch (err) {
      msg($("accountMessage"), err.message, "error");
    }
  };
}

/* ---------- startup: stay signed in after a refresh ---------- */
(async function init() {
  await seedUsers();
  const u = findUser(getSessionEmail());
  if (u && u.active && u.role === PORTAL) {
    if (Date.now() - lastActive() > (u.timeout || 15) * 60000)
      return clearSession();
    session = u;
    markActive();
    openApp();
    startIdleTimer();
  }
})();
