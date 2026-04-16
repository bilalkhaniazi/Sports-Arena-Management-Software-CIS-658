import axios from 'axios';

// API Base URL
const API_BASE_URL = 'http://localhost:5000/api'; // Update with your backend URL

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
};

// Fetch courts by category ID
export const fetchCourtsByCategory = async (cat_id: number) => {
  if (!cat_id) throw new Error('cat_id is required');

  const response = await axios.post(`${API_BASE_URL}/operator/courts/by-category`, { cat_id });

  return response.data.courts; // Returns only courts array
};

export const fetchSlots = async (court_id: number, date: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/operator/slots`, {
      params: { court_id, date },
    });

    return response.data; // Return slots data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch slots.');
  }
};
export const fetchSlotForbooking = async (court_id: number, date: string) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/booking`, {
      params: { court_id, date },
    });

    return response.data; // Return slots data
  } catch (error: any) {
    throw new Error(error.response?.data?.error || 'Failed to fetch slots.');
  }
};
export const updateCourtSchedule = async (
  court_id: number,
  date: string,
  custom_slots: { start_time: string; end_time: string }[],
) => {
  const response = await fetch(`${API_BASE_URL}/operator/courts/schedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      court_id,
      date,
      default_slot: false, // Since we are saving custom slots
      custom_slots,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update slots');
  }

  return response.json();
};


// ✅ Fetch booked slots
export const fetchBookedSlots = async (court_id: number, date: string) => {
  const response = await axios.get(`${API_BASE_URL}/operator/bookings/booked-slots`, {
    params: { court_id, date },
  });
  return response.data.bookedSlots;
};

// ✅ Book a slot
export const bookSlot = async (data: BookingData) => {
  const response = await axios.post(`${API_BASE_URL}/book-slot`, data);
  return response.data;
};

// ✅ Edit a booking

export type BookingData1 = {
  court_id: number;
  start_time: string;
  end_time: string;
  name: string;
  phone: string;
  email: string;
  price: number;
  booking_date: string;
};

export const editBooking = async (id: number, data: BookingData): Promise<BookingData1> => {
  const response = await axios.put(`${API_BASE_URL}/operator/bookings/${id}`, data);
  return response.data;
};

// ✅ Delete a booking
export const deleteBooking = async (id: number) => {
  const response = await axios.delete(`${API_BASE_URL}/delete-booking/${id}`);
  return response.data;
};