import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "../api";
import ConfirmDialog from "./ConfirmDialog";

function CalendarSection({ householdId, roommates, onHouseholdAccessError }) {
    const [events, setEvents] = useState([]);
    const [viewMode, setViewMode] = useState("calendar"); // calendar, upcoming, list
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [showEventForm, setShowEventForm] = useState(false);
    
    // Form states
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [eventType, setEventType] = useState("other");
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endDate, setEndDate] = useState("");
    const [endTime, setEndTime] = useState("");
    const [allDay, setAllDay] = useState(false);
    const [location, setLocation] = useState("");
    const [attendees, setAttendees] = useState([]);
    const [billAmount, setBillAmount] = useState("");
    
    const [editingEventId, setEditingEventId] = useState(null);
    const [error, setError] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [filterType, setFilterType] = useState("all");

    const fetchEvents = useCallback(async () => {
        try {
            const res = await apiGet(`/households/${householdId}/events`);
            setEvents(Array.isArray(res.data) ? res.data : []);
            setError("");
        } catch (err) {
            console.error(err);
            setError("Failed to load events");
            if (err.response?.status === 404) onHouseholdAccessError?.();
        }
    }, [householdId, onHouseholdAccessError]);

    useEffect(() => {
        async function loadEvents() {
            await fetchEvents();
        }
        loadEvents();
    }, [fetchEvents]);

    function resetForm() {
        setTitle("");
        setDescription("");
        setEventType("other");
        setStartDate("");
        setStartTime("");
        setEndDate("");
        setEndTime("");
        setAllDay(false);
        setLocation("");
        setAttendees([]);
        setBillAmount("");
        setEditingEventId(null);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        if (!title.trim() || !startDate) {
            setError("Title and start date are required");
            return;
        }

        // Combine date and time
        const start = allDay 
            ? new Date(startDate).toISOString()
            : new Date(`${startDate}T${startTime || "00:00"}`).toISOString();
        
        const end = endDate 
            ? (allDay 
                ? new Date(endDate).toISOString()
                : new Date(`${endDate}T${endTime || "23:59"}`).toISOString())
            : null;

        const eventData = {
            title: title.trim(),
            description: description.trim(),
            eventType,
            startDate: start,
            endDate: end,
            allDay,
            location: location.trim(),
            attendees,
            ...(eventType === 'bill' && billAmount && { billAmount: parseFloat(billAmount) })
        };

        try {
            if (editingEventId) {
                await apiPut(`/households/${householdId}/events/${editingEventId}`, eventData);
            } else {
                await apiPost(`/households/${householdId}/events`, eventData);
            }
            await fetchEvents();
            resetForm();
            setShowEventForm(false);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || "Failed to save event");
            if (err.response?.status === 404) onHouseholdAccessError?.();
        }
    }

    function handleEdit(event) {
        setEditingEventId(event._id);
        setTitle(event.title);
        setDescription(event.description || "");
        setEventType(event.eventType);
        
        const start = new Date(event.startDate);
        setStartDate(start.toISOString().split('T')[0]);
        setStartTime(start.toTimeString().slice(0, 5));
        
        if (event.endDate) {
            const end = new Date(event.endDate);
            setEndDate(end.toISOString().split('T')[0]);
            setEndTime(end.toTimeString().slice(0, 5));
        }
        
        setAllDay(event.allDay);
        setLocation(event.location || "");
        setAttendees(event.attendees?.map(a => a._id) || []);
        setBillAmount(event.billAmount || "");
        setShowEventForm(true);
    }

    async function handleDelete(id) {
        try {
            await apiDelete(`/households/${householdId}/events/${id}`);
            await fetchEvents();
            setConfirmDelete(null);
            setSelectedDate(null);
        } catch (err) {
            console.error(err);
            setError("Failed to delete event");
            if (err.response?.status === 404) onHouseholdAccessError?.();
        }
    }

    async function handleMarkPaid(id) {
        try {
            await apiPatch(`/households/${householdId}/events/${id}/pay`);
            await fetchEvents();
        } catch (err) {
            console.error(err);
            setError("Failed to mark bill as paid");
            if (err.response?.status === 404) onHouseholdAccessError?.();
        }
    }

    function toggleAttendee(roommateId) {
        setAttendees(prev => 
            prev.includes(roommateId)
                ? prev.filter(id => id !== roommateId)
                : [...prev, roommateId]
        );
    }

    // Calendar helper functions
    function getDaysInMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }

    function getFirstDayOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    }

    function navigateMonth(direction) {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + direction);
            return newDate;
        });
    }

    function goToToday() {
        setCurrentDate(new Date());
    }

    function isSameDay(date1, date2) {
        return date1.getDate() === date2.getDate() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getFullYear() === date2.getFullYear();
    }

    function isToday(date) {
        return isSameDay(date, new Date());
    }

    function getEventsForDate(date) {
        return events.filter(event => {
            const eventStart = new Date(event.startDate);
            const eventEnd = event.endDate ? new Date(event.endDate) : eventStart;
            
            // Check if the date falls within the event range
            const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const startOfEvent = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
            const endOfEvent = new Date(eventEnd.getFullYear(), eventEnd.getMonth(), eventEnd.getDate());
            
            return checkDate >= startOfEvent && checkDate <= endOfEvent;
        });
    }

    function handleDateClick(date) {
        // If clicking the same date again, open the add event form
        if (selectedDate && isSameDay(date, selectedDate)) {
            handleAddEventOnDate(date);
        } else {
            setSelectedDate(date);
        }
    }

    function handleAddEventOnDate(date) {
        resetForm();
        const dateStr = date.toISOString().split('T')[0];
        setStartDate(dateStr);
        setShowEventForm(true);
    }

    function handleDoubleClick(date) {
        handleAddEventOnDate(date);
    }

    // Filter and sort events
    const filteredEvents = events
        .filter(event => filterType === "all" || event.eventType === filterType)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    const upcomingEvents = filteredEvents.filter(
        event => new Date(event.startDate) >= new Date()
    ).slice(0, 10);

    const unpaidBills = events.filter(
        event => event.eventType === 'bill' && !event.isPaid
    );

    const eventTypeLabels = {
        party: "🎉 Party",
        guest: "👥 Guest",
        maintenance: "🔧 Maintenance",
        bill: "💰 Bill",
        other: "📅 Other"
    };

    const eventTypeColors = {
        party: "#9b59b6",
        guest: "#3498db",
        maintenance: "#e67e22",
        bill: "#e74c3c",
        other: "#95a5a6"
    };

    function formatDateTime(dateStr, isAllDay) {
        const date = new Date(dateStr);
        if (isAllDay) {
            return date.toLocaleDateString();
        }
        return date.toLocaleString([], { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // Generate calendar grid
    function renderCalendarGrid() {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const totalCells = 42; // Always show 6 rows (6 * 7 = 42)

        // Empty cells for days before the first day of the month
        for (let i = 0; i < firstDay; i++) {
            days.push(
                <div key={`empty-start-${i}`} className="calendar-day empty"></div>
            );
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dayEvents = getEventsForDate(date);
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isTodayDate = isToday(date);

            days.push(
                <div
                    key={day}
                    className={`calendar-day ${isTodayDate ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
                    onClick={() => handleDateClick(date)}
                    onDoubleClick={() => handleDoubleClick(date)}
                >
                    <span className="day-number">{day}</span>
                    {dayEvents.length > 0 && (
                        <div className="day-events">
                            {dayEvents.slice(0, 3).map((event) => (
                                <div
                                    key={event._id}
                                    className="day-event-dot"
                                    style={{ backgroundColor: eventTypeColors[event.eventType] }}
                                    title={event.title}
                                />
                            ))}
                            {dayEvents.length > 3 && (
                                <span className="more-events">+{dayEvents.length - 3}</span>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        // Empty cells for remaining days to complete 6 rows
        const remainingCells = totalCells - days.length;
        for (let i = 0; i < remainingCells; i++) {
            days.push(
                <div key={`empty-end-${i}`} className="calendar-day empty"></div>
            );
        }

        return (
            <div className="calendar-container">
                <div className="calendar-header">
                    <button onClick={() => navigateMonth(-1)} className="btn-icon">
                        ◀
                    </button>
                    <h3 className="calendar-title">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h3>
                    <button onClick={() => navigateMonth(1)} className="btn-icon">
                        ▶
                    </button>
                    <button onClick={goToToday} className="btn-secondary btn-sm" style={{ marginLeft: '1rem' }}>
                        Today
                    </button>
                </div>
                <div className="calendar-weekdays">
                    {weekDays.map(day => (
                        <div key={day} className="weekday">{day}</div>
                    ))}
                </div>
                <div className="calendar-grid">
                    {days}
                </div>
            </div>
        );
    }

    // Render selected date events
    function renderSelectedDateEvents() {
        if (!selectedDate) return null;

        const dayEvents = getEventsForDate(selectedDate);
        
        return (
            <div className="selected-date-panel">
                <div className="selected-date-header">
                    <h3>
                        {selectedDate.toLocaleDateString('default', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric' 
                        })}
                    </h3>
                    <button 
                        onClick={() => handleAddEventOnDate(selectedDate)}
                        className="btn-primary btn-sm"
                    >
                        + Add Event
                    </button>
                </div>

                {dayEvents.length === 0 ? (
                    <p className="empty-state">No events on this day</p>
                ) : (
                    <div className="events-list">
                        {dayEvents.map(event => (
                            <div 
                                key={event._id} 
                                className="event-card compact"
                                style={{ borderLeftColor: eventTypeColors[event.eventType] }}
                            >
                                <div className="event-header">
                                    <div>
                                        <span 
                                            className="event-type-badge small" 
                                            style={{ backgroundColor: eventTypeColors[event.eventType] }}
                                        >
                                            {eventTypeLabels[event.eventType]}
                                        </span>
                                        <h4 style={{ margin: '0.25rem 0' }}>{event.title}</h4>
                                        {!event.allDay && (
                                            <span className="event-time">
                                                {new Date(event.startDate).toLocaleTimeString([], { 
                                                    hour: '2-digit', 
                                                    minute: '2-digit' 
                                                })}
                                            </span>
                                        )}
                                    </div>
                                    <div className="event-actions">
                                        <button
                                            onClick={() => handleEdit(event)}
                                            className="btn-sm btn-secondary"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(event)}
                                            className="btn-sm btn-danger"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                {event.eventType === 'bill' && event.billAmount && (
                                    <div className="event-bill-info">
                                        <span>${event.billAmount.toFixed(2)}</span>
                                        {!event.isPaid ? (
                                            <button
                                                onClick={() => handleMarkPaid(event._id)}
                                                className="btn-sm btn-success"
                                            >
                                                Mark Paid
                                            </button>
                                        ) : (
                                            <span className="badge badge-success">✓ Paid</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // Render event form modal
    function renderEventForm() {
        if (!showEventForm) return null;

        return (
            <div className="modal-overlay" onClick={() => { setShowEventForm(false); resetForm(); }}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>{editingEventId ? "Edit Event" : "Add New Event"}</h3>
                        <button 
                            onClick={() => { setShowEventForm(false); resetForm(); }}
                            className="modal-close"
                        >
                            ×
                        </button>
                    </div>
                    
                    {error && <div className="alert alert-error">{error}</div>}
                    
                    <form onSubmit={handleSubmit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Title *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Event title"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Type</label>
                                <select value={eventType} onChange={(e) => setEventType(e.target.value)}>
                                    <option value="other">Other</option>
                                    <option value="party">Party</option>
                                    <option value="guest">Guest Visit</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="bill">Bill Due Date</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Event description (optional)"
                                rows={2}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Start Date *</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    required
                                />
                            </div>

                            {!allDay && (
                                <div className="form-group">
                                    <label>Start Time</label>
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>

                            {!allDay && endDate && (
                                <div className="form-group">
                                    <label>End Time</label>
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={allDay}
                                    onChange={(e) => setAllDay(e.target.checked)}
                                />
                                All day event
                            </label>
                        </div>

                        <div className="form-group">
                            <label>Location</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Event location (optional)"
                            />
                        </div>

                        {eventType === 'bill' && (
                            <div className="form-group">
                                <label>Bill Amount ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={billAmount}
                                    onChange={(e) => setBillAmount(e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Attendees/Involved Roommates</label>
                            <div className="roommate-chips">
                                {roommates.map(rm => (
                                    <button
                                        key={rm._id}
                                        type="button"
                                        onClick={() => toggleAttendee(rm._id)}
                                        className={attendees.includes(rm._id) ? "chip chip-selected" : "chip"}
                                        style={{
                                            backgroundColor: attendees.includes(rm._id) ? "var(--primary)" : "transparent",
                                            borderColor: "var(--primary)",
                                            color: attendees.includes(rm._id) ? "#fff" : "var(--primary)"
                                        }}
                                    >
                                        {rm.displayName || rm.email?.split("@")[0] || "Roommate"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-primary">
                                {editingEventId ? "Update Event" : "Add Event"}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowEventForm(false); resetForm(); }}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="section">
            <div className="calendar-section-header">
                <h2>📅 Calendar & Events</h2>
                <div className="view-toggle">
                    <button
                        onClick={() => setViewMode("calendar")}
                        className={`view-toggle-btn ${viewMode === "calendar" ? "active" : ""}`}
                    >
                        <span className="view-icon">🗓️</span>
                        <span className="view-label">Calendar</span>
                    </button>
                    <button
                        onClick={() => setViewMode("upcoming")}
                        className={`view-toggle-btn ${viewMode === "upcoming" ? "active" : ""}`}
                    >
                        <span className="view-icon">⏰</span>
                        <span className="view-label">Upcoming</span>
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`view-toggle-btn ${viewMode === "list" ? "active" : ""}`}
                    >
                        <span className="view-icon">📋</span>
                        <span className="view-label">All Events</span>
                    </button>
                </div>
            </div>

            {/* Unpaid Bills Alert */}
            {unpaidBills.length > 0 && (
                <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                    <strong>⚠️ {unpaidBills.length} unpaid bill(s)</strong>
                    <ul style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                        {unpaidBills.map(bill => (
                            <li key={bill._id}>
                                {bill.title} - ${bill.billAmount} (Due: {formatDateTime(bill.startDate, bill.allDay)})
                                <button
                                    onClick={() => handleMarkPaid(bill._id)}
                                    className="btn-sm btn-success"
                                    style={{ marginLeft: '0.5rem' }}
                                >
                                    Mark Paid
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Calendar View */}
            {viewMode === "calendar" && (
                <div className="calendar-view">
                    {renderCalendarGrid()}
                    {renderSelectedDateEvents()}
                </div>
            )}

            {/* Upcoming/List View */}
            {(viewMode === "upcoming" || viewMode === "list") && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3>{viewMode === "upcoming" ? "Upcoming Events" : "All Events"}</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <select 
                                value={filterType} 
                                onChange={(e) => setFilterType(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Types</option>
                                <option value="party">Parties</option>
                                <option value="guest">Guests</option>
                                <option value="maintenance">Maintenance</option>
                                <option value="bill">Bills</option>
                                <option value="other">Other</option>
                            </select>
                            <button 
                                onClick={() => { resetForm(); setShowEventForm(true); }}
                                className="btn-primary"
                            >
                                + Add Event
                            </button>
                        </div>
                    </div>

                    {(viewMode === "upcoming" ? upcomingEvents : filteredEvents).length === 0 ? (
                        <p className="empty-state">No events found. Add your first event! 📅</p>
                    ) : (
                        <div className="events-list">
                            {(viewMode === "upcoming" ? upcomingEvents : filteredEvents).map(event => (
                                <div 
                                    key={event._id} 
                                    className="event-card"
                                    style={{ borderLeftColor: eventTypeColors[event.eventType] }}
                                >
                                    <div className="event-header">
                                        <div>
                                            <span className="event-type-badge" style={{ backgroundColor: eventTypeColors[event.eventType] }}>
                                                {eventTypeLabels[event.eventType]}
                                            </span>
                                            <h4 style={{ margin: '0.25rem 0' }}>{event.title}</h4>
                                        </div>
                                        <div className="event-actions">
                                            <button
                                                onClick={() => handleEdit(event)}
                                                className="btn-sm btn-secondary"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => setConfirmDelete(event)}
                                                className="btn-sm btn-danger"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>

                                    <div className="event-details">
                                        <p><strong>📅 When:</strong> {formatDateTime(event.startDate, event.allDay)}
                                            {event.endDate && ` - ${formatDateTime(event.endDate, event.allDay)}`}
                                        </p>
                                        
                                        {event.location && (
                                            <p><strong>📍 Where:</strong> {event.location}</p>
                                        )}
                                        
                                        {event.description && (
                                            <p><strong>📝 Details:</strong> {event.description}</p>
                                        )}
                                        
                                        {event.eventType === 'bill' && event.billAmount && (
                                            <p>
                                                <strong>💰 Amount:</strong> ${event.billAmount.toFixed(2)}
                                                {event.isPaid ? (
                                                    <span className="badge badge-success" style={{ marginLeft: '0.5rem' }}>✓ Paid</span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleMarkPaid(event._id)}
                                                        className="btn-sm btn-success"
                                                        style={{ marginLeft: '0.5rem' }}
                                                    >
                                                        Mark Paid
                                                    </button>
                                                )}
                                            </p>
                                        )}
                                        
                                        {event.attendees && event.attendees.length > 0 && (
                                            <p>
                                                <strong>👥 Attendees:</strong>{' '}
                                                {event.attendees.map((a, idx) => (
                                                    <span key={a._id}>
                                                        <span style={{ fontWeight: 'bold' }}>
                                                            {a.displayName || a.email?.split("@")[0] || "Roommate"}
                                                        </span>
                                                        {idx < event.attendees.length - 1 ? ', ' : ''}
                                                    </span>
                                                ))}
                                            </p>
                                        )}
                                        
                                        <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                            Created by {event.createdBy?.displayName || 'Unknown'}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Event Form Modal */}
            {renderEventForm()}

            {confirmDelete && (
                <ConfirmDialog
                    message={`Are you sure you want to delete "${confirmDelete.title}"?`}
                    onConfirm={() => handleDelete(confirmDelete._id)}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}
        </div>
    );
}

export default CalendarSection;
