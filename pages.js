"use strict";

/* ===== PAGES: record actions, lookup, accounts, PDF export ===== */

function toggleStatus(id) {
  if (!session || session.role !== "guidance") return;
  const r = getRecords();
  const x = r.find((y) => y.id === id);
  if (x) {
    x.status = x.status === "Reviewed" ? "Pending Review" : "Reviewed";
    saveRecords(r);
    renderAll();
  }
}

function deleteRecord(id) {
  if (
    !session ||
    session.role !== "guidance" ||
    !confirm("Permanently delete this record?")
  )
    return;
  saveRecords(getRecords().filter((r) => r.id !== id));
  renderAll();
}

function toggleAccount(email) {
  if (!session || session.role !== "guidance" || email === session.email)
    return;
  const u = findUser(email);
  if (u) updateUser(email, { active: !u.active });
  renderAccounts();
}

function teacherLookup() {
  if (!session || session.role !== "teacher") return;
  const q = clean($("teacherStudentSearch").value).toLowerCase();
  const out = $("teacherSearchResult");
  if (q.length < 2) {
    out.className = "lookup-result none";
    out.innerHTML =
      "<strong>Enter at least 2 characters.</strong><br><small>Use the student ID or full name.</small>";
    return;
  }
  const matches = getRecords().filter(
    (r) =>
      r.createdBy === session.email &&
      (r.studentId.toLowerCase() === q ||
        r.studentName.toLowerCase().includes(q)),
  );
  if (!matches.length) {
    out.className = "lookup-result none";
    out.innerHTML = `<strong>No matching record found</strong><br><small>You have not submitted a record matching "${esc(q)}". Check the spelling or Student ID.</small>`;
    return;
  }
  const s = matches[0];
  const reviewed = matches.filter((r) => r.status === "Reviewed").length;
  out.className = "lookup-result found";
  out.innerHTML = `<strong>Student record found</strong><br><span>${esc(s.studentName)} &middot; ${esc(s.studentId)} &middot; ${esc(s.gradeSection)}</span>
    <div class="record-chips"><span class="record-chip">${matches.length} record${matches.length > 1 ? "s" : ""}</span><span class="record-chip">${reviewed} reviewed</span><span class="record-chip">${matches.length - reviewed} pending</span></div>`;
}

/* ---------- PDF: one Anecdotal Record Form per record ---------- */
const fmtDate = (iso) =>
  iso
    ? new Date(iso + "T00:00:00").toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
const fmtTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function drawRecordForm(doc, r) {
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const L = 60,
    R = PW - 60,
    W = R - L,
    BOTTOM = PH - 56,
    X0 = L + 30; // indent for the filled-in lines
  let y = 52;
  const font = (style = "normal", size = 11) => {
    doc.setFont("times", style);
    doc.setFontSize(size);
  };
  const room = (h) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      y = 60;
    }
  };

  // Header
  font("bold", 12);
  doc.text("CRECENCIA DRUCILA LOPEZ SENIOR HIGH SCHOOL", PW / 2, y, {
    align: "center",
  });
  y += 12;
  doc.setLineWidth(3);
  doc.line(0, y, PW, y);
  doc.setLineWidth(0.75);
  doc.line(0, y + 4, PW, y + 4);
  y += 38;
  font("bold", 14);
  doc.text("ANECDOTAL RECORD FORM", PW / 2, y, { align: "center" });
  y += 26;

  const heading = (t) => {
    room(60);
    font("bold", 11);
    doc.text(t, L, y);
    y += 19;
  };

  // "Label: ______" with the value written on the line
  const field = (label, value, x, w) => {
    font("normal", 11);
    doc.text(label, x, y);
    const lx = x + doc.getTextWidth(label) + 5;
    const avail = x + w - lx - 6;
    doc.setLineWidth(0.6);
    doc.line(lx, y + 2, x + w, y + 2);
    let v = String(value || "").replace(/\s+/g, " ");
    let size = 11;
    while (size > 7 && doc.getTextWidth(v) > avail) doc.setFontSize((size -= 0.5));
    while (v.length > 1 && doc.getTextWidth(v) > avail) v = v.slice(0, -2) + "…";
    doc.text(v, lx + 3, y - 1);
    font("normal", 11);
  };
  const row = (label, value) => {
    room(24);
    field(label, value, X0, W - 30);
    y += 19;
  };

  // I. Learner profile
  heading("I. LEARNER PROFILE");
  row("Name of Student:", r.studentName);
  room(24);
  field("LRN:", r.studentId, X0, 200);
  field("Age:", r.age, X0 + 215, 95);
  field("Sex:", r.sex, X0 + 325, W - 30 - 325);
  y += 19;
  row("Grade & Section:", r.gradeSection);
  row("Address:", r.address);
  row("Parent/Guardian:", r.guardian);
  row("Contact Number:", r.contactNumber);

  // II. Observation details
  y += 4;
  heading("II. OBSERVATION DETAILS");
  room(24);
  field("Date of Observation:", fmtDate(r.date), X0, 235);
  field("Time:", fmtTime(r.time), X0 + 255, W - 30 - 255);
  y += 19;
  row("Location/Setting:", r.location);
  row("Observer/Adviser:", r.teacherName);
  row("Category:", r.category);

  // III - V: bold heading + italic hint, then ruled lines
  const section = (title, hint, text) => {
    y += 9;
    room(80);
    font("bold", 11);
    doc.text(title, L, y);
    let cx = L + doc.getTextWidth(title) + 6;
    font("italic", 9.5);
    hint.split(" ").forEach((word) => {
      const w = doc.getTextWidth(word + " ");
      if (cx + w > R) {
        cx = L;
        y += 13;
      }
      doc.text(word, cx, y);
      cx += w;
    });
    y += 6;
    font("normal", 11);
    const lines = text ? doc.splitTextToSize(String(text), W - 4) : [];
    const count = Math.max(3, lines.length);
    doc.setLineWidth(0.6);
    for (let i = 0; i < count; i++) {
      room(24);
      y += 20;
      if (lines[i]) doc.text(lines[i], L + 2, y - 3);
      doc.line(L, y, R, y);
    }
    y += 6;
  };
  section(
    "III. NARRATIVE DESCRIPTION",
    "(Describe the specific incident or behavior observed using factual, objective language. Focus on what was seen and heard without interpretation.)",
    r.observation,
  );
  section(
    "IV. ACTION TAKEN / INTERVENTION",
    "(Immediate steps taken by the teacher or adviser to address the behavior or incident.)",
    r.actionTaken,
  );
  section(
    "V. RECOMMENDATIONS / NOTES",
    "(Long-term suggestions or referrals for guidance counseling if the behavior persists.)",
    r.recommendations,
  );

  // Signature
  room(80);
  y += 38;
  const cx = PW / 2;
  font("normal", 11);
  doc.text(String(r.teacherName || ""), cx, y - 4, { align: "center" });
  doc.setLineWidth(0.8);
  doc.line(cx - 125, y, cx + 125, y);
  doc.text("Signature Over Printed Name of the Observer/Adviser", cx, y + 15, {
    align: "center",
  });
}

function exportPDF() {
  if (!session || session.role !== "guidance") return;
  const rows = visible();
  if (!rows.length) return alert("There are no records to export.");
  if (!window.jspdf)
    return alert(
      "The PDF library did not load. Keep the 'lib' folder next to guidance.html.",
    );
  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
  rows.forEach((r, i) => {
    if (i) doc.addPage();
    drawRecordForm(doc, r);
  });
  doc.save(`CDL-SHS-Anecdotal-Records-${today()}.pdf`);
}
