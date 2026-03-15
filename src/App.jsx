
import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

const SCHOOL_NAME = "Becket Keys School";
const ALLOWED_DOMAIN = "@becketkeys.org";
const ADMIN_EMAILS = ["p.romhany@becketkeys.org"];
const STORAGE_KEY = "becket_keys_padel_bookings_v1";

const SLOT_DEFS = [
  { label: "07:00–07:30", session: "Morning" },
  { label: "07:30–08:00", session: "Morning" },
  { label: "15:30–16:00", session: "After school" },
  { label: "16:00–16:30", session: "After school" },
  { label: "16:30–17:00", session: "After school" },
];

function nextSchoolDays(count = 10) {
  const out = [];
  const current = new Date();
  current.setHours(12, 0, 0, 0);
  let offset = 0;
  while (out.length < count) {
    const candidate = new Date(current);
    candidate.setDate(current.getDate() + offset);
    const day = candidate.getDay();
    if (day !== 0 && day !== 6) out.push(candidate);
    offset += 1;
  }
  return out;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const seedBookings = [
  {
    id: "seed-1",
    email: "teacher1@becketkeys.org",
    name: "A. Teacher",
    players: ["A. Teacher", "B. Teacher"],
    date: dateKey(nextSchoolDays(1)[0]),
    slot: "07:00–07:30",
    court: "Court 1",
  },
];

export default function App() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [player3, setPlayer3] = useState("");
  const [player4, setPlayer4] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [bookings, setBookings] = useState(seedBookings);
  const [selectedDate, setSelectedDate] = useState(dateKey(nextSchoolDays(1)[0]));
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("book");

  const schoolDays = useMemo(() => nextSchoolDays(10), []);
  const isAdmin = loggedInUser && ADMIN_EMAILS.includes(loggedInUser.email.toLowerCase());

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setBookings(parsed);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
  }, [bookings]);

  function login() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanName) return setMessage("Please enter your name.");
    if (!cleanEmail) return setMessage("Please enter your school email.");
    if (!cleanEmail.endsWith(ALLOWED_DOMAIN)) {
      return setMessage(`Only ${SCHOOL_NAME} staff can log in.`);
    }
    setLoggedInUser({ email: cleanEmail, name: cleanName });
    setPlayer1(cleanName);
    setPlayer2("");
    setPlayer3("");
    setPlayer4("");
    setMessage("Signed in successfully.");
  }

  function logout() {
    setLoggedInUser(null);
    setPlayer1("");
    setPlayer2("");
    setPlayer3("");
    setPlayer4("");
    setMessage("Signed out.");
  }

  function bookingOwner(date, slot, court) {
    return bookings.find((b) => b.date === date && b.slot === slot && b.court === court);
  }

  function addBooking(slot, court) {
    if (!loggedInUser) return;
    if (bookings.some((b) => b.date === selectedDate && b.slot === slot && b.email === loggedInUser.email)) {
      return setMessage("You already have a booking in that slot.");
    }
    if (bookingOwner(selectedDate, slot, court)) {
      return setMessage("That court is already booked.");
    }
    const players = [player1, player2, player3, player4].map((p) => p.trim()).filter(Boolean).slice(0, 4);
    if (players.length < 2) {
      return setMessage("Please add at least one other member of staff so we can track who is playing.");
    }
    const next = [
      ...bookings,
      {
        id: crypto.randomUUID(),
        email: loggedInUser.email,
        name: loggedInUser.name,
        players,
        date: selectedDate,
        slot,
        court,
      },
    ];
    setBookings(next);
    setMessage(`Booked ${court} for ${slot}.`);
  }

  function cancelBooking(id) {
    setBookings((prev) => prev.filter((b) => b.id !== id));
    setMessage("Booking cancelled.");
  }

  const myBookings = loggedInUser
    ? bookings
        .filter((b) => b.email === loggedInUser.email)
        .sort((a, b) => `${a.date} ${a.slot}`.localeCompare(`${b.date} ${b.slot}`))
    : [];

  const allBookingsSorted = [...bookings].sort((a, b) =>
    `${a.date} ${a.slot} ${a.court}`.localeCompare(`${b.date} ${b.slot} ${b.court}`)
  );

  return (
    <div className="page">
      <div className="wrap">
        <div className="hero-grid">
          <section className="card">
            <div className="hero-head">
              <div className="logo-box">BK</div>
              <div>
                <h1>{SCHOOL_NAME} Padel Booking</h1>
                <p>Staff-only web booking app for morning and after-school court use.</p>
              </div>
            </div>
            <div className="info-grid">
              <InfoTile title="Bookable times" value="07:00–08:00 and 15:30–17:00" />
              <InfoTile title="Access" value={`Restricted to ${ALLOWED_DOMAIN}`} />
              <InfoTile title="Courts" value="Court 1" />
            </div>
          </section>

          <section className="card">
            <h2>Staff sign in</h2>
            <p className="muted">This trial version uses email-domain restriction.</p>
            {!loggedInUser ? (
              <>
                <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="input" placeholder={`School email, e.g. staff${ALLOWED_DOMAIN}`} value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="button primary" onClick={login}>Sign in</button>
              </>
            ) : (
              <>
                <div className="panel">
                  <div className="strong">{loggedInUser.name}</div>
                  <div className="muted">{loggedInUser.email}</div>
                  <div className="badge-row">
                    <span className="badge">{isAdmin ? "Admin" : "Staff"}</span>
                  </div>
                </div>
                <button className="button" onClick={logout}>Sign out</button>
              </>
            )}
          </section>
        </div>

        {message && <div className="alert">{message}</div>}

        <div className="tabs">
          <button className={tab === "book" ? "tab active" : "tab"} onClick={() => setTab("book")}>Book</button>
          <button className={tab === "mine" ? "tab active" : "tab"} onClick={() => setTab("mine")}>My bookings</button>
          <button className={tab === "admin" ? "tab active" : "tab"} onClick={() => setTab("admin")}>Admin</button>
        </div>

        {tab === "book" && (
          <section className="card">
            <h2>Book the court</h2>
            <p className="muted">Select a school day, choose any available slot, and add the staff names for everyone playing.</p>

            <div className="date-grid">
              {schoolDays.map((d) => {
                const key = dateKey(d);
                const active = selectedDate === key;
                return (
                  <button key={key} className={active ? "date-card active" : "date-card"} onClick={() => setSelectedDate(key)}>
                    <div className="strong">{formatDate(d)}</div>
                    <div className="small">{key}</div>
                  </button>
                );
              })}
            </div>

            {!loggedInUser && <div className="notice">Sign in required before making a booking.</div>}

            {loggedInUser && (
              <div className="card inset">
                <h3>Players</h3>
                <p className="muted">The member of staff booking must add at least one other member of staff. You can list up to four staff names in total.</p>
                <div className="player-grid">
                  <input className="input" placeholder="Player 1" value={player1} disabled />
                  <input className="input" placeholder="Other staff member" value={player2} onChange={(e) => setPlayer2(e.target.value)} />
                  <input className="input" placeholder="Other staff member" value={player3} onChange={(e) => setPlayer3(e.target.value)} />
                  <input className="input" placeholder="Other staff member" value={player4} onChange={(e) => setPlayer4(e.target.value)} />
                </div>
              </div>
            )}

            <div className="session-grid">
              {["Morning", "After school"].map((session) => (
                <div key={session} className="card inset">
                  <h3>{session}</h3>
                  <p className="muted">{session === "Morning" ? "Before school: 07:00–08:00" : "After school: 15:30–17:00"}</p>
                  {SLOT_DEFS.filter((s) => s.session === session).map((slot) => {
                    const owner = bookingOwner(selectedDate, slot.label, "Court 1");
                    const mine = owner?.email === loggedInUser?.email;
                    return (
                      <div key={slot.label} className="slot-box">
                        <div className="slot-head">
                          <div>
                            <div className="strong">{slot.label}</div>
                            <div className="small">Court 1</div>
                          </div>
                          <span className="badge secondary">{owner ? "Booked" : "Available"}</span>
                        </div>

                        {owner ? (
                          <div className="slot-body">
                            <div>{owner.name}</div>
                            {owner.players?.length ? <div className="small">Players: {owner.players.join(", ")}</div> : null}
                            {mine ? (
                              <button className="button" onClick={() => cancelBooking(owner.id)}>Cancel my booking</button>
                            ) : (
                              <div className="unavailable">Unavailable</div>
                            )}
                          </div>
                        ) : (
                          <button className="button primary" disabled={!loggedInUser} onClick={() => addBooking(slot.label, "Court 1")}>
                            Book Court 1
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === "mine" && (
          <section className="card">
            <h2>My bookings</h2>
            {!loggedInUser ? (
              <p className="muted">Sign in to view your bookings.</p>
            ) : myBookings.length === 0 ? (
              <p className="muted">You do not have any bookings yet.</p>
            ) : (
              <div className="stack">
                {myBookings.map((booking) => (
                  <div key={booking.id} className="list-row">
                    <div>
                      <div className="strong">{booking.court} • {booking.slot}</div>
                      <div className="small">{booking.date} • {booking.name}</div>
                      <div className="small">Players: {booking.players.join(", ")}</div>
                    </div>
                    <button className="button" onClick={() => cancelBooking(booking.id)}>Cancel</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "admin" && (
          <section className="card">
            <h2>Admin overview</h2>
            {!loggedInUser ? (
              <p className="muted">Sign in to continue.</p>
            ) : !isAdmin ? (
              <div className="notice">Admin only.</div>
            ) : (
              <>
                <h3>Booking list</h3>
                <div className="stack">
                  {allBookingsSorted.map((booking) => (
                    <div key={booking.id} className="list-row">
                      <div>
                        <div className="strong">{booking.date} • {booking.slot} • {booking.court}</div>
                        <div className="small">{booking.name} • {booking.email}</div>
                        <div className="small">Players: {booking.players.join(", ")}</div>
                      </div>
                      <button className="button" onClick={() => cancelBooking(booking.id)}>Remove booking</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function InfoTile({ title, value }) {
  return (
    <div className="tile">
      <div className="small muted">{title}</div>
      <div className="strong">{value}</div>
    </div>
  );
}
