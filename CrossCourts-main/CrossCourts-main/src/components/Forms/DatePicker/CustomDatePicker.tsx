import React, { useState, useEffect, useRef } from "react";

interface DatePickerProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  minDate?: string;
}

const CustomDatePicker: React.FC<DatePickerProps> = ({ selectedDate, setSelectedDate, minDate }) => {
  const [displayDate, setDisplayDate] = useState<string>("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Format date for display
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });
  };

  // Update formatted date whenever `selectedDate` changes
  useEffect(() => {
    setDisplayDate(formatDate(selectedDate));
  }, [selectedDate]);

  // Handle date selection
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;
    setSelectedDate(newDate);
    setDisplayDate(formatDate(newDate));
  };

  // Programmatically open date picker when clicking the display div
  const openCalendar = () => {
    if (dateInputRef.current) {
      dateInputRef.current.showPicker();
    }
  };

  return (
    <div className="relative w-full">
      {/* Date Picker Display (Clicking this will open the calendar) */}
      <button
        className="form-datepicker text-start  w-full capitalize rounded border-[1.5px] border-stroke bg-transparent px-3 py-3 font-normal outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
        onClick={openCalendar}
      >
        {displayDate}
      </button>

      {/* Hidden Native Date Input (Triggers the calendar directly) */}
      <input
        type="date"
        ref={dateInputRef}
        value={selectedDate}
        min={minDate || new Date().toISOString().split("T")[0]} // Prevent past selection
        onChange={handleDateChange}
        className="absolute opacity-0  left-0 h-0 bottom-0"
      />
    </div>
  );
};

export default CustomDatePicker;
