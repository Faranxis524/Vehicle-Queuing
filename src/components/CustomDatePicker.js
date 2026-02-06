import React, { useEffect, useRef, useState } from 'react';

/**
 * Small reusable date picker used by PO create/edit forms.
 *
 * Props:
 * - value: YYYY-MM-DD string or ''
 * - onChange: (eventLike) => void; expects { target: { value: 'YYYY-MM-DD' } }
 * - min: YYYY-MM-DD string (optional)
 * - className: string (optional)
 */
const CustomDatePicker = ({ value, onChange, min, className }) => {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const datePickerRef = useRef(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize current month to selected date or today
  useEffect(() => {
    if (value) {
      setCurrentMonth(new Date(value));
    } else {
      setCurrentMonth(new Date());
    }
  }, [value]);

  const formatDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (dateString) => {
    if (!dateString) return null;
    return new Date(dateString);
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
    return days;
  };

  const isDateDisabled = (date) => {
    if (!min) return false;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return dateStr < min;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    if (!value) return false;
    const selectedDate = parseDate(value);
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  const handleDateClick = (date) => {
    if (isDateDisabled(date)) return;
    onChange({ target: { value: formatDate(date) } });
    setShowCalendar(false);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="custom-date-picker" ref={datePickerRef}>
      <div className="date-input-wrapper">
        <input
          type="text"
          value={value ? new Date(value).toLocaleDateString() : ''}
          onClick={() => setShowCalendar(!showCalendar)}
          readOnly
          className={className}
          placeholder="Select date"
        />
        {value && (
          <button
            type="button"
            className="clear-date-btn"
            title="Clear date"
            aria-label="Clear delivery date"
            onClick={(e) => {
              e.stopPropagation();
              onChange({ target: { value: '' } });
              setShowCalendar(false);
            }}
          >
            ×
          </button>
        )}
      </div>

      {showCalendar && (
        <div className="custom-calendar">
          <div className="calendar-header">
            <button type="button" onClick={handlePrevMonth} className="calendar-nav-btn">‹</button>
            <span className="calendar-month-year">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button type="button" onClick={handleNextMonth} className="calendar-nav-btn">›</button>
          </div>
          <div className="calendar-weekdays">
            {dayNames.map(day => (
              <div key={day} className="calendar-weekday">{day}</div>
            ))}
          </div>
          <div className="calendar-days">
            {getDaysInMonth(currentMonth).map((date, index) => (
              <div
                key={index}
                className={`calendar-day ${
                  !date ? 'empty' :
                    isDateDisabled(date) ? 'disabled' :
                      isSelected(date) ? 'selected' :
                        isToday(date) ? 'today' : ''
                }`}
                onClick={() => date && handleDateClick(date)}
              >
                {date ? date.getDate() : ''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
