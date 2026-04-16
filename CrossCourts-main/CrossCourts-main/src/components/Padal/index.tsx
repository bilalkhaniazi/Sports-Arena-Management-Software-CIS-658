import React, { useState, useEffect } from 'react';
import { FaCalendarAlt } from 'react-icons/fa';
import Modal from '../../components/Modal';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CustomDatePicker from '../Forms/DatePicker/CustomDatePicker';
import { toast } from "react-toastify";
import {
  fetchCourtsByCategory,
  fetchSlotForbooking,
  bookSlot,
  editBooking,
  deleteBooking 
} from '../../api/courtService';
import HolidayDayBanner from '../HolidayDayBanner';
import { addOneCalendarDay } from '../../utils/bookingDates';

// Types for Slots, Courts, and Booking Data
type BookingDetails = {
  name: string;
  phone: string;
  email: string;
  online_price: number;
  cash_price: number;
  add_on: string;
  add_on_price: number;
};

type Slot = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  booked: number;
  booking_id: number;
  booking_details?: BookingDetails; 
};

type Court = {
  id: number;
  name: string;
};

type BookingData = {
  court_id: number;
  start_time: string;
  end_time: string;
  name: string;
  phone: string;
  email: string;
  online_price: number;
  cash_price: number;
  add_on: string;
  add_on_price: number;
  booking_date: string;
};

type SelectedSlotType = {
  start_time: string;
  end_time: string;
};

type SelectedSlotDelete = {
  id: number;
  start_time: string;
  end_time: string;
};

type FormDataType = {
  name: string;
  phone: string;
  email: string;
  online_price: number;
  cash_price: number;
  add_on: string;
  add_on_price: number;
};

