import React, { useState, useEffect, useRef } from "react";

interface DatePickerProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  minDate?: string;
}

const CustomDatePicker: React.FC<DatePickerProps> = ({ selectedDate, setSelectedDate, minDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayDate, setDisplayDate] = useState<string>("");
  const dateInputRef = useRef<HTMLDivElement>(null);

  // Convert selected date to formatted date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "America/New_York",
    });
  };

  // Update display date whenever selectedDate changes
  useEffect(() => {
    setDisplayDate(formatDate(selectedDate));
  }, [selectedDate]);

  // Function to handle date selection
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = event.target.value;
    setSelectedDate(newDate); // Update state
    setDisplayDate(formatDate(newDate)); // Update formatted display
    setIsOpen(false); // Close calendar
  };

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dateInputRef.current && !dateInputRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dateInputRef} className="relative w-full">
      {/* Date Picker Input */}
      <div
        className="cursor-pointer w-full rounded border-[1.5px] border-stroke px-5 py-3 bg-white dark:bg-gray-800 text-black dark:text-white transition focus:border-primary active:border-primary"
        onClick={() => setIsOpen(!isOpen)}
      >
        {displayDate}
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded shadow-lg p-2 border border-stroke z-50">
          <input
            type="date"
            value={selectedDate}
            min={minDate || new Date().toISOString().split("T")[0]} // Default to today
            onChange={handleDateChange}
            className="w-full border rounded px-3 py-2 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring focus:border-primary"
          />
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
