
import React, { useEffect, useMemo, useState } from "react";
import "./styles.css";

const SCHOOL_NAME = "Becket Keys School";
const ALLOWED_DOMAIN = "@becketkeys.org";
const ADMIN_EMAILS = ["p.romhany@becketkeys.org"];
const COURT = "Court 1";

const SLOT_DEFS = [
  { label: "07:00–07:30", session: "Morning" },
  { label: "07:30–08:00", session: "Morning" },
  { label: "15:30–16:00", session: "After school" },
  { label: "16:00–16:30", session: "After school" },
  { label: "16:30–17:00", session: "After school" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

function envReady() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

async function api(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export default function App() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [player3, setPlayer3] = useState("");
  const [player4, setPlayer4] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(dateKey(nextSchoolDays(1)[0]));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("book");

  const schoolDays = useMemo(() => nextSchoolDays(10), []);
  const isAdmin = loggedInUser && ADMIN_EMAILS.includes(loggedInUser.email.toLowerCase());

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    if (!envReady()) {
      setMessage("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.");
      return;
    }
    setLoading(true);
    try {
      const data = await api("bookings?select=*&order=date.asc&order=slot.asc");
      setBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(`Could not load shared bookings: ${cleanError(error)}`);
    } finally {
      setLoading(false);
    }
  }

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

  async function addBooking(slot, court) {
    if (!loggedInUser) return;
    if (!envReady()) {
      return setMessage("Supabase environment variables are missing in Vercel.");
    }

    const players = [player1, player2, player3, player4]
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 4);

    if (players.length < 2) {
      return setMessage("Please add at least one other member of staff so we can track who is playing.");
    }

    if (bookings.some((b) => b.date === selectedDate && b.slot === slot && b.email === loggedInUser.email)) {
      return setMessage("You already have a booking in that slot.");
    }

    if (bookingOwner(selectedDate, slot, court)) {
      return setMessage("That court is already booked.");
    }

    setLoading(true);
    try {
      // Re-check against the shared database to help prevent double booking.
      const existing = await api(
        `bookings?select=id&date=eq.${encodeURIComponent(selectedDate)}&slot=eq.${encodeURIComponent(slot)}&court=eq.${encodeURIComponent(court)}`
      );

      if (Array.isArray(existing) && existing.length > 0) {
        await loadBookings();
        return setMessage("That court has just been booked by someone else.");
      }

      const payload = {
        id: crypto.randomUUID(),
        email: loggedInUser.email,
        name: loggedInUser.name,
        players,
        date: selectedDate,
        slot,
        court,
      };

      const inserted = await api("bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setBookings((prev) => [...prev, ...(inserted || [])].sort(sortBookings));
      setMessage(`Booked ${court} for ${slot}.`);
    } catch (error) {
      setMessage(`Booking failed: ${cleanError(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(id) {
    if (!envReady()) {
      return setMessage("Supabase environment variables are missing in Vercel.");
    }
    setLoading(true);
    try {
      await api(`bookings?id=eq.${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setBookings((prev) => prev.filter((b) => b.id !== id));
      setMessage("Booking cancelled.");
    } catch (error) {
      setMessage(`Cancellation failed: ${cleanError(error)}`);
    } finally {
      setLoading(false);
    }
  }

  const myBookings = loggedInUser
    ? bookings
        .filter((b) => b.email === loggedInUser.email)
        .sort(sortBookings)
    : [];

  const allBookingsSorted = [...bookings].sort(sortBookings);

  return (
    <div className="page">
      <div className="wrap">
        <div className="hero-grid">
          <section className="card">
            <div className="hero-head">
              <div className="logo-box">BK</div>
              <div>
                <h1>{SCHOOL_NAME} Padel Booking</h1>
                <p>Shared staff booking system for morning and after-school court use.</p>
              </div>
            </div>
            <div className="info-grid">
              <InfoTile title="Bookable times" value="07:00–08:00 and 15:30–17:00" />
              <InfoTile title="Access" value={`Restricted to ${ALLOWED_DOMAIN}`} />
              <InfoTile title="Court" value={COURT} />
            </div>
          </section>

          <section className="card">
            <h2>Staff sign in</h2>
            <p className="muted">Shared version using Supabase for bookings.</p>
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
        {loading && <div className="notice">Working…</div>}

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
                    const owner = bookingOwner(selectedDate, slot.label, COURT);
                    const mine = owner?.email === loggedInUser?.email;
                    return (
                      <div key={slot.label} className="slot-box">
                        <div className="slot-head">
                          <div>
                            <div className="strong">{slot.label}</div>
                            <div className="small">{COURT}</div>
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
                          <button className="button primary" disabled={!loggedInUser || loading} onClick={() => addBooking(slot.label, COURT)}>
                            Book {COURT}
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

function sortBookings(a, b) {
  return `${a.date} ${a.slot} ${a.court}`.localeCompare(`${b.date} ${b.slot} ${b.court}`);
}

function cleanError(error) {
  try {
    const text = typeof error?.message === "string" ? error.message : String(error);
    return text.slice(0, 180);
  } catch {
    return "Unknown error";
  }
}

function InfoTile({ title, value }) {
  return (
    <div className="tile">
      <div className="small muted">{title}</div>
      <div className="strong">{value}</div>
    </div>
  );
}

