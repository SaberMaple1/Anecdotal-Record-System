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
  const norm = (v) => clean(String(v)).replace(/\s+/g, " ").toLowerCase();
  const q = norm($("teacherStudentSearch").value);
  const out = $("teacherSearchResult");
  if (q.length < 2) {
    out.className = "lookup-result none";
    out.innerHTML =
      "<strong>Enter at least 2 characters.</strong><br><small>Use the student ID or name.</small>";
    return;
  }
  const mine = getRecords().filter(
    (r) => String(r.createdBy).toLowerCase() === String(session.email).toLowerCase(),
  );
  const matches = mine.filter(
    (r) => norm(r.studentId).includes(q) || norm(r.studentName).includes(q),
  );
  if (!matches.length) {
    out.className = "lookup-result none";
    out.innerHTML = `<strong>No matching record found</strong><br><small>You have not submitted a record matching "${esc(q)}". Check the spelling or Student ID.</small>`;
    return;
  }
  // group matching records by student
  const byStudent = new Map();
  matches.forEach((r) => {
    const key = norm(r.studentId);
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push(r);
  });
  out.className = "lookup-result found";
  out.innerHTML =
    `<strong>${byStudent.size} student${byStudent.size > 1 ? "s" : ""} found</strong>` +
    [...byStudent.values()]
      .map((list) => {
        const s = list[0];
        const reviewed = list.filter((r) => r.status === "Reviewed").length;
        return `<div style="margin-top:10px"><span>${esc(s.studentName)} &middot; ${esc(s.studentId)} &middot; ${esc(s.gradeSection)}</span>
    <div class="record-chips"><span class="record-chip">${list.length} record${list.length > 1 ? "s" : ""}</span><span class="record-chip">${reviewed} reviewed</span><span class="record-chip">${list.length - reviewed} pending</span></div></div>`;
      })
      .join("");
}

function exportPDF() {
  if (!session || session.role !== "guidance") return;
  const rows = visible();
  if (!rows.length) return alert("There are no records to export.");
  if (!window.jspdf)
    return alert(
      "The PDF library did not load. Keep the 'lib' folder next to guidance.html.",
    );
  const doc = new window.jspdf.jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });
  doc.setFontSize(14);
  doc.text("Crecencia Drucila Lopez Senior High School", 40, 40);
  doc.setFontSize(11);
  doc.text("Anecdotal Records Report", 40, 58);
  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleString("en-PH")} by ${session.name}  |  ${rows.length} record${rows.length > 1 ? "s" : ""}`,
    40,
    74,
  );
  doc.autoTable({
    startY: 88,
    margin: { left: 40, right: 40, bottom: 40 },
    head: [
      [
        "Date",
        "Student ID",
        "Student",
        "Section",
        "Category",
        "Observation",
        "Action Taken",
        "Recorded By",
        "Status",
      ],
    ],
    body: rows.map((r) => [
      r.date,
      r.studentId,
      r.studentName,
      r.gradeSection,
      r.category,
      r.observation,
      r.actionTaken,
      r.teacherName,
      r.status,
    ]),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [59, 42, 138] },
    columnStyles: { 5: { cellWidth: 150 }, 6: { cellWidth: 110 } },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.text(
        "Page " + doc.internal.getNumberOfPages(),
        doc.internal.pageSize.getWidth() - 70,
        doc.internal.pageSize.getHeight() - 20,
      );
    },
  });
  doc.save(`CDL-SHS-Anecdotal-Report-${today()}.pdf`);
}
