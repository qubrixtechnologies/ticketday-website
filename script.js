// CONFIG — adjust this to match IRCTC rule you want
const BOOKING_WINDOW_DAYS = 60;      // how many days before journey normal booking opens
const NORMAL_OPEN_HOUR = 08;          // 0 for midnight
const NORMAL_OPEN_MINUTE = 0;        // 0 minutes
const TATKAL_OPEN_DAYS_BEFORE = 1;   // Tatkal: 1 day before
const TATKAL_OPEN_HOUR = 9;         // 10 AM
const TATKAL_OPEN_MINUTE = 30;

// ---------- Helpers ----------
function parseDateInput(value) {
  if (!value) return null;
  return new Date(value + "T00:00:00");
}
function formatISTDateTime(d) {
  // date + time in IST
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  } catch {
    return d.toString();
  }
}
function formatISTDate(d) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(d);
  } catch {
    return d.toDateString();
  }
}
function formatTimeIST(d) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit"
    }).format(d);
  } catch {
    return d.toTimeString();
  }
}
function formatShort(d) {
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
function googleIso(d) {
  return d.toISOString().replace(/-|:|\.\d{3}/g, "");
}
function makeGoogleUrl(ev) {
  const start = googleIso(ev.open);
  const end = googleIso(new Date(ev.open.getTime() + 30 * 60 * 1000));
  const title = encodeURIComponent(
    `IRCTC Booking Open — journey ${formatShort(ev.journey)}`
  );
  const details = encodeURIComponent(
    `Booking opens for journey date ${formatShort(
      ev.journey
    )}. Source: ticketday.in`
  );
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${start}/${end}`;
}
function makeYahooUrl(ev) {
  const start = googleIso(ev.open);
  const end = googleIso(new Date(ev.open.getTime() + 30 * 60 * 1000));
  const title = encodeURIComponent(
    `IRCTC Booking Open — ${formatShort(ev.journey)}`
  );
  const desc = encodeURIComponent(
    `Booking opens for journey date ${formatShort(
      ev.journey
    )}. Source: ticketday.in`
  );
  return `https://calendar.yahoo.com/?v=60&title=${title}&st=${start}&et=${end}&desc=${desc}`;
}
function makeOutlookUrl(ev) {
  const start = ev.open.toISOString();
  const end = new Date(ev.open.getTime() + 30 * 60 * 1000).toISOString();
  const subject = encodeURIComponent(
    `IRCTC Booking Open — ${formatShort(ev.journey)}`
  );
  const body = encodeURIComponent(
    `Booking opens for journey date ${formatShort(
      ev.journey
    )}. Source: ticketday.in`
  );
  return `https://outlook.office.com/calendar/0/deeplink/compose?startdt=${start}&enddt=${end}&subject=${subject}&body=${body}`;
}
function escapeICS(text) {
  return text.replace(/\n/g, "\\n").replace(/,/g, "\\,");
}
function buildICS(ev) {
  const uid = `ticketday-${Date.now()}@ticketday.in`;
  const dtstamp = ev.open.toISOString().replace(/-|:|\.\d{3}/g, "");
  const dtstart = dtstamp;
  const dtend = new Date(ev.open.getTime() + 30 * 60 * 1000)
    .toISOString()
    .replace(/-|:|\.\d{3}/g, "");
  const summary = `IRCTC Booking Open — ${formatShort(ev.journey)}`;
  const description = `Booking opens for journey date ${formatShort(
    ev.journey
  )}. Visit ticketday.in for details.`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ticketday//Ticketday IRCTC Calc//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeICS(summary)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}
function downloadICS(ev) {
  const ics = buildICS(ev);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ticketday-booking.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- DOM refs ----------
const heroLastJourney = document.getElementById("hero-last-journey");
const journeyInput = document.getElementById("journeyDate");
const customDaysWrapper = document.getElementById("custom-days-wrapper");
const customDaysInput = document.getElementById("customDays");
const calcBtn = document.getElementById("calcBtn");

const noResult = document.getElementById("no-result");
const resultBlock = document.getElementById("result-block");
const bookingOpenDateEl = document.getElementById("booking-open-date");
const bookingOpenTimeEl = document.getElementById("booking-open-time");
const bookingOnText = document.getElementById("booking-on");

const googleLink = document.getElementById("google-link");
const yahooLink = document.getElementById("yahoo-link");
const outlookLink = document.getElementById("outlook-link");
const appleBtn = document.getElementById("apple-btn");
const icsBtn = document.getElementById("ics-btn");
const phoneBtn = document.getElementById("phone-btn");

let currentEvent = null;

// Open native date picker whenever user clicks or focuses the input
if (journeyInput && journeyInput.showPicker) {
  const openPicker = () => journeyInput.showPicker();

  journeyInput.addEventListener("click", openPicker);
  journeyInput.addEventListener("focus", openPicker);
}

// ---------- Initialize hero "till" date ----------
(function initHeroDate() {
  const today = new Date();
  const lastJourney = new Date(today);
  lastJourney.setDate(today.getDate() + BOOKING_WINDOW_DAYS);
  heroLastJourney.textContent = formatISTDate(lastJourney);
})();

// ---------- Booking window radios ----------
const radioInputs = document.querySelectorAll('input[name="type"]');
const pillLabels = document.querySelectorAll(".pill");

function updatePillStates() {
  pillLabels.forEach(pill => {
    const input = pill.querySelector("input");
    if (input.checked) pill.classList.add("active");
    else pill.classList.remove("active");
  });
}

radioInputs.forEach(input => {
  input.addEventListener("change", () => {
    customDaysWrapper.style.display =
      input.value === "custom" && input.checked ? "flex" : customDaysWrapper.style.display;
    if (input.value !== "custom" && input.checked) {
      customDaysWrapper.style.display = "none";
    }
    updatePillStates();
  });
});
pillLabels.forEach(pill => {
  pill.addEventListener("click", () => {
    const input = pill.querySelector("input");
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event("change"));
    }
  });
});
updatePillStates();

// ---------- Core calculation ----------
function calculateEvent() {
  const jd = parseDateInput(journeyInput.value);
  if (!jd) return null;
  const type = document.querySelector('input[name="type"]:checked').value;
  let open = new Date(jd);

  if (type === "60-day") {
    open.setDate(open.getDate() - BOOKING_WINDOW_DAYS);
    open.setHours(NORMAL_OPEN_HOUR, NORMAL_OPEN_MINUTE, 0, 0);
  } else if (type === "tatkal") {
    open.setDate(open.getDate() - TATKAL_OPEN_DAYS_BEFORE);
    open.setHours(TATKAL_OPEN_HOUR, TATKAL_OPEN_MINUTE, 0, 0);
  } else {
    const cd = Number(customDaysInput.value || 0);
    open.setDate(open.getDate() - cd);
    open.setHours(NORMAL_OPEN_HOUR, NORMAL_OPEN_MINUTE, 0, 0);
  }

  return { journey: jd, open };
}

// click handler
calcBtn.addEventListener("click", () => {
  const ev = calculateEvent();
  if (!ev) {
    alert("Please select a journey date.");
    return;
  }
  currentEvent = ev;

  // fill booking card
  bookingOpenDateEl.textContent = formatISTDate(ev.open);
  bookingOpenTimeEl.textContent = `at ${formatTimeIST(ev.open)}`;
  bookingOnText.textContent = formatISTDateTime(ev.open);

  // show blocks
  noResult.style.display = "none";
  resultBlock.style.display = "block";

  // calendar links
  googleLink.href = makeGoogleUrl(ev);
  yahooLink.href = makeYahooUrl(ev);
  outlookLink.href = makeOutlookUrl(ev);
});

// Apple Calendar uses ICS download
appleBtn.addEventListener("click", () => {
  if (!currentEvent) return alert("Please calculate booking date first.");
  downloadICS(currentEvent);
});

// Download ICS button
icsBtn.addEventListener("click", () => {
  if (!currentEvent) return alert("Please calculate booking date first.");
  downloadICS(currentEvent);
});

// Phone calendar hint
phoneBtn.addEventListener("click", () => {
  if (!currentEvent) return alert("Please calculate booking date first.");
  alert("Download the .ICS file and open it on your phone to add to your calendar.");
});
