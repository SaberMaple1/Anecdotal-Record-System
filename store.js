"use strict";

/* ===== STORE: portal, accounts, session, records ===== */

const PORTAL = document.body.dataset.portal || "";
const KEYS = {
  records: "cdlAnecdotalRecords",
  users: "cdlUsers",
  session: "cdlSession",
  last: "cdlLastActive",
};
const ROLE_LABEL = { teacher: "Teacher", guidance: "Guidance Admin" };
const EMAIL_RE = /^[^\s@]+@cdlshs\.edu\.ph$/i;

const clean = (v) => v.trim();
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const today = () => {
  const d = new Date();
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/* ---------- storage helpers ---------- */
function readJSON(store, key, fallback) {
  try {
    const v = JSON.parse(store.getItem(key));
    return v === null || v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}
function writeJSON(store, key, value) {
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ---------- records ---------- */
const getRecords = () => {
  const r = readJSON(localStorage, KEYS.records, []);
  return Array.isArray(r) ? r : [];
};
const saveRecords = (r) => {
  if (!writeJSON(localStorage, KEYS.records, r))
    alert("Unable to save: browser storage is unavailable.");
};

/* ---------- accounts ---------- */
const getUsers = () => {
  const u = readJSON(localStorage, KEYS.users, []);
  return Array.isArray(u) ? u : [];
};
const saveUsers = (u) => writeJSON(localStorage, KEYS.users, u);
const findUser = (email) =>
  getUsers().find((u) => u.email === String(email).toLowerCase());

function updateUser(email, patch) {
  const users = getUsers();
  const u = users.find((x) => x.email === email);
  if (!u) return null;
  Object.assign(u, patch);
  saveUsers(users);
  return u;
}

const fallbackHash = (str) => {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};

async function hashPassword(password, salt, forceFallback = false) {
  const data = salt + ":" + password;
  if (!forceFallback && window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(data),
    );
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return "fb:" + fallbackHash(data);
}
const newSalt = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);
// Works whichever method originally created the hash
const verifyPassword = async (user, password) =>
  (await hashPassword(password, user.salt, user.hash.startsWith("fb:"))) ===
  user.hash;

/* Returns the new user, or throws an Error with a readable message */
async function createUser({ name, email, password, role }) {
  email = clean(email).toLowerCase();
  name = clean(name);
  if (!name) throw new Error("Enter the full name.");
  if (!EMAIL_RE.test(email))
    throw new Error("Use a valid CDL-SHS school email (name@cdlshs.edu.ph).");
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password))
    throw new Error(
      "Password needs at least 8 characters with a letter and a number.",
    );
  if (findUser(email))
    throw new Error("An account with this email already exists.");
  const salt = newSalt();
  const user = {
    email,
    name,
    role,
    salt,
    hash: await hashPassword(password, salt),
    active: true,
    avatar: "",
    timeout: 15,
    createdAt: new Date().toISOString(),
  };
  const users = getUsers();
  users.push(user);
  if (!saveUsers(users))
    throw new Error("Unable to save: browser storage is unavailable.");
  return user;
}

/* First run only: create the two starter accounts */
async function seedUsers() {
  if (getUsers().length) return;
  await createUser({
    name: "Demo Teacher",
    email: "teacher@cdlshs.edu.ph",
    password: "Teacher123",
    role: "teacher",
  });
  await createUser({
    name: "Guidance Officer",
    email: "guidance@cdlshs.edu.ph",
    password: "Guidance123",
    role: "guidance",
  });
}

/* ---------- session (survives refresh, ends when the tab closes) ---------- */
let session = null;
const getSessionEmail = () =>
  (readJSON(sessionStorage, KEYS.session, null) || {}).email;
const setSession = (email) =>
  writeJSON(sessionStorage, KEYS.session, { email });
const clearSession = () => {
  sessionStorage.removeItem(KEYS.session);
  sessionStorage.removeItem(KEYS.last);
};