const Padel: React.FC = () => {
  const [selectedCourt, setSelectedCourt] = useState<number>(5);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
 
  const [isOTPModalOpen, setIsOTPModalOpen] = useState<boolean>(false);
  const [otpValue, setOtpValue] = useState<string>("");
  const [otpBookingId, setOtpBookingId] = useState<number | null>(null);
  
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
  );
  const [formattedDate, setFormattedDate] = useState<string>('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [findingNextOpen, setFindingNextOpen] = useState(false);
  const queryClient = useQueryClient();

  const [selectedSlot, setSelectedSlot] = useState<SelectedSlotType>({
    start_time: "",
    end_time: "",
  });
 

  // NEW: State for booking form
  const [formData, setFormData] = useState<FormDataType>({
    name: "",
    phone: "",
    email: "",
    online_price: 0,
    cash_price: 0,
    add_on: "",
    add_on_price: 0,
  });

  // NEW: Edit Booking State
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [selectedEditSlot, setSelectedEditSlot] = useState<SelectedSlotDelete>({
    id: 0,
    start_time: "",
    end_time: "",
  });
  const [editFormData, setEditFormData] = useState<FormDataType>({
    name: "",
    phone: "",
    email: "",
    online_price: 0,
    cash_price: 0,
    add_on: "",
    add_on_price: 0,
  });

  useEffect(() => {
    setFormattedDate(
      new Date(selectedDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/New_York',
      }),
    );
  }, [selectedDate]);

  // Fetch courts
  const { data: courts, error: isCourtError, isLoading: isCourtLoading } = useQuery<Court[]>({
    queryKey: ['courts', 3], // cat_id = 1 for Cricket
    queryFn: () => fetchCourtsByCategory(3),
  });

  // Fetch slots
  const { data: slotsData, isLoading: isSlotLoading, error: isSlotError } = useQuery<{
    slots: Slot[];
    holiday?: boolean;
    label?: string | null;
    message?: string;
  }>({
    queryKey: ['slots', selectedCourt, selectedDate],
    queryFn: () => fetchSlotForbooking(selectedCourt, selectedDate),
  });

  useEffect(() => {
    if (slotsData?.holiday) {
      setSlots([]);
      return;
    }
    if (slotsData?.slots) {
      setSlots(slotsData.slots);
    }
  }, [slotsData]);

  const skipToNextOpenDay = async () => {
    setFindingNextOpen(true);
    try {
      let d = selectedDate;
      for (let i = 0; i < 60; i++) {
        d = addOneCalendarDay(d);
        try {
          const data = await fetchSlotForbooking(selectedCourt, d);
          if (
            data &&
            !data.holiday &&
            Array.isArray(data.slots) &&
            data.slots.length > 0
          ) {
            setSelectedDate(d);
            queryClient.invalidateQueries({ queryKey: ['slots', selectedCourt, d] });
            toast.success(`Next bookable day: ${d}`);
            return;
          }
        } catch {
          continue;
        }
      }
      toast.info('No bookable day found in the next 60 days.');
    } finally {
      setFindingNextOpen(false);
    }
  };

  const generateOTP = async (bookingId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/delete-booking/${bookingId}/generate-otp`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setOtpBookingId(bookingId);
        setIsOTPModalOpen(true);
      } else {
        toast.error(data.error || "Error generating OTP");
      }
    } catch (error: any) {
      toast.error("Error generating OTP");
    }
  };

  // Function to verify OTP and cancel booking
  const verifyOTP = async () => {
    if (!otpBookingId) return;
    try {
      const res = await fetch(`http://localhost:5000/api/delete-booking/${otpBookingId}/verify-otp`, {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otpValue })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setIsOTPModalOpen(false);
        // Invalidate slots query to update the UI
        queryClient.invalidateQueries({ queryKey: ['slots'] });
      } else {
        toast.error(data.error || "Incorrect OTP");
      }
    } catch (error: any) {
      toast.error("Error verifying OTP");
    }
  };

  // Updated Cancel button: Instead of directly deleting, we generate OTP.
  const handleCancelClick = (bookingId: number) => {
    generateOTP(bookingId);
  };
  const calculateDuration = (start_time: string, end_time: string): string => {
    const start = new Date(`1970-01-01T${start_time}Z`);
    const end = new Date(`1970-01-01T${end_time}Z`);
    let diff = (end.getTime() - start.getTime()) / 1000; // in seconds
    const hours = Math.floor(diff / 3600);
    diff %= 3600;
    const minutes = Math.floor(diff / 60);
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  };

  // Mutation for booking a slot
  const bookSlotMutation = useMutation({
    mutationFn: bookSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      toast.success("Booking successful!");
      setFormData({
        name: "",
        phone: "",
        email: "",
        online_price: 0,
        cash_price: 0,
        add_on: "",
        add_on_price: 0,
      });
      setIsModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Booking failed! ${error?.message || ""}`);
    }
  });

  // Mutation for editing a booking
  const editBookingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: BookingData }) => {
      return editBooking(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slots"] });
      toast.success("Booking updated successfully!");
      setIsEditOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Error updating booking: ${error?.message || ""}`);
    },
  });

  // Mutation for deleting a booking
  

  // Booking handler
  const handleBooking = (data: FormDataType) => {
    const bookingDetails: BookingData = {
      court_id: selectedCourt,
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      name: data.name,
      phone: data.phone,
      email: data.email,
      online_price: data.online_price,
      cash_price: data.cash_price,
      add_on: data.add_on,
      add_on_price: data.add_on_price,
      booking_date: selectedDate,
    };
    bookSlotMutation.mutate(bookingDetails);
  };

  // Handler for updating form data (booking modal)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Handler for opening the booking modal
  const handleOpen = (start_time: string, end_time: string) => {
    setSelectedSlot({ start_time, end_time });
    setIsModalOpen(true);
  };

  // Handler for deletion
  // const handleDelete = (id: number, start_time: string, end_time: string, index: number) => {
  //   setSelectedDeleteSlot({
  //     id: index,
  //     start_time,
  //     end_time
  //   });
  //   setDeleteOpen(true);
  //   setDeleteId(id);
  //   console.log(id);
  // };

  // const deleteSlot = () => {
  //   deleteMutation.mutate(deleteId);
  //   setDeleteOpen(false);
  // };

  // Handlers for Editing
  const handleEdit = (
    bookingId: number,
    start_time: string,
    end_time: string,
    booking_details: BookingDetails
  ) => {
    setSelectedEditSlot({ id: bookingId, start_time, end_time });
    // Populate edit form with existing booking details
    setEditFormData({
      name: booking_details.name,
      phone: booking_details.phone,
      email: booking_details.email,
      online_price: booking_details.online_price,
      cash_price: booking_details.cash_price,
      add_on: booking_details.add_on,
      add_on_price: booking_details.add_on_price,
    });
    setIsEditOpen(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleEditBooking = (data: FormDataType) => {
    const bookingDetails: BookingData = {
      court_id: selectedCourt,
      start_time: selectedEditSlot.start_time,
      end_time: selectedEditSlot.end_time,
      name: data.name,
      phone: data.phone,
      email: data.email,
      online_price: data.online_price,
      cash_price: data.cash_price,
      add_on: data.add_on,
      add_on_price: data.add_on_price,
      booking_date: selectedDate,
    };
    editBookingMutation.mutate({ id: selectedEditSlot.id, data: bookingDetails });
  };

  if (isSlotLoading || isCourtLoading) {
    return <div>Loading data…</div>; 
  }

  return (
    <div className="py-6 dark:bg-boxdark-2 dark:text-bodydark">
      {/* Booking Modal */}
      <Modal
        isOpen={isModalOpen}
        btnText={bookSlotMutation.isPending ? "Booking..." : "Book"}
        color={"bg-success"}
        onClose={() => setIsModalOpen(false)}
        title="Booking Confirmation"
        onSubmit={() => handleBooking(formData)}
      >
        <div>
          {/* Display Date and Slot */}
          <p>
            <strong>Slot:</strong>{" "}
            {selectedSlot.start_time
              ? `${selectedSlot.start_time} - ${selectedSlot.end_time}`
              : "(12:00 AM – 05:00 AM)"}
          </p>
          <div className="flex">
            <FaCalendarAlt className="mr-1.5 size-5 shrink-0 text-gray-400 dark:text-gray-500" />
            {formattedDate}
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Enter Name"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Phone</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              required
              onChange={handleChange}
              placeholder="0300-0000000"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              required
              onChange={handleChange}
              placeholder="example@gmail.com"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          {/* NEW: Online Price */}
          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Online Price</label>
            <input
              type="number"
              name="online_price"
              value={formData.online_price}
              onChange={handleChange}
              placeholder="Enter Online Price"
              required
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          {/* NEW: Cash Price */}
          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Cash Price</label>
            <input
              type="number"
              name="cash_price"
              value={formData.cash_price}
              onChange={handleChange}
              placeholder="Enter Cash Price"
              required
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          {/* NEW: Add On */}
          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Add On</label>
            <input
              type="text"
              name="add_on"
              value={formData.add_on}
              onChange={handleChange}
              placeholder="Enter Add On Description"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          {/* NEW: Add On Price */}
          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Add On Price</label>
            <input
              type="number"
              name="add_on_price"
              value={formData.add_on_price}
              onChange={handleChange}
              placeholder="Enter Add On Price"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isOTPModalOpen}
        btnText="Verify OTP"
        color="bg-primary"
        onClose={() => setIsOTPModalOpen(false)}
        title="OTP Verification"
        onSubmit={verifyOTP}
      >
        <div>
          <p className="mb-3">
            An OTP has been sent to your email. Please enter it below to confirm cancellation:
          </p>
          <input
            type="text"
            value={otpValue}
            onChange={(e) => setOtpValue(e.target.value)}
            placeholder="Enter OTP"
            className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
          />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditOpen}
        btnText={editBookingMutation.isPending ? "Updating..." : "Update"}
        color={"bg-warning"}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Booking (ID: ${selectedEditSlot.id})`}
        onSubmit={() => handleEditBooking(editFormData)}
      >
        <div>
          {/* Display Date and Slot */}
          <p>
            <strong>Slot:</strong>{" "}
            {selectedEditSlot.start_time
              ? `${selectedEditSlot.start_time} - ${selectedEditSlot.end_time}`
              : "(No slot selected)"}
          </p>
          <div className="flex">
            <FaCalendarAlt className="mr-1.5 size-5 shrink-0 text-gray-400 dark:text-gray-500" />
            {formattedDate}
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Name</label>
            <input
              type="text"
              name="name"
              value={editFormData.name}
              onChange={handleEditChange}
              required
              placeholder="Enter Name"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Phone</label>
            <input
              type="text"
              name="phone"
              value={editFormData.phone}
              onChange={handleEditChange}
              required
              placeholder="0300-0000000"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Email</label>
            <input
              type="email"
              name="email"
              value={editFormData.email}
              onChange={handleEditChange}
              required
              placeholder="example@gmail.com"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          {/* NEW: Online Price */}
          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Online Price</label>
            <input
              type="number"
              name="online_price"
              value={editFormData.online_price}
              onChange={handleEditChange}
              placeholder="Enter Online Price"
              required
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          {/* NEW: Cash Price */}
          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Cash Price</label>
            <input
              type="number"
              name="cash_price"
              value={editFormData.cash_price}
              onChange={handleEditChange}
              placeholder="Enter Cash Price"
              required
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          {/* NEW: Add On */}
          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Add On</label>
            <input
              type="text"
              name="add_on"
              value={editFormData.add_on}
              onChange={handleEditChange}
              placeholder="Enter Add On Description"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>

          {/* NEW: Add On Price */}
          <div className="mt-5">
            <label className="mb-2 block text-black dark:text-white">Add On Price</label>
            <input
              type="number"
              name="add_on_price"
              value={editFormData.add_on_price}
              onChange={handleEditChange}
              placeholder="Enter Add On Price"
              className="w-full rounded-lg border-[1.5px] border-stroke bg-transparent py-3 px-5 text-black outline-none transition focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white dark:focus:border-primary"
            />
          </div>
        </div>
      </Modal>

      {/* Page Header & Controls */}
      <div className="lg:flex lg:items-center lg:justify-between mb-6">
        <div className="min-w-0 flex-1">
          <div className="mt-1 flex flex-col sm:flex-row sm:space-x-6">
            <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
              <FaCalendarAlt className="mr-1.5 size-5 shrink-0 text-gray-400 dark:text-gray-500" />
              {formattedDate}
            </div>
          </div>
          <div className="flex flex-col mt-5 md:flex-row justify-end items-end gap-6">
            {/* Courts Dropdown */}
            <div className="min-w-1/4 w-full md:w-1/4">
              <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                Select Court
              </label>
              {isCourtLoading ? (
                <p>Loading courts...</p>
              ) : isCourtError ? (
                <p className="text-red-500">Error fetching courts.</p>
              ) : (
                <select
                  className="form-datepicker w-full capitalize rounded border-[1.5px] border-stroke bg-transparent px-3 py-3 font-normal outline-none transition focus:border-primary active:border-primary dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
                  value={selectedCourt}
                  onChange={(e) => setSelectedCourt(Number(e.target.value))}
                >
                  {courts?.map((court: Court) => (
                    <option key={court.id} value={court.id} className="capitalize">
                      {court.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="min-w-1/4 w-full md:w-1/4">
              <label className="mb-3 block text-sm font-medium text-black dark:text-white">
                Date
              </label>
              <CustomDatePicker
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Slots Grid */}
      {isSlotLoading ? (
        <div className="min-h-[400px] flex justify-center items-center">
          <div className="px-6 py-4 text-center">
            <div role="status" className="flex justify-center items-center w-full h-full">
              <svg
                aria-hidden="true"
                className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
                viewBox="0 0 100 101"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 
                    22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 
                    50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 
                    73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 
                    9.67226 9.08144 27.9921 9.08144 50.5908Z"
                  fill="currentColor"
                />
                <path
                  d="M93.9676 39.0409C96.393 
                    38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 
                    89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 
                    4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 
                    0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 
                    6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 
                    9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 
                    12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 
                    25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 
                    38.2158 91.5421 39.6781 93.9676 39.0409Z"
                  fill="currentFill"
                />
              </svg>
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        </div>
      ) : isSlotError ? (
        <div className='min-h-[400px] flex justify-center items-center'>
          <div className="px-6 py-4 text-center text-red-500">
            Failed to load slots.
          </div>
        </div>
      ) : slotsData?.holiday ? (
        <div className="min-h-[200px] px-2">
          <HolidayDayBanner
            label={slotsData.label}
            message={slotsData.message}
            onNextDay={() => setSelectedDate(addOneCalendarDay(selectedDate))}
            onFindNextOpen={skipToNextOpenDay}
            findNextBusy={findingNextOpen}
          />
        </div>
      ) : slots.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {slots.map((slot, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                </span>
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-1 rounded-full">
                  {calculateDuration(slot.start_time, slot.end_time)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <p className="font-medium">
                  {slot.booked === 0 ? (
                    <span className="text-green-600">Available</span>
                  ) : (
                    <span className="text-yellow-600">Booked</span>
                  )}
                </p>
                {slot.booked === 0 ? (
                  <button
                    onClick={() => handleOpen(slot.start_time, slot.end_time)}
                    className="flex w-20 justify-center rounded bg-success py-1 px-3 font-medium text-gray hover:bg-opacity-90"
                  >
                    Book
                  </button>
                ) : (
                  <div className="flex space-x-6">
                    <button
                      onClick={() =>
                        handleEdit(
                          slot.booking_id,
                          slot.start_time,
                          slot.end_time,
                          slot.booking_details || {
                            name: "",
                            phone: "",
                            email: "",
                            online_price: 0,
                            cash_price: 0,
                            add_on: "",
                            add_on_price: 0,
                          }
                        )
                      }
                      className="flex w-20 justify-center rounded bg-warning py-1 px-3 font-medium text-gray hover:bg-opacity-90"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleCancelClick(slot.booking_id)}
                      className="flex w-20 justify-center rounded bg-danger py-1 px-3 font-medium text-gray hover:bg-opacity-90"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="min-h-[400px]">
          <div className="px-6 py-4 text-center">No slots available.</div>
        </div>
      )}
    </div>
  );
};

export default Padel;
